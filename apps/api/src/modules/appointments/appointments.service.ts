import { Injectable, NotImplementedException, Optional, BadRequestException } from '@nestjs/common';
import { AppointmentsRepository, type AppointmentInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class AppointmentsService {
  private readonly cancelEnabled = process.env.APPOINTMENT_CANCEL_ENABLED === 'true';

  constructor(
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiAppointment = await this.crunchworkService.createAppointment({
      connectionId,
      body: params.body,
    });

    const apiObj = apiAppointment as Record<string, unknown>;
    const insertData: AppointmentInsert = {
      tenantId,
      jobId: (apiObj.jobId ?? params.body?.jobId) as string,
      name: (apiObj.name ?? params.body?.name) as string,
      location: (apiObj.location ?? params.body?.location) as string,
      startDate: new Date((apiObj.startDate ?? params.body?.startDate) as string),
      endDate: new Date((apiObj.endDate ?? params.body?.endDate) as string),
      appointmentPayload: apiAppointment as Record<string, unknown>,
    };
    return this.appointmentsRepo.create({ data: insertData });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiAppointment = await this.crunchworkService.updateAppointment({
      connectionId,
      appointmentId: params.id,
      body: params.body,
    });

    return this.appointmentsRepo.update({
      id: params.id,
      data: { appointmentPayload: apiAppointment as Record<string, unknown> },
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
