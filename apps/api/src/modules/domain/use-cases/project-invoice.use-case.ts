import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { InvoiceTransformer } from '../transformers/invoice.transformer';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import { ExternalObjectService } from '../../external/external-object.service';
import {
  InvoicesRepository,
  ExternalLinksRepository,
  type InvoiceInsert,
} from '../../../database/repositories';

function cwPurchaseOrderExternalId(
  payload: Record<string, unknown>,
): string | undefined {
  const nested = payload.purchaseOrder;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const id = (nested as Record<string, unknown>).id;
    if (typeof id === 'string' && id) return id;
  }
  return typeof payload.purchaseOrderId === 'string' && payload.purchaseOrderId
    ? payload.purchaseOrderId
    : undefined;
}

@Injectable()
export class ProjectInvoiceUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectInvoiceUseCase');

  constructor(
    private readonly transformer: InvoiceTransformer,
    private readonly lookupResolution: LookupResolutionService,
    private readonly invoicesRepo: InvoicesRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectService: ExternalObjectService,
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

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx,
    });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'invoice');

    const result = this.transformer.transform({ payload, tenantId });

    // Provider POs project as work_orders; resolve both against the CW PO id.
    const cwPoId = cwPurchaseOrderExternalId(payload);
    let purchaseOrderId: string | undefined;
    let workOrderId: string | undefined;

    if (cwPoId) {
      purchaseOrderId =
        (await this.externalObjectService.resolveInternalEntityId({
          connectionId,
          providerEntityType: 'purchase_order',
          providerEntityId: cwPoId,
          internalEntityType: 'purchase_order',
          tx,
        })) ?? undefined;

      workOrderId =
        (await this.externalObjectService.resolveInternalEntityId({
          connectionId,
          providerEntityType: 'purchase_order',
          providerEntityId: cwPoId,
          internalEntityType: 'work_order',
          tx,
        })) ?? undefined;
    }

    if (purchaseOrderId) {
      (result.entity as Record<string, unknown>).purchaseOrderId = purchaseOrderId;
    }
    if (workOrderId) {
      (result.entity as Record<string, unknown>).workOrderId = workOrderId;
    }

    if (!purchaseOrderId && !workOrderId) {
      this.logger.warn(
        `ProjectInvoiceUseCase.execute — invoice has no resolvable PO or WO parent; skipping`,
      );
      return {
        status: 'skipped',
        internalEntityId: '',
        internalEntityType: 'invoice',
        reason: 'skipped_no_parent',
      };
    }

    const resolvedLookups = await this.lookupResolution.resolveAll({
      lookups: result.lookups,
      tenantId,
      sourceEntity: 'invoice',
      tx,
    });
    for (const [field, lookupId] of Object.entries(resolvedLookups)) {
      (result.entity as Record<string, unknown>)[field] = lookupId;
    }

    let invoiceId: string;
    if (existingLink) {
      await this.invoicesRepo.update({
        id: existingLink.internalEntityId,
        data: result.entity as Partial<InvoiceInsert>,
        tx,
      });
      invoiceId = existingLink.internalEntityId;
    } else {
      const created = await this.invoicesRepo.create({
        data: { tenantId, ...result.entity, originType: 'provider' } as InvoiceInsert,
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
