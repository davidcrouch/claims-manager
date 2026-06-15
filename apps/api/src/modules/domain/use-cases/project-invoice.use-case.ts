import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { InvoiceTransformer } from '../transformers/invoice.transformer';
import { EntityRelationshipService } from '../services/entity-relationship.service';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import {
  InvoicesRepository,
  ExternalLinksRepository,
  type InvoiceInsert,
} from '../../../database/repositories';

@Injectable()
export class ProjectInvoiceUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectInvoiceUseCase');

  constructor(
    private readonly transformer: InvoiceTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly lookupResolution: LookupResolutionService,
    private readonly invoicesRepo: InvoicesRepository,
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

    this.logger.log(`ProjectInvoiceUseCase.execute — externalObjectId=${externalObjectId}`);

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'invoice');

    // 2. Transform
    const result = this.transformer.transform({ payload, tenantId });

    // 3. Resolve parents (purchase_order)
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    const purchaseOrderId = resolvedParents.purchase_order;
    if (purchaseOrderId) (result.entity as Record<string, unknown>).purchaseOrderId = purchaseOrderId;

    // 4. Resolve lookups
    const resolvedLookups = await this.lookupResolution.resolveAll({
      lookups: result.lookups,
      tenantId,
      sourceEntity: 'invoice',
      tx,
    });
    for (const [field, lookupId] of Object.entries(resolvedLookups)) {
      (result.entity as Record<string, unknown>)[field] = lookupId;
    }

    // 5. Upsert
    let invoiceId: string;
    if (existingLink) {
      await this.invoicesRepo.update({
        id: existingLink.internalEntityId,
        data: result.entity as Partial<InvoiceInsert>,
        tx,
      });
      invoiceId = existingLink.internalEntityId;
    } else {
      // purchaseOrderId is required for new invoices
      if (!purchaseOrderId) {
        (result.entity as Record<string, unknown>).purchaseOrderId = '';
      }
      const created = await this.invoicesRepo.create({
        data: { tenantId, ...result.entity } as InvoiceInsert,
        tx,
      });
      invoiceId = created.id;

      await this.externalLinksRepo.upsert({
        data: {
          tenantId,
          externalObjectId,
          internalEntityType: 'invoice',
          internalEntityId: invoiceId,
          linkRole: 'source',
          isPrimary: true,
          metadata: {},
        },
        tx,
      });
    }

    return { status: 'completed', internalEntityId: invoiceId, internalEntityType: 'invoice' };
  }
}
