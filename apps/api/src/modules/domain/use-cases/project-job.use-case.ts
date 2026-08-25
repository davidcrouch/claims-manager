import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { JobTransformer } from '../transformers/job.transformer';
import { EntityRelationshipService } from '../services/entity-relationship.service';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import { ContactSyncService } from '../services/contact-sync.service';
import { ExternalObjectService } from '../../external/external-object.service';
import { ProjectAppointmentUseCase } from './project-appointment.use-case';
import {
  JobsRepository,
  ExternalLinksRepository,
  type JobInsert,
} from '../../../database/repositories';
import { RecordNumberService } from '../../../common/record-number/record-number.service';

@Injectable()
export class ProjectJobUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectJobUseCase');

  constructor(
    private readonly transformer: JobTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly lookupResolution: LookupResolutionService,
    private readonly contactSync: ContactSyncService,
    private readonly externalObjectService: ExternalObjectService,
    private readonly projectAppointment: ProjectAppointmentUseCase,
    private readonly jobsRepo: JobsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly recordNumberService: RecordNumberService,
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

    this.logger.log(
      `ProjectJobUseCase.execute — externalObjectId=${externalObjectId}`,
    );

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx,
    });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'job');
    const existingEntity = existingLink
      ? await this.jobsRepo.findByIdAndTenant({ id: existingLink.internalEntityId, tenantId })
      : null;

    // 2. Transform
    const result = this.transformer.transform({
      payload,
      tenantId,
      existingEntity: (existingEntity as JobInsert) ?? undefined,
    });

    if (result.skip) {
      this.logger.warn(`ProjectJobUseCase.execute — skipped: ${result.skip}`);
      return { status: 'skipped', internalEntityId: '', internalEntityType: 'job', reason: result.skip };
    }

    // 3. Resolve parents
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    if (resolvedParents.claim) result.entity.claimId = resolvedParents.claim;
    if (resolvedParents.vendor) result.entity.vendorId = resolvedParents.vendor;

    // Resolve parentClaimId from customData.cwParentClaimId (CW UUID → internal claim ID)
    const cwParentClaimId = (result.entity.customData as Record<string, unknown>)?.cwParentClaimId as string | undefined;
    if (cwParentClaimId) {
      const parentClaimResolved = await this.entityRelationship.resolveParents({
        parentRefs: [{ entityType: 'claim', externalId: cwParentClaimId, required: false }],
        tenantId,
        connectionId,
        tx,
      });
      if (parentClaimResolved.claim) result.entity.parentClaimId = parentClaimResolved.claim;
    }

    // Record which provider connection created this job
    result.entity.connectionId = connectionId;

    // Claim is required for job creation
    if (!existingEntity && !result.entity.claimId) {
      throw new Error(
        `ProjectJobUseCase.execute — cannot create job ${externalObjectId}: no claimId resolved`,
      );
    }

    // 4. Resolve lookups
    const resolvedLookups = await this.lookupResolution.resolveAll({
      lookups: result.lookups,
      tenantId,
      sourceEntity: 'job',
      sourceEntityId: existingEntity?.id,
      tx,
    });
    for (const [field, lookupId] of Object.entries(resolvedLookups)) {
      (result.entity as Record<string, unknown>)[field] = lookupId;
    }

    // jobTypeLookupId is NOT NULL — block creation if unresolved
    if (!existingEntity && !resolvedLookups['jobTypeLookupId'] && !existingEntity) {
      throw new Error(
        `ProjectJobUseCase.execute — cannot create job ${externalObjectId}: jobType unresolved and column is NOT NULL`,
      );
    }

    // 5. Upsert job
    let jobId: string;
    if (existingEntity) {
      await this.jobsRepo.update({ id: existingEntity.id, data: result.entity, tx });
      jobId = existingEntity.id;
    } else {
      const insurerRef = result.entity.externalJobId?.trim();
      const reusedInternalNumber = insurerRef
        ? await this.jobsRepo.findInternalNumberByExternalJobId({
            tenantId,
            externalJobId: insurerRef,
            tx,
          })
        : null;
      const internalNumber =
        reusedInternalNumber ??
        (await this.recordNumberService.next({
          tenantId,
          entity: 'job',
          tx,
        }));
      this.logger.log(
        reusedInternalNumber
          ? `ProjectJobUseCase.execute — reused internalNumber=${internalNumber} for insurer ref ${insurerRef} (${externalObjectId})`
          : `ProjectJobUseCase.execute — assigned internalNumber=${internalNumber} for ${externalObjectId}`,
      );
      const created = await this.jobsRepo.createIfNotExists({
        data: { ...result.entity, internalNumber } as JobInsert,
        tx,
      });
      if (created) {
        jobId = created.id;
      } else {
        const raced = await this.jobsRepo.findByExternalReference({
          tenantId,
          externalReference: result.entity.externalReference!,
          tx,
        });
        if (!raced) {
          throw new Error(
            `ProjectJobUseCase.execute — insert skipped but no existing row found`,
          );
        }
        this.logger.warn(
          `ProjectJobUseCase.execute — lost race on job insert; updating winner id=${raced.id}`,
        );
        await this.jobsRepo.update({ id: raced.id, data: result.entity, tx });
        jobId = raced.id;
      }
    }

    // 6. Upsert external link
    await this.externalLinksRepo.upsert({
      data: {
        tenantId,
        externalObjectId,
        internalEntityType: 'job',
        internalEntityId: jobId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    // 7. Sync contacts
    if (result.contacts && result.contacts.length > 0) {
      await this.contactSync.syncForEntity({
        entityType: 'job',
        entityId: jobId,
        tenantId,
        contacts: result.contacts,
        strategy: 'additive',
        tx,
      });
    }

    // 8. Snapshot assignees into custom_data (no job_assignees child table yet;
    //    add job_assignees + extend AssigneeSyncService later if query/filter needed)
    if (result.assignees && result.assignees.length > 0) {
      const assigneesSnapshot = result.assignees.map((a) => ({
        externalReference: a.externalReference,
        displayName: a.displayName,
        email: a.email,
        type: a.assigneeTypeExternalReference,
      }));
      const currentCustomData = (result.entity.customData ?? {}) as Record<string, unknown>;
      currentCustomData.assignees = assigneesSnapshot;
      await this.jobsRepo.update({
        id: jobId,
        data: { customData: currentCustomData },
        tx,
      });
    }

    // 9. Project embedded appointments
    // CW job payloads often include appointments[]. Those need a real
    // external_objects row (UUID FK) — a synthetic "embedded:appointment:…"
    // id is not a uuid and aborts the surrounding transaction.
    const appointments = payload.appointments;
    if (Array.isArray(appointments) && appointments.length > 0) {
      for (const appt of appointments) {
        const apptPayload = appt as Record<string, unknown>;
        const cwApptId = apptPayload.id as string | undefined;
        if (!cwApptId) continue;

        // Ensure parent job resolves: embedded appts often omit jobId.
        const cwJobExternalId =
          typeof payload.id === 'string' ? payload.id : undefined;
        const enrichedAppt: Record<string, unknown> = {
          ...apptPayload,
          id: apptPayload.id ?? cwApptId,
          ...(cwJobExternalId && !apptPayload.jobId && !apptPayload.job
            ? { jobId: cwJobExternalId }
            : {}),
        };

        const savepoint = `embedded_appt_${cwApptId.replace(/-/g, '').slice(0, 16)}`;
        try {
          await tx.execute(sql.raw(`SAVEPOINT ${savepoint}`));
          const { externalObject } = await this.externalObjectService.upsertFromFetch({
            tenantId,
            connectionId,
            providerCode: 'crunchwork',
            providerEntityType: 'appointment',
            providerEntityId: cwApptId,
            normalizedEntityType: 'appointment',
            payload: enrichedAppt,
            tx,
          });

          await this.projectAppointment.execute({
            externalObject: externalObject as unknown as Record<string, unknown>,
            tenantId,
            connectionId,
            tx,
            parentOverrides: { jobId },
          });
          await tx.execute(sql.raw(`RELEASE SAVEPOINT ${savepoint}`));
        } catch (err) {
          try {
            await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`));
          } catch {
            // savepoint may not exist if the failure was before SAVEPOINT
          }
          this.logger.warn(
            `ProjectJobUseCase.execute — embedded appointment ${cwApptId} projection failed: ${(err as Error).message}`,
          );
        }
      }
    }

    return { status: 'completed', internalEntityId: jobId, internalEntityType: 'job' };
  }
}
