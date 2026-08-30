import { Injectable, Logger, Optional, BadRequestException } from '@nestjs/common';
import { AppointmentsRepository, JobsRepository, ContactsRepository, type AppointmentInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';
import { OutboundSyncService } from '../domain/outbound/outbound-sync.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  constructor(
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    private readonly outboundSync: OutboundSyncService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
  ) {}

  private resolveCwJobId(job: {
    apiPayload?: unknown;
    externalReference?: string | null;
  } | null): string | null {
    if (!job) return null;
    const payload = (job.apiPayload ?? {}) as Record<string, unknown>;
    const fromPayload = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (fromPayload) return fromPayload;
    const fromRef = typeof job.externalReference === 'string' ? job.externalReference.trim() : '';
    return fromRef || null;
  }

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
    location?: string;
    appointmentTypeLookupIds?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    jobId?: string;
    jobIds?: string[];
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findAll({ tenantId, ...params });
  }

  async findFilterLocations() {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findDistinctLocations({ tenantId });
  }

  async findFilterTypes() {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findFilterTypes({ tenantId });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.appointmentsRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  private async mapOutboundAttendees(
    raw: unknown,
    tenantId: string,
  ): Promise<Record<string, unknown>[]> {
    if (!Array.isArray(raw)) return [];

    const rows = raw.filter(
      (a): a is Record<string, unknown> => !!a && typeof a === 'object' && !Array.isArray(a),
    );
    const contactIds = [
      ...new Set(
        rows
          .map((a) => a.contactId)
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
      ),
    ];

    const extByContactId = new Map<string, string>();
    await Promise.all(
      contactIds.map(async (id) => {
        const contact = await this.contactsRepo.findOne({ id, tenantId });
        const ext = contact?.externalReference?.trim();
        if (ext) extByContactId.set(id, ext);
      }),
    );

    return rows.map((a) => {
      if (a.type && a.attendeeValue && typeof a.attendeeValue === 'object') {
        return a;
      }
      const contactId = typeof a.contactId === 'string' ? a.contactId : undefined;
      const extFromRow =
        typeof a.externalReference === 'string' ? a.externalReference.trim() : '';
      const ext = extFromRow || (contactId ? extByContactId.get(contactId) : undefined);
      const attendeeValue: Record<string, unknown> = {
        name: typeof a.name === 'string' ? a.name : '',
      };
      if (ext) attendeeValue.externalReference = ext;
      return {
        type: (typeof a.attendeeType === 'string' && a.attendeeType) || 'CONTACT',
        attendeeValue,
      };
    });
  }

  private async buildOutboundBody(
    body: Record<string, unknown>,
    cwJobId: string,
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const customData: Record<string, unknown> =
      body.customData && typeof body.customData === 'object' && !Array.isArray(body.customData)
        ? { ...(body.customData as Record<string, unknown>) }
        : {};
    const description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : undefined;
    if (description) customData.description = description;

    const outbound: Record<string, unknown> = {
      name: body.name,
      jobId: cwJobId,
      location: body.location,
      startDate: body.startDate,
      endDate: body.endDate,
      attendees: await this.mapOutboundAttendees(body.attendees, tenantId),
      customData,
    };

    if (typeof body.appointmentType === 'string' && body.appointmentType.trim()) {
      outbound.appointmentType = { externalReference: body.appointmentType.trim() };
    } else if (body.appointmentType && typeof body.appointmentType === 'object') {
      outbound.appointmentType = body.appointmentType;
    }

    if (typeof body.timezone === 'string' && body.timezone.trim()) {
      outbound.timezone = body.timezone.trim();
    }

    return outbound;
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const internalJobId = params.body?.jobId as string | undefined;

    const job = internalJobId
      ? await this.jobsRepo.findOne({ id: internalJobId, tenantId })
      : null;

    let hasConnection = false;
    try {
      await this.resolveConnectionId(tenantId);
      hasConnection = true;
    } catch {
      hasConnection = false;
    }

    const insertData: AppointmentInsert = {
      tenantId,
      jobId: internalJobId as string,
      name: (params.body?.name) as string,
      location: (params.body?.location ?? 'ONSITE') as string,
      startDate: new Date((params.body?.startDate) as string),
      endDate: new Date((params.body?.endDate) as string),
      status: 'Scheduled',
      appointmentPayload: params.body,
      syncStatus: hasConnection ? 'pending' : null,
    };
    const created = await this.appointmentsRepo.create({ data: insertData });

    if (hasConnection) {
      const cwJobId = this.resolveCwJobId(job);
      if (!cwJobId) {
        this.logger.warn(
          `AppointmentsService.create — job ${internalJobId ?? 'none'} has no Crunchwork id, skipping outbound enqueue for appointment ${created.id}`,
        );
      } else {
        try {
          const connectionId = await this.resolveConnectionId(tenantId);
          const outboundBody = await this.buildOutboundBody(
            params.body,
            cwJobId,
            tenantId,
          );
          const queueId = await this.outboundSync.enqueue({
            tenantId,
            connectionId,
            entityType: 'appointment',
            entityId: created.id,
            action: 'create',
            payload: outboundBody,
            sourceEvent: 'api:create',
            idempotencyKey: `appointment:${created.id}:create`,
            tx: this.outboundSync['db'],
          });
          this.logger.log(
            `AppointmentsService.create — enqueued outbound sync appointment:${created.id} queueId=${queueId} cwJobId=${cwJobId}`,
          );
        } catch (err) {
          this.logger.warn(
            `AppointmentsService.create — failed to enqueue outbound sync: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    if (this.outboundEvents && created && insertData.jobId) {
      this.outboundEvents.emitAppointmentScheduled({
        appointmentId: created.id,
        jobId: insertData.jobId,
        tenantId,
        scheduledAt: new Date().toISOString(),
        appointmentDate: insertData.startDate.toISOString(),
      }).catch(() => {});
    }

    return created;
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();

    let hasConnection = false;
    try {
      await this.resolveConnectionId(tenantId);
      hasConnection = true;
    } catch {
      hasConnection = false;
    }

    const updateData: Partial<AppointmentInsert> = {
      name: (params.body?.name ?? existing.name) as string,
      location: (params.body?.location ?? existing.location) as string,
      startDate: params.body?.startDate ? new Date(params.body.startDate as string) : existing.startDate,
      endDate: params.body?.endDate ? new Date(params.body.endDate as string) : existing.endDate,
      appointmentPayload: params.body,
    };
    if (hasConnection) {
      updateData.syncStatus = 'pending';
    }

    const updated = await this.appointmentsRepo.update({
      id: params.id,
      data: updateData,
    });

    if (hasConnection) {
      try {
        const connectionId = await this.resolveConnectionId(tenantId);
        const internalJobId = (params.body?.jobId ?? existing.jobId) as string | undefined;
        const job = internalJobId
          ? await this.jobsRepo.findOne({ id: internalJobId, tenantId })
          : null;
        const cwJobId = this.resolveCwJobId(job);
        if (!cwJobId) {
          this.logger.warn(
            `AppointmentsService.update — job ${internalJobId ?? 'none'} has no Crunchwork id, skipping outbound enqueue for appointment ${params.id}`,
          );
        } else {
          const outboundBody = await this.buildOutboundBody(
            params.body,
            cwJobId,
            tenantId,
          );
          const externalRef =
            typeof (existing as Record<string, unknown>).externalReference === 'string'
              ? String((existing as Record<string, unknown>).externalReference).trim()
              : '';
          const action = externalRef ? 'update' : 'create';
          await this.outboundSync.cancelPending({
            tenantId,
            entityType: 'appointment',
            entityId: params.id,
          });
          const queueId = await this.outboundSync.enqueue({
            tenantId,
            connectionId,
            entityType: 'appointment',
            entityId: params.id,
            action,
            payload: externalRef ? { ...outboundBody, externalId: externalRef } : outboundBody,
            sourceEvent: 'api:update',
            idempotencyKey: `appointment:${params.id}:${action}:${Date.now()}`,
            tx: this.outboundSync['db'],
          });
          this.logger.log(
            `AppointmentsService.update — enqueued outbound sync appointment:${params.id} action=${action} queueId=${queueId} cwJobId=${cwJobId}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `AppointmentsService.update — failed to enqueue outbound sync: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return updated;
  }

  async cancel(params: { id: string; body: { reason: string } }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();

    let hasConnection = false;
    try {
      await this.resolveConnectionId(tenantId);
      hasConnection = true;
    } catch {
      hasConnection = false;
    }

    const updated = await this.appointmentsRepo.update({
      id: params.id,
      data: {
        cancellationDetails: { reason: params.body.reason },
        status: 'Cancelled',
        syncStatus: hasConnection ? 'pending' : null,
      },
    });

    if (hasConnection) {
      try {
        const connectionId = await this.resolveConnectionId(tenantId);
        const externalRef =
          typeof (existing as Record<string, unknown>).externalReference === 'string'
            ? String((existing as Record<string, unknown>).externalReference).trim()
            : '';
        if (!externalRef) {
          this.logger.warn(
            `AppointmentsService.cancel — appointment ${params.id} has no Crunchwork id, skipping outbound cancel`,
          );
        } else {
          const queueId = await this.outboundSync.enqueue({
            tenantId,
            connectionId,
            entityType: 'appointment',
            entityId: params.id,
            action: 'cancel',
            payload: { ...params.body, externalId: externalRef },
            sourceEvent: 'api:cancel',
            idempotencyKey: `appointment:${params.id}:cancel`,
            tx: this.outboundSync['db'],
          });
          this.logger.log(
            `AppointmentsService.cancel — enqueued outbound sync appointment:${params.id} queueId=${queueId}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `AppointmentsService.cancel — failed to enqueue outbound sync: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return updated;
  }
}
