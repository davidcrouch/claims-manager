import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { PurchaseOrderTransformer } from '../transformers/purchase-order.transformer';
import { EntityRelationshipService, ParentNotProjectedError } from '../services/entity-relationship.service';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import { LineItemSyncService } from '../services/line-item-sync.service';
import {
  WorkOrdersRepository,
  ExternalLinksRepository,
  type WorkOrderInsert,
} from '../../../database/repositories';
import { RecordNumberService } from '../../../common/record-number/record-number.service';

@Injectable()
export class ProjectPurchaseOrderUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectPurchaseOrderUseCase');

  constructor(
    private readonly transformer: PurchaseOrderTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly lookupResolution: LookupResolutionService,
    private readonly lineItemSync: LineItemSyncService,
    private readonly workOrdersRepo: WorkOrdersRepository,
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

    this.logger.log(`ProjectPurchaseOrderUseCase.execute — externalObjectId=${externalObjectId}`);
    this.logger.debug(
      `ProjectPurchaseOrderUseCase.execute — payload parent refs: job=${JSON.stringify(payload.job ?? payload.jobId ?? null)}, claim=${JSON.stringify(payload.claim ?? payload.claimId ?? null)}`,
    );

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'work_order');

    // 2. Transform (produces work_order field names)
    const result = this.transformer.transform({ payload, tenantId });

    // 3. Resolve parents
    this.logger.debug(
      `ProjectPurchaseOrderUseCase.execute — parentRefs=${JSON.stringify(result.parentRefs)}`,
    );
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    this.logger.debug(
      `ProjectPurchaseOrderUseCase.execute — resolvedParents=${JSON.stringify(resolvedParents)}`,
    );
    if (resolvedParents.job) (result.entity as Record<string, unknown>).jobId = resolvedParents.job;
    if (resolvedParents.claim) (result.entity as Record<string, unknown>).claimId = resolvedParents.claim;
    if (resolvedParents.vendor) (result.entity as Record<string, unknown>).vendorId = resolvedParents.vendor;

    // 4. Resolve lookups
    const resolvedLookups = await this.lookupResolution.resolveAll({
      lookups: result.lookups,
      tenantId,
      sourceEntity: 'work_order',
      tx,
    });
    for (const [field, lookupId] of Object.entries(resolvedLookups)) {
      (result.entity as Record<string, unknown>)[field] = lookupId;
    }

    // 5. Upsert work order
    let woId: string;
    if (existingLink) {
      await this.workOrdersRepo.update({
        id: existingLink.internalEntityId,
        data: result.entity as Partial<WorkOrderInsert>,
        tx,
      });
      woId = existingLink.internalEntityId;
    } else {
      const jobId = (result.entity as Record<string, unknown>).jobId as string | undefined;
      const claimId = (result.entity as Record<string, unknown>).claimId as string | undefined;

      if (!jobId && !claimId) {
        const unresolvedParents = result.parentRefs
          .filter((r) => r.entityType === 'job' || r.entityType === 'claim')
          .map((r) => ({
            internalEntityType: r.entityType,
            providerEntityType: r.entityType,
            providerEntityId: r.externalId,
          }));
        throw new ParentNotProjectedError(
          'purchase_order',
          externalObjectId,
          unresolvedParents,
          `Work order ${externalObjectId} cannot be created: no resolvable job or claim parent`,
        );
      }

      const internalNumber = await this.recordNumberService.next({
        tenantId,
        entity: 'work_order',
        tx,
      });
      this.logger.log(
        `ProjectPurchaseOrderUseCase.execute — assigned internalNumber=${internalNumber} for ${externalObjectId}`,
      );
      const created = await this.workOrdersRepo.create({
        data: { tenantId, ...result.entity, originType: 'provider', internalNumber } as WorkOrderInsert,
        tx,
      });
      woId = created.id;

      await this.externalLinksRepo.upsert({
        data: {
          tenantId,
          externalObjectId,
          internalEntityType: 'work_order',
          internalEntityId: woId,
          linkRole: 'source',
          isPrimary: true,
          metadata: {},
        },
        tx,
      });
    }

    // 6. Sync line items
    await this.lineItemSync.syncWorkOrderItems({
      workOrderId: woId,
      tenantId,
      payload,
      tx,
    });

    return { status: 'completed', internalEntityId: woId, internalEntityType: 'work_order' };
  }
}
