import { Injectable, Logger, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import type { ParentRef } from '../transformers/transformer.interface';
import { ParentNotProjectedError } from '../../external/errors/parent-not-projected.error';
import { ExternalObjectService } from '../../external/external-object.service';
import { VendorsRepository } from '../../../database/repositories';
import { jobs, quotes, purchaseOrders, invoices, tasks } from '../../../database/schema';
import type { UseCaseRegistry } from '../use-cases/use-case.registry';

export { ParentNotProjectedError };

@Injectable()
export class EntityRelationshipService {
  private readonly logger = new Logger('EntityRelationshipService');
  private useCaseRegistryRef: UseCaseRegistry | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly externalObjectService: ExternalObjectService,
    private readonly vendorsRepo: VendorsRepository,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Resolve all parent references to internal entity IDs.
   * Returns a map: { entityType: internalId }
   */
  async resolveParents(params: {
    parentRefs: ParentRef[];
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {};

    for (const ref of params.parentRefs) {
      // Vendors use a different resolution path
      if (ref.entityType === 'vendor') {
        const vendorId = await this.resolveVendor(ref.externalId, params.tenantId);
        if (vendorId) resolved['vendor'] = vendorId;
        continue;
      }

      // Check if already linked via external objects
      const existingId = await this.externalObjectService.resolveInternalEntityId({
        connectionId: params.connectionId,
        providerEntityType: ref.entityType,
        providerEntityId: ref.externalId,
        internalEntityType: ref.entityType,
        tx: params.tx,
      });

      if (existingId) {
        resolved[ref.entityType] = existingId;
        continue;
      }

      // If nested payload available, project it
      if (ref.nestedPayload) {
        const projectedId = await this.projectNestedParent({
          entityType: ref.entityType,
          externalId: ref.externalId,
          payload: ref.nestedPayload,
          tenantId: params.tenantId,
          connectionId: params.connectionId,
          tx: params.tx,
        });
        if (projectedId) {
          resolved[ref.entityType] = projectedId;
          continue;
        }
      }

      // Parent not available — collect for error reporting
      if (ref.required) {
        throw new ParentNotProjectedError(
          ref.entityType,
          ref.externalId,
          [{
            internalEntityType: ref.entityType,
            providerEntityType: ref.entityType,
            providerEntityId: ref.externalId,
          }],
          `Parent ${ref.entityType}:${ref.externalId} not projected`,
        );
      }
    }

    return resolved;
  }

  /**
   * Walk the parent chain for an entity and return ancestor IDs (claimId, jobId).
   */
  async resolveAncestors(params: {
    entityType: string;
    entityId: string;
    tenantId: string;
    tx: DrizzleDbOrTx;
  }): Promise<{ claimId?: string; jobId?: string }> {
    const ancestors: { claimId?: string; jobId?: string } = {};

    if (params.entityType === 'claim') {
      ancestors.claimId = params.entityId;
      return ancestors;
    }
    if (params.entityType === 'job') {
      ancestors.jobId = params.entityId;
      const job = await this.findEntityParent('job', params.entityId, params.tx);
      if (job?.claimId) ancestors.claimId = job.claimId;
      return ancestors;
    }

    const entity = await this.findEntityParent(params.entityType, params.entityId, params.tx);
    if (entity?.jobId) {
      ancestors.jobId = entity.jobId;
      const job = await this.findEntityParent('job', entity.jobId, params.tx);
      if (job?.claimId) ancestors.claimId = job.claimId;
    } else if (entity?.claimId) {
      ancestors.claimId = entity.claimId;
    }

    return ancestors;
  }

  private async projectNestedParent(params: {
    entityType: string;
    externalId: string;
    payload: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<string | undefined> {
    const { externalObject } = await this.externalObjectService.upsertFromFetch({
      tenantId: params.tenantId,
      connectionId: params.connectionId,
      providerCode: 'crunchwork',
      providerEntityType: params.entityType,
      providerEntityId: params.externalId,
      normalizedEntityType: params.entityType,
      payload: { ...params.payload, id: params.payload.id ?? params.externalId },
      tx: params.tx,
    });

    const registry = this.getUseCaseRegistry();
    if (!registry) {
      this.logger.warn(
        `EntityRelationshipService.projectNestedParent — UseCaseRegistry not available`,
      );
      return undefined;
    }

    const useCase = registry.get(params.entityType);
    if (!useCase) {
      this.logger.warn(
        `EntityRelationshipService.projectNestedParent — no use case for type=${params.entityType}`,
      );
      return undefined;
    }

    const result = await useCase.execute({
      externalObject: externalObject as unknown as Record<string, unknown>,
      tenantId: params.tenantId,
      connectionId: params.connectionId,
      tx: params.tx,
    });

    return result.status === 'completed' ? result.internalEntityId : undefined;
  }

  private async resolveVendor(externalId: string, tenantId: string): Promise<string | undefined> {
    const existing = await this.vendorsRepo.findOne({ id: externalId, tenantId });
    if (existing) return existing.id;

    this.logger.debug(
      `EntityRelationshipService.resolveVendor — vendor not found by id=${externalId}, skipping`,
    );
    return undefined;
  }

  private async findEntityParent(
    entityType: string,
    entityId: string,
    tx: DrizzleDbOrTx,
  ): Promise<{ claimId?: string; jobId?: string } | null> {
    const db = tx ?? this.db;

    switch (entityType) {
      case 'job': {
        const [row] = await db
          .select({ claimId: jobs.claimId })
          .from(jobs)
          .where(eq(jobs.id, entityId))
          .limit(1);
        return row ? { claimId: row.claimId } : null;
      }
      case 'quote': {
        const [row] = await db
          .select({ claimId: quotes.claimId, jobId: quotes.jobId })
          .from(quotes)
          .where(eq(quotes.id, entityId))
          .limit(1);
        return row ? { claimId: row.claimId ?? undefined, jobId: row.jobId ?? undefined } : null;
      }
      case 'purchase_order': {
        const [row] = await db
          .select({ claimId: purchaseOrders.claimId, jobId: purchaseOrders.jobId })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, entityId))
          .limit(1);
        return row ? { claimId: row.claimId ?? undefined, jobId: row.jobId ?? undefined } : null;
      }
      case 'invoice': {
        const [row] = await db
          .select({ claimId: invoices.claimId, jobId: invoices.jobId })
          .from(invoices)
          .where(eq(invoices.id, entityId))
          .limit(1);
        return row ? { claimId: row.claimId ?? undefined, jobId: row.jobId ?? undefined } : null;
      }
      case 'task': {
        const [row] = await db
          .select({ claimId: tasks.claimId, jobId: tasks.jobId })
          .from(tasks)
          .where(eq(tasks.id, entityId))
          .limit(1);
        return row ? { claimId: row.claimId ?? undefined, jobId: row.jobId ?? undefined } : null;
      }
      default:
        return null;
    }
  }

  private getUseCaseRegistry(): UseCaseRegistry | null {
    if (this.useCaseRegistryRef) return this.useCaseRegistryRef;
    try {
      // Lazy resolution to avoid circular DI
      const { UseCaseRegistry: UCR } = require('../use-cases/use-case.registry');
      this.useCaseRegistryRef = this.moduleRef.get(UCR, { strict: false });
      return this.useCaseRegistryRef;
    } catch {
      return null;
    }
  }
}
