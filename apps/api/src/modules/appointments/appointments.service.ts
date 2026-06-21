import { Injectable, Logger, NotImplementedException, Optional, BadRequestException } from '@nestjs/common';
import { AppointmentsRepository, JobsRepository, type AppointmentInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  private readonly cancelEnabled = process.env.APPOINTMENT_CANCEL_ENABLED === 'true';

  constructor(
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    this.crunchworkService.setConnectionResolver(this.connectionResolver);
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findAll({ tenantId, ...params });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  private buildOutboundBody(
    body: Record<string, unknown>,
    jobExternalRef: string | null,
  ): Record<string, unknown> {
    const outbound: Record<string, unknown> = {
      ...body,
      jobId: jobExternalRef ?? body.jobId,
    };

    if (typeof body.appointmentType === 'string') {
      outbound.appointmentType = { name: body.appointmentType };
    }

    const rawAttendees = body.attendees;
    if (Array.isArray(rawAttendees)) {
      outbound.attendees = rawAttendees.map((a: Record<string, unknown>) => {
        if (a.type && a.attendeeValue) return a;
        return {
          type: (a.attendeeType as string) ?? 'CONTACT',
          attendeeValue: (a.name as string) ?? (a.email as string) ?? '',
          ...(a.email ? { email: a.email } : {}),
        };
      });
    }

    return outbound;
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const internalJobId = params.body?.jobId as string | undefined;

    const job = internalJobId
      ? await this.jobsRepo.findOne({ id: internalJobId, tenantId })
      : null;

    const connectionId = await this.resolveConnectionId(tenantId);
    const outboundBody = this.buildOutboundBody(params.body, job?.externalReference ?? null);

    let apiAppointment: Record<string, unknown> = {};
    try {
      apiAppointment = await this.crunchworkService.createAppointment({
        connectionId,
        body: outboundBody,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('connectionResolver not set')) {
        this.logger.warn('AppointmentsService.create — CW connectionResolver not configured, saving locally only');
      } else {
        throw err;
      }
    }

    const apiObj = apiAppointment as Record<string, unknown>;
    const mergedPayload = {
      ...params.body,
      ...apiAppointment,
    };
    const insertData: AppointmentInsert = {
      tenantId,
      jobId: (internalJobId ?? apiObj.jobId) as string,
      name: (apiObj.name ?? params.body?.name) as string,
      location: (apiObj.location ?? params.body?.location) as string,
      startDate: new Date((apiObj.startDate ?? params.body?.startDate) as string),
      endDate: new Date((apiObj.endDate ?? params.body?.endDate) as string),
      status: (apiObj.status ?? 'Scheduled') as string,
      appointmentPayload: mergedPayload,
    };
    return this.appointmentsRepo.create({ data: insertData });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const internalJobId = (params.body?.jobId ?? existing.jobId) as string | undefined;
    const job = internalJobId
      ? await this.jobsRepo.findOne({ id: internalJobId, tenantId })
      : null;

    const connectionId = await this.resolveConnectionId(tenantId);
    const outboundBody = this.buildOutboundBody(params.body, job?.externalReference ?? null);

    const apiAppointment = await this.crunchworkService.updateAppointment({
      connectionId,
      appointmentId: params.id,
      body: outboundBody,
    });

    const apiObj = apiAppointment as Record<string, unknown>;
    return this.appointmentsRepo.update({
      id: params.id,
      data: {
        name: (apiObj.name ?? params.body?.name ?? existing.name) as string,
        location: (apiObj.location ?? params.body?.location ?? existing.location) as string,
        startDate: params.body?.startDate ? new Date(params.body.startDate as string) : existing.startDate,
        endDate: params.body?.endDate ? new Date(params.body.endDate as string) : existing.endDate,
        appointmentPayload: apiAppointment as Record<string, unknown>,
      },
    });
  }

  async cancel(params: { id: string; body: { reason: string } }) {
    if (!this.cancelEnabled) {
      throw new NotImplementedException(
        '[AppointmentsService.cancel] Appointment cancel is Phase 5 - set APPOINTMENT_CANCEL_ENABLED=true',
      );
    }

    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    await this.crunchworkService.cancelAppointment({
      connectionId,
      appointmentId: params.id,
      body: params.body,
    });

    return this.appointmentsRepo.update({
      id: params.id,
      data: {
        cancellationDetails: { reason: params.body.reason },
        status: 'Cancelled',
      },
    });
  }
}
