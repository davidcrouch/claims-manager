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
import { preferExistingAmount } from './invoice-publish.utils';

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
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
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
    if (existing.sourceExternalReference) {
      throw new BadRequestException('Invoice already published');
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

    const cwBody: Record<string, unknown> = {
      purchaseOrderId: providerPurchaseOrderId,
      // CreateVendorTaxInvoiceInput — CW resolves this to a Vendor Tax Invoice.
      // Omitting invoiceType causes upstream: Cannot read properties of undefined (reading 'externalReference').
      invoiceType: { externalReference: 'Invoice' },
    };
    if (existing.invoiceNumber) cwBody.invoiceNumber = existing.invoiceNumber;
    if (existing.issueDate) {
      cwBody.issueDate =
        existing.issueDate instanceof Date
          ? existing.issueDate.toISOString()
          : String(existing.issueDate);
    }
    if (existing.comments) cwBody.comments = existing.comments;
    if (existing.totalTax != null) cwBody.totalTax = Number(existing.totalTax);
    if (existing.totalAmount != null) cwBody.total = Number(existing.totalAmount);

    this.logger.log(
      `${logPrefix} — pushing invoice=${params.id} to provider connectionId=${connectionId} purchaseOrderId=${providerPurchaseOrderId} invoiceType=Invoice`,
    );

    const apiInvoice = await this.crunchworkService.createInvoice({
      connectionId,
      body: cwBody,
    });
    const apiObj = apiInvoice as Record<string, unknown>;
    const cwInvoiceId = apiObj.id as string | undefined;
    if (!cwInvoiceId) {
      throw new BadRequestException(
        'Provider did not return an invoice id after publish',
      );
    }

    const submittedStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: 'Submitted',
    });

    // UI titles use invoiceNumber; CW returns a display name plus a numeric invoiceNumber.
    const cwInvoiceNumber =
      (typeof apiObj.name === 'string' && apiObj.name.trim() ? apiObj.name.trim() : null) ??
      (apiObj.invoiceNumber != null ? String(apiObj.invoiceNumber) : null);

    await this.invoicesRepo.update({
      id: params.id,
      data: {
        sourceExternalReference: cwInvoiceId,
        statusLookupId: submittedStatusId ?? existing.statusLookupId,
        invoiceNumber: cwInvoiceNumber ?? existing.invoiceNumber,
        subTotal: preferExistingAmount(apiObj.subTotal, existing.subTotal),
        totalTax: preferExistingAmount(apiObj.totalTax, existing.totalTax),
        totalAmount: preferExistingAmount(apiObj.totalAmount ?? apiObj.total, existing.totalAmount),
        invoicePayload: apiInvoice as Record<string, unknown>,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });

    this.logger.log(
      `${logPrefix} — published invoice=${params.id} providerId=${cwInvoiceId}`,
    );

    return this.invoicesRepo.findOne({ id: params.id, tenantId });
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
