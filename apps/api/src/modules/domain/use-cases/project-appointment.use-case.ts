import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { AppointmentTransformer } from '../transformers/appointment.transformer';
import { EntityRelationshipService } from '../services/entity-relationship.service';
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
  }): Promise<ProjectionResult> {
    const { tenantId, connectionId, tx } = params;
    const payload = (params.externalObject.latestPayload ?? {}) as Record<string, unknown>;
    const externalObjectId = params.externalObject.id as string;

    this.logger.log(`ProjectAppointmentUseCase.execute — externalObjectId=${externalObjectId}`);

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'appointment');
    const existingEntity = existingLink
      ? await this.appointmentsRepo.findOne({ id: existingLink.internalEntityId, tenantId })
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
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    if (resolvedParents.job) (result.entity as Record<string, unknown>).jobId = resolvedParents.job;

    // 4. Upsert
    let appointmentId: string;
    if (existingLink) {
      await this.appointmentsRepo.update({
        id: existingLink.internalEntityId,
        data: result.entity as Partial<AppointmentInsert>,
        tx,
      });
      appointmentId = existingLink.internalEntityId;
    } else {
      const jobId = (result.entity as Record<string, unknown>).jobId as string | undefined;
      if (!jobId) {
        const payloadId = (payload.id as string) ?? 'unknown';
        this.logger.warn(
          `ProjectAppointmentUseCase.execute — appointment ${payloadId} has no resolvable job parent; skipping insert`,
        );
        return { status: 'skipped', internalEntityId: '', internalEntityType: 'appointment', reason: 'skipped_no_parent' };
      }

      const created = await this.appointmentsRepo.create({
        data: { tenantId, ...result.entity } as AppointmentInsert,
        tx,
      });
      appointmentId = created.id;

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
    }

    return { status: 'completed', internalEntityId: appointmentId, internalEntityType: 'appointment' };
  }
}
