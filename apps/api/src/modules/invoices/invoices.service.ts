import { Injectable, Optional, BadRequestException, Logger, Inject } from '@nestjs/common';
import {
  InvoicesRepository,
  WorkOrdersRepository,
  PurchaseOrdersRepository,
  LookupsRepository,
  type InvoiceInsert,
} from '../../database/repositories';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { LookupResolver } from '../external/lookup-resolver.service';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';
import { RecordNumberService } from '../../common/record-number/record-number.service';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { CatalogOutboundService } from '../catalog/services/catalog-outbound.service';
import {
  applyLocalPricingToCrunchworkInvoiceGroups,
  buildCrunchworkVendorTaxInvoiceCreateBody,
  crunchworkInvoiceGroupsFromPayload,
  preferExistingAmount,
  toInvoiceUpdateGroups,
} from './invoice-publish.utils';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger('InvoicesService');

  constructor(
    private readonly invoicesRepo: InvoicesRepository,
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    private readonly lookupResolver: LookupResolver,
    private readonly recordNumberService: RecordNumberService,
    private readonly catalogSelectionService: CatalogSelectionService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional() private readonly catalogOutbound?: CatalogOutboundService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string | null> {
    if (!this.connectionResolver) return tenantId;
    this.crunchworkService.setConnectionResolver(this.connectionResolver);
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      return null;
    }
    return connection.id;
  }

  private async resolveStatusLookupId(params: {
    tenantId: string;
    name: string;
  }): Promise<string | null> {
    return (
      (await this.lookupResolver.resolveByName({
        tenantId: params.tenantId,
        domain: 'invoice_status',
        name: params.name,
      })) ??
      (await this.lookupResolver.resolve({
        tenantId: params.tenantId,
        domain: 'invoice_status',
        externalReference: params.name,
        name: params.name,
        autoCreate: true,
      }))
    );
  }

  private async resolveProviderPurchaseOrderId(params: {
    tenantId: string;
    workOrderId?: string | null;
    purchaseOrderId?: string | null;
  }): Promise<string | undefined> {
    if (params.workOrderId) {
      const wo = await this.workOrdersRepo.findOne({
        id: params.workOrderId,
        tenantId: params.tenantId,
      });
      if (wo?.externalId) return wo.externalId;
      if (wo?.purchaseOrderId && !params.purchaseOrderId) {
        params = { ...params, purchaseOrderId: wo.purchaseOrderId };
      }
    }
    if (params.purchaseOrderId) {
      const po = await this.purchaseOrdersRepo.findOne({
        id: params.purchaseOrderId,
        tenantId: params.tenantId,
      });
      return po?.externalId ?? undefined;
    }
    return undefined;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    purchaseOrderId?: string;
    jobId?: string;
    jobIds?: string[];
    status?: string;
    statusId?: string;
    search?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.invoicesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      purchaseOrderId: params.purchaseOrderId,
      jobId: params.jobId,
      jobIds: params.jobIds,
      status: params.status,
      statusId: params.statusId,
      search: params.search,
      sort: params.sort,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.invoicesRepo.findOne({ id: params.id, tenantId });
  }

  async findByPurchaseOrder(params: { purchaseOrderId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.invoicesRepo.findByPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      tenantId,
    });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.invoicesRepo.findByJob({
      jobId: params.jobId,
      tenantId,
    });
  }

  /**
   * Create a local draft invoice only. Provider sync happens on publish().
   */
  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const logPrefix = 'InvoicesService.create';
    const tenantId = this.tenantContext.getTenantId();
    const body = { ...params.body };

    const workOrderId =
      typeof body.workOrderId === 'string' && body.workOrderId
        ? body.workOrderId
        : undefined;
    let purchaseOrderId =
      typeof body.purchaseOrderId === 'string' && body.purchaseOrderId
        ? body.purchaseOrderId
        : undefined;

    let jobId =
      typeof body.jobId === 'string' && body.jobId ? body.jobId : undefined;
    let claimId =
      typeof body.claimId === 'string' && body.claimId ? body.claimId : undefined;

    if (workOrderId) {
      const wo = await this.workOrdersRepo.findOne({ id: workOrderId, tenantId });
      if (!wo) {
        throw new BadRequestException('Work order not found');
      }
      if (!purchaseOrderId && wo.purchaseOrderId) {
        purchaseOrderId = wo.purchaseOrderId;
      }
      jobId = jobId ?? wo.jobId ?? undefined;
      claimId = claimId ?? wo.claimId ?? undefined;
    }

    if (!workOrderId && !purchaseOrderId) {
      throw new BadRequestException(
        'workOrderId or purchaseOrderId is required to create an invoice',
      );
    }

    const draftStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: 'Draft',
    });

    const issueDateRaw = body.issueDate;
    const issueDate =
      typeof issueDateRaw === 'string' && issueDateRaw
        ? new Date(issueDateRaw)
        : undefined;

    const totalAmount =
      body.totalAmount != null ? String(body.totalAmount) : undefined;

    const bodyInternalNumber = body.internalNumber;
    const bodyInvoiceNumber = body.invoiceNumber;

    return this.db.transaction(async (tx) => {
      const internalNumber = await this.recordNumberService.resolve({
        tenantId,
        entity: 'invoice',
        explicit: bodyInternalNumber,
        tx,
      });
      const invoiceNumber = this.recordNumberService.isBlank(bodyInvoiceNumber)
        ? null
        : String(bodyInvoiceNumber).trim();

      const insertData: InvoiceInsert = {
        tenantId,
        workOrderId: workOrderId ?? null,
        purchaseOrderId: purchaseOrderId ?? null,
        claimId: claimId ?? null,
        jobId: jobId ?? null,
        internalNumber,
        invoiceNumber,
        issueDate: issueDate ?? null,
        comments: typeof body.note === 'string' ? body.note : null,
        totalAmount: totalAmount ?? null,
        statusLookupId: draftStatusId ?? null,
        invoicePayload: {
          workOrderId,
          purchaseOrderId,
          dueDate: body.dueDate ?? null,
        },
        originType: 'user',
        issuerOrganisationId: tenantId,
        ownershipStatus: 'owned',
        createdByUserId: params.userId ?? null,
        updatedByUserId: params.userId ?? null,
      };

      this.logger.log(
        `${logPrefix} — local draft workOrderId=${workOrderId ?? 'none'} purchaseOrderId=${purchaseOrderId ?? 'none'} internalNumber=${internalNumber}`,
      );

      return this.invoicesRepo.create({ data: insertData, tx });
    });
  }

  /**
   * Publish a draft invoice to the external provider (e.g. Crunchwork),
   * matching the estimate/quote create-then-publish flow.
   */
  async publish(params: { id: string; userId?: string }) {
    const logPrefix = 'InvoicesService.publish';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.invoicesRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Invoice not found');
    }

    const providerPurchaseOrderId = await this.resolveProviderPurchaseOrderId({
      tenantId,
      workOrderId: existing.workOrderId,
      purchaseOrderId: existing.purchaseOrderId,
    });

    if (!providerPurchaseOrderId) {
      throw new BadRequestException(
        'Cannot publish: work order/purchase order has no provider purchase-order id',
      );
    }

    const connectionId = await this.resolveConnectionId(tenantId);
    if (!connectionId) {
      throw new BadRequestException('No active provider connection for tenant');
    }

    const reusedCwInvoiceId = await this.resolveExistingCrunchworkInvoiceId({
      tenantId,
      invoice: existing,
    });

    this.logger.log(
      `${logPrefix} — pushing invoice=${params.id} to provider connectionId=${connectionId} purchaseOrderId=${providerPurchaseOrderId}` +
        (reusedCwInvoiceId ? ` reusingCwInvoiceId=${reusedCwInvoiceId}` : ' invoiceType=Invoice'),
    );

    let apiObj: Record<string, unknown>;
    let cwInvoiceId: string;

    if (reusedCwInvoiceId) {
      apiObj = await this.crunchworkService.getInvoice({
        connectionId,
        invoiceId: reusedCwInvoiceId,
      });
      cwInvoiceId = reusedCwInvoiceId;
    } else {
      try {
        apiObj = await this.crunchworkService.createInvoice({
          connectionId,
          body: buildCrunchworkVendorTaxInvoiceCreateBody({
            purchaseOrderId: providerPurchaseOrderId,
          }),
        });
      } catch (err) {
        const recoveredId = await this.resolveExistingCrunchworkInvoiceId({
          tenantId,
          invoice: existing,
        });
        if (!recoveredId) throw err;
        this.logger.warn(
          `${logPrefix} — create rejected; reusing existing Crunchwork invoice ${recoveredId}`,
        );
        apiObj = await this.crunchworkService.getInvoice({
          connectionId,
          invoiceId: recoveredId,
        });
      }
      const createdId = apiObj.id as string | undefined;
      if (!createdId) {
        throw new BadRequestException(
          'Provider did not return an invoice id after publish',
        );
      }
      cwInvoiceId = createdId;
    }

    const issueDateIso = existing.issueDate
      ? existing.issueDate instanceof Date
        ? existing.issueDate.toISOString()
        : String(existing.issueDate)
      : undefined;

    let apiObjAfterGroups = apiObj;
    try {
      apiObjAfterGroups = await this.applyCrunchworkInvoiceGroupPricing({
        logPrefix,
        connectionId,
        cwInvoiceId,
        createResponse: apiObj,
        purchaseOrderId: existing.purchaseOrderId,
        workOrderId: existing.workOrderId,
        vendorInvoiceNumber: existing.invoiceNumber,
        issueDate: issueDateIso,
        note: existing.comments,
      });
    } catch (err) {
      this.logger.error(
        `${logPrefix} — Crunchwork invoice ${cwInvoiceId} group totals failed: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    const submittedStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: 'Submitted',
    });

    // UI titles use invoiceNumber; CW returns a display name plus a numeric invoiceNumber.
    const cwInvoiceNumber =
      (typeof apiObjAfterGroups.name === 'string' && apiObjAfterGroups.name.trim()
        ? apiObjAfterGroups.name.trim()
        : null) ??
      (apiObjAfterGroups.invoiceNumber != null
        ? String(apiObjAfterGroups.invoiceNumber)
        : existing.invoiceNumber);

    await this.invoicesRepo.update({
      id: params.id,
      data: {
        sourceExternalReference: cwInvoiceId,
        statusLookupId: submittedStatusId ?? existing.statusLookupId,
        invoiceNumber: cwInvoiceNumber ?? existing.invoiceNumber,
        subTotal: preferExistingAmount(apiObjAfterGroups.subTotal, existing.subTotal),
        totalTax: preferExistingAmount(apiObjAfterGroups.totalTax, existing.totalTax),
        totalAmount: preferExistingAmount(
          apiObjAfterGroups.totalAmount ?? apiObjAfterGroups.total,
          existing.totalAmount,
        ),
        invoicePayload: apiObjAfterGroups,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });

    this.logger.log(
      `${logPrefix} — published invoice=${params.id} providerId=${cwInvoiceId}`,
    );

    return this.invoicesRepo.findOne({ id: params.id, tenantId });
  }

  private async resolveExistingCrunchworkInvoiceId(params: {
    tenantId: string;
    invoice: {
      id: string;
      purchaseOrderId?: string | null;
      sourceExternalReference?: string | null;
    };
  }): Promise<string | undefined> {
    if (params.invoice.sourceExternalReference) {
      return params.invoice.sourceExternalReference;
    }

    if (params.invoice.purchaseOrderId) {
      const siblings = await this.invoicesRepo.findByPurchaseOrder({
        purchaseOrderId: params.invoice.purchaseOrderId,
        tenantId: params.tenantId,
      });
      const siblingRef = siblings.find(
        (row) => row.id !== params.invoice.id && row.sourceExternalReference,
      )?.sourceExternalReference;
      if (siblingRef) return siblingRef;
    }

    // GET /jobs/{id}/invoices is Phase 2 Insurance-only (REST API v17 §3.2.2).
    // Vendor credentials return 500 "Not Authorised!" — do not call it.
    return undefined;
  }

  /**
   * Vendor-tax create clones PO groups with unitCost 0 and completed=false,
   * so CW group totals stay 0. Overlay local PO/WO pricing and POST
   * UpdateInvoiceInput (groups[].items[].completed + unitCost/quantity/tax).
   */
  private async applyCrunchworkInvoiceGroupPricing(params: {
    logPrefix: string;
    connectionId: string;
    cwInvoiceId: string;
    createResponse: Record<string, unknown>;
    purchaseOrderId?: string | null;
    workOrderId?: string | null;
    vendorInvoiceNumber?: string | null;
    issueDate?: string;
    note?: string | null;
  }): Promise<Record<string, unknown>> {
    let cwGroups = crunchworkInvoiceGroupsFromPayload(params.createResponse);
    if (cwGroups.length === 0) {
      const fetched = await this.crunchworkService.getInvoice({
        connectionId: params.connectionId,
        invoiceId: params.cwInvoiceId,
      });
      cwGroups = crunchworkInvoiceGroupsFromPayload(fetched);
    }
    if (cwGroups.length === 0) {
      this.logger.warn(
        `${params.logPrefix} — Crunchwork invoice ${params.cwInvoiceId} has no groups to price`,
      );
      return params.createResponse;
    }

    let localGroups = await this.catalogSelectionService.buildOutboundInvoiceGroups({
      purchaseOrderId: params.purchaseOrderId,
      workOrderId: params.workOrderId,
    });
    const tenantId = this.tenantContext.getTenantId();
    if (this.catalogOutbound && localGroups.length > 0) {
      const enriched = await this.catalogOutbound.enrichPayload({
        tenantId,
        body: { groups: localGroups },
      });
      localGroups = Array.isArray(enriched.groups)
        ? (enriched.groups as Record<string, unknown>[])
        : localGroups;
    }

    const priced = applyLocalPricingToCrunchworkInvoiceGroups({
      cwGroups,
      localGroups,
    });
    const updateGroups = toInvoiceUpdateGroups(priced);
    if (updateGroups.length === 0) {
      this.logger.warn(
        `${params.logPrefix} — no Crunchwork group ids to update on invoice ${params.cwInvoiceId}`,
      );
      return params.createResponse;
    }

    const updateBody: Record<string, unknown> = { groups: updateGroups };
    if (params.vendorInvoiceNumber) {
      updateBody.vendorInvoiceNumber = params.vendorInvoiceNumber;
    }
    if (params.issueDate) updateBody.issueDate = params.issueDate;
    if (params.note) updateBody.note = params.note;

    this.logger.log(
      `${params.logPrefix} — updating Crunchwork invoice ${params.cwInvoiceId} ` +
        `groups=${updateGroups.length} with completed line pricing`,
    );

    const updated = await this.crunchworkService.updateInvoice({
      connectionId: params.connectionId,
      invoiceId: params.cwInvoiceId,
      body: updateBody,
    });
    return updated as Record<string, unknown>;
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    userId?: string;
  }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    if (existing.sourceExternalReference) {
      throw new BadRequestException(
        'Published invoices cannot be edited locally — update via provider sync',
      );
    }

    const data: Partial<InvoiceInsert> = {
      ...(params.userId ? { updatedByUserId: params.userId } : {}),
    };

    if (typeof params.body.statusLookupId === 'string' && params.body.statusLookupId) {
      data.statusLookupId = params.body.statusLookupId;
    }
    if (typeof params.body.invoiceNumber === 'string') {
      data.invoiceNumber = params.body.invoiceNumber || null;
    }
    if (typeof params.body.note === 'string' || typeof params.body.comments === 'string') {
      data.comments =
        (params.body.note as string | undefined) ??
        (params.body.comments as string | undefined) ??
        null;
    }
    if (params.body.totalAmount != null) {
      data.totalAmount = String(params.body.totalAmount);
    }
    if (typeof params.body.issueDate === 'string' && params.body.issueDate) {
      data.issueDate = new Date(params.body.issueDate);
    }

    const updated = await this.invoicesRepo.update({
      id: params.id,
      data,
    });

    if (this.outboundEvents && data.statusLookupId && data.statusLookupId !== existing.statusLookupId) {
      this.checkAndEmitInvoiceApproved({
        invoiceId: params.id,
        statusLookupId: data.statusLookupId,
        jobId: (existing.jobId ?? '') as string,
        purchaseOrderId: (existing.purchaseOrderId as string) ?? undefined,
      }).catch(() => {});
    }

    return updated;
  }

  private async checkAndEmitInvoiceApproved(params: {
    invoiceId: string;
    statusLookupId: string;
    jobId: string;
    purchaseOrderId?: string;
  }): Promise<void> {
    if (!this.outboundEvents || !params.jobId) return;

    try {
      const tenantId = this.tenantContext.getTenantId();
      const lookup = await this.lookupsRepo.findOne({
        id: params.statusLookupId,
        tenantId,
      });
      const name = (lookup?.name ?? '').toLowerCase();

      if (name === 'approved') {
        this.outboundEvents.emitInvoiceApproved({
          invoiceId: params.invoiceId,
          jobId: params.jobId,
          tenantId,
          purchaseOrderId: params.purchaseOrderId,
        }).catch(() => {});
      }
    } catch (err) {
      this.logger.warn(
        `InvoicesService.checkAndEmitInvoiceApproved — failed: ${(err as Error).message}`,
      );
    }
  }
}
