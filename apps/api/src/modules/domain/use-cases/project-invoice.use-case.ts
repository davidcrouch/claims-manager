import { Injectable, Logger, Optional } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { InvoiceTransformer } from '../transformers/invoice.transformer';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import { ExternalObjectService } from '../../external/external-object.service';
import { ParentNotProjectedError } from '../../external/errors/parent-not-projected.error';
import { OutboundEventsService } from '../../outbound-events/outbound-events.service';
import {
  InvoicesRepository,
  ExternalLinksRepository,
  LookupsRepository,
  WorkOrdersRepository,
  PurchaseOrdersRepository,
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
    private readonly lookupsRepo: LookupsRepository,
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
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

    if (!purchaseOrderId && !workOrderId && !existingLink) {
      const missingParents = cwPoId
        ? [{
            internalEntityType: 'purchase_order',
            providerEntityType: 'purchase_order',
            providerEntityId: cwPoId,
          }]
        : [];
      throw new ParentNotProjectedError(
        'invoice',
        externalObjectId,
        missingParents,
        `Invoice ${externalObjectId} cannot be created: no resolvable PO or WO parent`,
      );
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
    let previousStatusLookupId: string | null | undefined;

    if (existingLink) {
      const existingInvoice = await this.invoicesRepo.findOne({
        id: existingLink.internalEntityId,
        tenantId,
      });
      previousStatusLookupId = existingInvoice?.statusLookupId;

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

    const newStatusLookupId = resolvedLookups['statusLookupId'];
    if (newStatusLookupId && newStatusLookupId !== previousStatusLookupId) {
      this.emitIfApproved({
        statusLookupId: newStatusLookupId,
        invoiceId,
        tenantId,
        workOrderId,
        purchaseOrderId,
      }).catch((err) =>
        this.logger.warn(
          `ProjectInvoiceUseCase.emitIfApproved — failed: ${(err as Error).message}`,
        ),
      );
    }

    return { status: 'completed', internalEntityId: invoiceId, internalEntityType: 'invoice' };
  }

  private async emitIfApproved(params: {
    statusLookupId: string;
    invoiceId: string;
    tenantId: string;
    workOrderId?: string;
    purchaseOrderId?: string;
  }): Promise<void> {
    if (!this.outboundEvents) return;

    const lookup = await this.lookupsRepo.findOne({
      id: params.statusLookupId,
      tenantId: params.tenantId,
    });
    const statusName = (lookup?.name ?? '').toLowerCase();
    if (statusName !== 'approved') return;

    const jobId = await this.resolveJobId(params);
    if (!jobId) {
      this.logger.warn(
        `ProjectInvoiceUseCase.emitIfApproved — no jobId for invoice=${params.invoiceId}`,
      );
      return;
    }

    this.outboundEvents.emitInvoiceApproved({
      invoiceId: params.invoiceId,
      jobId,
      tenantId: params.tenantId,
      purchaseOrderId: params.purchaseOrderId,
      approvedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  private async resolveJobId(params: {
    tenantId: string;
    workOrderId?: string;
    purchaseOrderId?: string;
  }): Promise<string | null> {
    if (params.workOrderId) {
      const wo = await this.workOrdersRepo.findOne({
        id: params.workOrderId,
        tenantId: params.tenantId,
      });
      if (wo?.jobId) return wo.jobId;
    }
    if (params.purchaseOrderId) {
      const po = await this.purchaseOrdersRepo.findOne({
        id: params.purchaseOrderId,
        tenantId: params.tenantId,
      });
      if (po?.jobId) return po.jobId;
    }
    return null;
  }
}
