import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { PurchaseOrderTransformer } from '../transformers/purchase-order.transformer';
import { EntityRelationshipService } from '../services/entity-relationship.service';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import { LineItemSyncService } from '../services/line-item-sync.service';
import {
  PurchaseOrdersRepository,
  ExternalLinksRepository,
  type PurchaseOrderInsert,
} from '../../../database/repositories';

@Injectable()
export class ProjectPurchaseOrderUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectPurchaseOrderUseCase');

  constructor(
    private readonly transformer: PurchaseOrderTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly lookupResolution: LookupResolutionService,
    private readonly lineItemSync: LineItemSyncService,
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
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

    this.logger.log(`ProjectPurchaseOrderUseCase.execute — externalObjectId=${externalObjectId}`);

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'purchase_order');

    // 2. Transform
    const result = this.transformer.transform({ payload, tenantId });

    // 3. Resolve parents
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    if (resolvedParents.job) (result.entity as Record<string, unknown>).jobId = resolvedParents.job;
    if (resolvedParents.claim) (result.entity as Record<string, unknown>).claimId = resolvedParents.claim;

    // 4. Resolve lookups
    const resolvedLookups = await this.lookupResolution.resolveAll({
      lookups: result.lookups,
      tenantId,
      sourceEntity: 'purchase_order',
      tx,
    });
    for (const [field, lookupId] of Object.entries(resolvedLookups)) {
      (result.entity as Record<string, unknown>)[field] = lookupId;
    }

    // 5. Upsert
    let poId: string;
    if (existingLink) {
      await this.purchaseOrdersRepo.update({
        id: existingLink.internalEntityId,
        data: result.entity as Partial<PurchaseOrderInsert>,
        tx,
      });
      poId = existingLink.internalEntityId;
    } else {
      const created = await this.purchaseOrdersRepo.create({
        data: { tenantId, ...result.entity } as PurchaseOrderInsert,
        tx,
      });
      poId = created.id;

      await this.externalLinksRepo.upsert({
        data: {
          tenantId,
          externalObjectId,
          internalEntityType: 'purchase_order',
          internalEntityId: poId,
          linkRole: 'source',
          isPrimary: true,
          metadata: {},
        },
        tx,
      });
    }

    // 6. Sync line items
    await this.lineItemSync.syncPurchaseOrderItems({
      purchaseOrderId: poId,
      tenantId,
      payload,
      tx,
    });

    return { status: 'completed', internalEntityId: poId, internalEntityType: 'purchase_order' };
  }
}
