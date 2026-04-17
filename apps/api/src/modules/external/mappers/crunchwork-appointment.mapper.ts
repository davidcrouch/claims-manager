import { Injectable, Logger } from '@nestjs/common';
import {
  AppointmentsRepository,
  ExternalLinksRepository,
  type AppointmentInsert,
} from '../../../database/repositories';
import type { EntityMapper } from '../tools/external-tools.controller';
import { ExternalObjectService } from '../external-object.service';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

const VALID_LOCATIONS = new Set(['ONSITE', 'DIGITAL']);

@Injectable()
export class CrunchworkAppointmentMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkAppointmentMapper');

  constructor(
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectService: ExternalObjectService,
  ) {}

  async map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{
    internalEntityId: string;
    internalEntityType: string;
    skipped?: string;
  }> {
    const extObj = params.externalObject;
    const payload = extObj.latestPayload as Record<string, unknown>;
    const externalObjectId = extObj.id as string;
    const tx = params.tx;

    this.logger.log(
      `CrunchworkAppointmentMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx,
    });
    const existingLink = existingLinks.find(
      (l) => l.internalEntityType === 'appointment',
    );

    const jobProviderId = (payload.job as Record<string, unknown>)?.id as
      | string
      | undefined;
    const jobId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'job',
      providerEntityId: jobProviderId,
      internalEntityType: 'job',
      tx,
    });

    const locationRaw = ((payload.location as string) ?? '')
      .toString()
      .toUpperCase();
    const location = VALID_LOCATIONS.has(locationRaw) ? locationRaw : 'ONSITE';

    const startDate = payload.startDate
      ? new Date(payload.startDate as string)
      : undefined;
    const endDate = payload.endDate
      ? new Date(payload.endDate as string)
      : undefined;

    const appointmentData: Partial<AppointmentInsert> = {
      tenantId: params.tenantId,
      jobId: jobId ?? undefined,
      name: (payload.name as string) ?? 'Untitled Appointment',
      location,
      startDate,
      endDate,
      status: (payload.status as string) ?? undefined,
      appointmentPayload: payload,
    };

    if (existingLink) {
      await this.appointmentsRepo.update({
        id: existingLink.internalEntityId,
        data: appointmentData,
        tx,
      });
      return {
        internalEntityId: existingLink.internalEntityId,
        internalEntityType: 'appointment',
      };
    }

    const payloadId = (payload.id as string | undefined) ?? 'unknown';

    if (!jobId) {
      this.logger.warn(
        `CrunchworkAppointmentMapper.map — appointment ${payloadId} has no resolvable job parent (providerJobId=${jobProviderId ?? 'unknown'}); skipping insert`,
      );
      return {
        internalEntityId: '',
        internalEntityType: 'appointment',
        skipped: 'skipped_no_parent',
      };
    }

    if (!startDate || !endDate) {
      this.logger.warn(
        `CrunchworkAppointmentMapper.map — appointment ${payloadId} missing start/end date; skipping insert`,
      );
      return {
        internalEntityId: '',
        internalEntityType: 'appointment',
        skipped: 'skipped_incomplete_payload',
      };
    }

    const created = await this.appointmentsRepo.create({
      data: appointmentData as AppointmentInsert,
      tx,
    });

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'appointment',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    return { internalEntityId: created.id, internalEntityType: 'appointment' };
  }

  private async resolveFK(params: {
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string | undefined;
    internalEntityType: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    if (!params.providerEntityId) return null;
    return this.externalObjectService.resolveInternalEntityId({
      connectionId: params.connectionId,
      providerEntityType: params.providerEntityType,
      providerEntityId: params.providerEntityId,
      internalEntityType: params.internalEntityType,
      tx: params.tx,
    });
  }
}
