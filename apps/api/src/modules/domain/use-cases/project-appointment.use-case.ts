import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { AppointmentTransformer } from '../transformers/appointment.transformer';
import { EntityRelationshipService, ParentNotProjectedError } from '../services/entity-relationship.service';
import {
  AppointmentsRepository,
  ExternalLinksRepository,
  type AppointmentInsert,
} from '../../../database/repositories';

@Injectable()
export class ProjectAppointmentUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectAppointmentUseCase');

  constructor(
    private readonly transformer: AppointmentTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
  ) {}

  async execute(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
    /** When projecting from a parent (e.g. job webhook), skip re-resolving. */
    parentOverrides?: { jobId?: string };
  }): Promise<ProjectionResult> {
    const { tenantId, connectionId, tx } = params;
    const payload = (params.externalObject.latestPayload ?? {}) as Record<string, unknown>;
    const externalObjectId = params.externalObject.id as string;

    this.logger.log(`ProjectAppointmentUseCase.execute — externalObjectId=${externalObjectId}`);

    const existingId = await this.resolveExistingAppointmentId({
      tenantId,
      externalObjectId,
      payload,
      tx,
    });
    const existingEntity = existingId
      ? await this.appointmentsRepo.findOne({ id: existingId, tenantId, tx })
      : null;

    // 2. Transform (pass existingEntity so transformer can skip validation for updates)
    const result = this.transformer.transform({
      payload,
      tenantId,
      existingEntity: existingEntity ? (existingEntity as Record<string, unknown>) : undefined,
    });

    if (result.skip) {
      const payloadId = (payload.id as string) ?? 'unknown';
      this.logger.warn(
        `ProjectAppointmentUseCase.execute — appointment ${payloadId} ${result.skip}`,
      );
      return { status: 'skipped', internalEntityId: '', internalEntityType: 'appointment', reason: result.skip };
    }

    // 3. Resolve parents
    if (params.parentOverrides?.jobId) {
      (result.entity as Record<string, unknown>).jobId = params.parentOverrides.jobId;
    } else {
      const resolvedParents = await this.entityRelationship.resolveParents({
        parentRefs: result.parentRefs,
        tenantId,
        connectionId,
        tx,
      });
      if (resolvedParents.job) (result.entity as Record<string, unknown>).jobId = resolvedParents.job;
    }

    // 4. Upsert
    let appointmentId: string;
    if (existingId) {
      await this.appointmentsRepo.update({
        id: existingId,
        data: result.entity as Partial<AppointmentInsert>,
        tx,
      });
      appointmentId = existingId;
    } else {
      const jobId = (result.entity as Record<string, unknown>).jobId as string | undefined;
      if (!jobId) {
        const unresolvedParents = result.parentRefs
          .filter((r) => r.entityType === 'job')
          .map((r) => ({
            internalEntityType: r.entityType,
            providerEntityType: r.entityType,
            providerEntityId: r.externalId,
          }));
        throw new ParentNotProjectedError(
          'appointment',
          externalObjectId,
          unresolvedParents,
          `Appointment ${externalObjectId} cannot be created: no resolvable job parent`,
        );
      }

      const created = await this.appointmentsRepo.create({
        data: { tenantId, ...result.entity } as AppointmentInsert,
        tx,
      });
      appointmentId = created.id;
    }

    await this.externalLinksRepo.upsert({
      data: {
        tenantId,
        externalObjectId,
        internalEntityType: 'appointment',
        internalEntityId: appointmentId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    return { status: 'completed', internalEntityId: appointmentId, internalEntityType: 'appointment' };
  }

  private async resolveExistingAppointmentId(params: {
    tenantId: string;
    externalObjectId: string;
    payload: Record<string, unknown>;
    tx: DrizzleDbOrTx;
  }): Promise<string | null> {
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId: params.externalObjectId,
      tx: params.tx,
    });
    const link = existingLinks.find((l) => l.internalEntityType === 'appointment');
    if (link) return link.internalEntityId;

    const cwAppointmentId =
      typeof params.payload.id === 'string' ? params.payload.id.trim() : '';
    if (!cwAppointmentId) return null;

    const byExtRef = await this.appointmentsRepo.findByExternalReference({
      tenantId: params.tenantId,
      externalReference: cwAppointmentId,
      tx: params.tx,
    });
    if (byExtRef) {
      this.logger.log(
        `ProjectAppointmentUseCase.execute — matched existing appointment ${byExtRef.id} by Crunchwork id ${cwAppointmentId}`,
      );
      return byExtRef.id;
    }

    return null;
  }
}
