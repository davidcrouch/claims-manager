import { Injectable, Optional, BadRequestException, Logger, Inject } from '@nestjs/common';
import {
  InvoicesRepository,
  WorkOrdersRepository,
  PurchaseOrdersRepository,
  LookupsRepository,
  JobsRepository,
  InvoicePaymentsRepository,
  UsersRepository,
  ContactsRepository,
  type InvoiceInsert,
  type InvoiceViewRow,
  type InvoicePaymentRow,
  type JobRow,
  type JobViewRow,
} from '../../database/repositories';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../database/drizzle.module';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { LookupResolver } from '../external/lookup-resolver.service';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';
import { RecordNumberService } from '../../common/record-number/record-number.service';
import { attachJobSummaries } from '../../common/attach-job-summaries';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { CatalogOutboundService } from '../catalog/services/catalog-outbound.service';
import { OutboundSyncService } from '../domain/outbound/outbound-sync.service';
import {
  applyInvoicedAmountOverridesToGroups,
  applyLocalPricingToCrunchworkInvoiceGroups,
  buildCrunchworkVendorTaxInvoiceCreateBody,
  computeProgressInvoiceMoney,
  crunchworkInvoiceGroupsFromPayload,
  mergeInvoicedAmountMaps,
  preferExistingAmount,
  shouldUseCrunchworkProgressInvoice,
  sumLocalGroupsInclusiveTotal,
  toInvoiceUpdateGroups,
  type CrunchworkInvoiceKind,
} from './invoice-publish.utils';

const INVOICE_STATUS = {
  DRAFT: 'Draft',
  REVIEWED: 'Reviewed',
  INVOICED: 'Invoiced',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
} as const;

export type InvoiceRecipientType = 'insurer' | 'insured' | 'other';

function parseRecipientType(raw: unknown): InvoiceRecipientType | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'insurer' || v === 'insured' || v === 'other') return v;
  return null;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger('InvoicesService');

  constructor(
    private readonly invoicesRepo: InvoicesRepository,
    private readonly invoicePaymentsRepo: InvoicePaymentsRepository,
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly usersRepo: UsersRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    private readonly lookupResolver: LookupResolver,
    private readonly recordNumberService: RecordNumberService,
    private readonly catalogSelectionService: CatalogSelectionService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional() private readonly catalogOutbound?: CatalogOutboundService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
    @Optional() private readonly outboundSync?: OutboundSyncService,
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

  /** External jobs sync to an insurance provider (e.g. Crunchwork); internal/direct do not. */
  private isExternalJob(job: JobViewRow | JobRow | null | undefined): boolean {
    if (!job) return false;
    const connectionId = (job as JobViewRow).connectionId;
    if (!connectionId) return false;
    const code = (job as JobViewRow).connectionProviderCode;
    if (!code || code === 'direct' || code === 'internal') return false;
    return true;
  }

  private async resolveInvoiceJob(params: {
    tenantId: string;
    jobId?: string | null;
    workOrderId?: string | null;
  }): Promise<JobViewRow | null> {
    let jobId = params.jobId ?? null;
    if (!jobId && params.workOrderId) {
      const wo = await this.workOrdersRepo.findOne({
        id: params.workOrderId,
        tenantId: params.tenantId,
      });
      jobId = wo?.jobId ?? null;
    }
    if (!jobId) return null;
    return this.jobsRepo.findOne({ id: jobId, tenantId: params.tenantId });
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
    workOrderId?: string;
    jobId?: string;
    jobIds?: string[];
    status?: string;
    statusId?: string;
    search?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.invoicesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      purchaseOrderId: params.purchaseOrderId,
      workOrderId: params.workOrderId,
      jobId: params.jobId,
      jobIds: params.jobIds,
      status: params.status,
      statusId: params.statusId,
      search: params.search,
      sort: params.sort,
    });
    return {
      data: await attachJobSummaries({
        tenantId,
        rows: result.data.map((row) => this.shapeInvoice(row)),
        jobsRepo: this.jobsRepo,
      }),
      total: result.total,
    };
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.invoicesRepo.findOne({ id: params.id, tenantId });
    if (!row) return null;
    const payments = await this.invoicePaymentsRepo.findByInvoice({
      invoiceId: params.id,
      tenantId,
    });
    const recipientContact = await this.loadRecipientContact({
      tenantId,
      contactId: row.recipientContactId,
    });
    return this.shapeInvoice(row, payments, recipientContact);
  }

  async findByPurchaseOrder(params: { purchaseOrderId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await this.invoicesRepo.findByPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      tenantId,
    });
    return rows.map((row) => this.shapeInvoice(row));
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await this.invoicesRepo.findByJob({
      jobId: params.jobId,
      tenantId,
    });
    return rows.map((row) => this.shapeInvoice(row));
  }

  private shapeInvoice(
    row: InvoiceViewRow,
    payments: InvoicePaymentRow[] = [],
    recipientContact?: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null,
  ) {
    const { statusName, statusExternalReference, ...rest } = row;
    const contactName = recipientContact
      ? [recipientContact.firstName, recipientContact.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        recipientContact.email ||
        null
      : null;
    return {
      ...rest,
      status: row.statusLookupId
        ? {
            id: row.statusLookupId,
            name: statusName ?? undefined,
            externalReference: statusExternalReference ?? undefined,
          }
        : undefined,
      payments: payments.map((payment) => this.shapePayment(payment)),
      recipientContact: recipientContact
        ? {
            id: recipientContact.id,
            name: contactName,
            email: recipientContact.email ?? null,
          }
        : null,
    };
  }

  private shapePayment(payment: InvoicePaymentRow) {
    const receivedAt =
      payment.receivedAt instanceof Date
        ? payment.receivedAt.toISOString()
        : String(payment.receivedAt);
    const createdAt =
      payment.createdAt instanceof Date
        ? payment.createdAt.toISOString()
        : String(payment.createdAt);
    return {
      id: payment.id,
      amount: payment.amount,
      receivedAt,
      createdByUserId: payment.createdByUserId,
      createdByName: payment.createdByName,
      createdAt,
    };
  }

  private async loadRecipientContact(params: {
    tenantId: string;
    contactId?: string | null;
  }) {
    if (!params.contactId) return null;
    return this.contactsRepo.findOne({
      id: params.contactId,
      tenantId: params.tenantId,
    });
  }

  private async loadShaped(params: { id: string; tenantId: string }) {
    const row = await this.invoicesRepo.findOne({
      id: params.id,
      tenantId: params.tenantId,
    });
    if (!row) return null;
    const payments = await this.invoicePaymentsRepo.findByInvoice({
      invoiceId: params.id,
      tenantId: params.tenantId,
    });
    const recipientContact = await this.loadRecipientContact({
      tenantId: params.tenantId,
      contactId: row.recipientContactId,
    });
    return this.shapeInvoice(row, payments, recipientContact);
  }

  private invoiceStatusName(row: {
    statusName?: string | null;
    sourceExternalReference?: string | null;
  }): string {
    const name = (row.statusName ?? '').trim();
    if (name) return name;
    return row.sourceExternalReference ? '' : INVOICE_STATUS.DRAFT;
  }

  private isInvoicedStatus(name: string): boolean {
    const normalised = name.trim().toLowerCase();
    return (
      normalised === INVOICE_STATUS.INVOICED.toLowerCase() ||
      normalised === 'submitted'
    );
  }

  private isPaidStatus(name: string): boolean {
    return name.trim().toLowerCase() === INVOICE_STATUS.PAID.toLowerCase();
  }

  private isPartiallyPaidStatus(name: string): boolean {
    return name.trim().toLowerCase() === INVOICE_STATUS.PARTIALLY_PAID.toLowerCase();
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async resolvePaymentAuthorName(userId?: string): Promise<string | null> {
    if (!userId) return null;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId,
      )
    ) {
      return null;
    }
    try {
      const user = await this.usersRepo.findById({ id: userId });
      const name = user?.name?.trim();
      if (name) return name;
      const email = user?.email?.trim();
      return email || null;
    } catch {
      return null;
    }
  }

  private parsePaymentAmount(raw: unknown): number {
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      throw new BadRequestException('Payment amount must be a number');
    }
    const rounded = this.roundMoney(value);
    if (rounded <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }
    return rounded;
  }

  private sumPayments(payments: InvoicePaymentRow[]): number {
    return this.roundMoney(
      payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    );
  }

  private statusFromReceived(params: {
    totalAmount: number;
    received: number;
  }): (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS] {
    if (params.received <= 0) return INVOICE_STATUS.INVOICED;
    const fullyPaid =
      params.totalAmount <= 0
        ? params.received > 0
        : Math.round(params.received * 100) >= Math.round(params.totalAmount * 100);
    return fullyPaid ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIALLY_PAID;
  }

  private latestReceivedAt(payments: InvoicePaymentRow[]): Date | null {
    const first = payments[0];
    if (!first?.receivedAt) return null;
    return first.receivedAt instanceof Date
      ? first.receivedAt
      : new Date(first.receivedAt);
  }

  private async applyPaymentTotals(params: {
    invoiceId: string;
    tenantId: string;
    totalAmount: number;
    payments: InvoicePaymentRow[];
    userId?: string;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const received = this.sumPayments(params.payments);
    const nextStatus = this.statusFromReceived({
      totalAmount: params.totalAmount,
      received,
    });
    const nextStatusId = await this.resolveStatusLookupId({
      tenantId: params.tenantId,
      name: nextStatus,
    });
    if (!nextStatusId) {
      throw new BadRequestException(
        `Could not resolve ${nextStatus} invoice status`,
      );
    }
    await this.invoicesRepo.update({
      id: params.invoiceId,
      data: {
        statusLookupId: nextStatusId,
        amountReceived: String(received),
        receivedDate: this.latestReceivedAt(params.payments),
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
      tx: params.tx,
    });
    return nextStatus;
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
      name: INVOICE_STATUS.DRAFT,
    });
    if (!draftStatusId) {
      throw new BadRequestException('Could not resolve Draft invoice status');
    }

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

      const invoicedAmountsRaw = body.invoicedAmounts;
      const invoicedAmounts =
        invoicedAmountsRaw &&
        typeof invoicedAmountsRaw === 'object' &&
        !Array.isArray(invoicedAmountsRaw)
          ? (invoicedAmountsRaw as Record<string, number>)
          : undefined;

      if (invoicedAmounts && totalAmount != null) {
        const sum = Object.values(invoicedAmounts).reduce((acc, v) => {
          const n = typeof v === 'number' ? v : Number(v);
          return Number.isFinite(n) ? acc + n : acc;
        }, 0);
        const header = Number(totalAmount);
        if (Number.isFinite(header) && Math.abs(sum - header) > 0.05) {
          this.logger.warn(
            `${logPrefix} — invoicedAmounts sum=${sum} differs from totalAmount=${header}`,
          );
        }
      }

      const recipientType = parseRecipientType(body.recipientType);
      if (!recipientType) {
        throw new BadRequestException(
          'recipientType is required (insurer, insured, or other)',
        );
      }

      const recipientContactIdRaw =
        typeof body.recipientContactId === 'string' && body.recipientContactId
          ? body.recipientContactId
          : null;

      if (recipientType === 'insurer') {
        const job = await this.resolveInvoiceJob({
          tenantId,
          jobId: jobId ?? null,
          workOrderId: workOrderId ?? null,
        });
        if (!this.isExternalJob(job)) {
          throw new BadRequestException(
            'Insurer recipient is only available for Crunchwork / external jobs',
          );
        }
      } else {
        if (!recipientContactIdRaw) {
          throw new BadRequestException(
            'recipientContactId is required for insured and other recipients',
          );
        }
        const contact = await this.contactsRepo.findOne({
          id: recipientContactIdRaw,
          tenantId,
        });
        if (!contact) {
          throw new BadRequestException('Recipient contact not found');
        }
        if (!contact.email?.trim()) {
          throw new BadRequestException(
            'Recipient contact must have an email address',
          );
        }
      }

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
        recipientType,
        recipientContactId:
          recipientType === 'insurer' ? null : recipientContactIdRaw,
        invoicePayload: {
          workOrderId,
          purchaseOrderId,
          dueDate: body.dueDate ?? null,
          ...(invoicedAmounts ? { invoicedAmounts } : {}),
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

      const inserted = await this.invoicesRepo.create({ data: insertData, tx });
      return this.shapeInvoice({
        ...inserted,
        statusName: INVOICE_STATUS.DRAFT,
        statusExternalReference: INVOICE_STATUS.DRAFT,
      });
    });
  }

  /**
   * Internal approval: Draft → Reviewed. Requires a positive amount.
   */
  async approve(params: { id: string; userId?: string }) {
    const logPrefix = 'InvoicesService.approve';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.invoicesRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Invoice not found');
    }
    if (existing.sourceExternalReference) {
      throw new BadRequestException(
        'Published invoices cannot be approved locally',
      );
    }

    const statusName = this.invoiceStatusName(existing);
    if (statusName.toLowerCase() !== INVOICE_STATUS.DRAFT.toLowerCase()) {
      throw new BadRequestException(
        'Only draft invoices can be approved',
      );
    }

    const amount = Number(existing.totalAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        'Invoice amount must be greater than 0 to approve',
      );
    }

    const reviewedStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: INVOICE_STATUS.REVIEWED,
    });
    if (!reviewedStatusId) {
      throw new BadRequestException(
        'Could not resolve Reviewed invoice status',
      );
    }

    this.logger.log(
      `${logPrefix} — invoice=${params.id} amount=${amount} Draft → Reviewed`,
    );

    await this.invoicesRepo.update({
      id: params.id,
      data: {
        statusLookupId: reviewedStatusId,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });

    return this.loadShaped({ id: params.id, tenantId });
  }

  /**
   * Return a reviewed invoice to Draft so it can be edited and re-approved.
   */
  async returnToDraft(params: { id: string; userId?: string }) {
    const logPrefix = 'InvoicesService.returnToDraft';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.invoicesRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Invoice not found');
    }
    if (existing.sourceExternalReference) {
      throw new BadRequestException(
        'Published invoices cannot be returned to draft',
      );
    }

    const statusName = this.invoiceStatusName(existing);
    if (statusName.toLowerCase() !== INVOICE_STATUS.REVIEWED.toLowerCase()) {
      throw new BadRequestException(
        'Only reviewed invoices can be returned to draft',
      );
    }

    const draftStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: INVOICE_STATUS.DRAFT,
    });
    if (!draftStatusId) {
      throw new BadRequestException('Could not resolve Draft invoice status');
    }

    this.logger.log(
      `${logPrefix} — invoice=${params.id} Reviewed → Draft`,
    );

    await this.invoicesRepo.update({
      id: params.id,
      data: {
        statusLookupId: draftStatusId,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });

    return this.loadShaped({ id: params.id, tenantId });
  }

  /**
   * Record a payment amount. Invoiced/partially paid → Partially Paid when
   * some amount is received, or Paid when received total covers the invoice.
   */
  async receivePayment(params: { id: string; amount: unknown; userId?: string }) {
    const logPrefix = 'InvoicesService.receivePayment';
    const tenantId = this.tenantContext.getTenantId();
    const paymentAmount = this.parsePaymentAmount(params.amount);
    const existing = await this.invoicesRepo.findOne({
      id: params.id,
      tenantId,
    });
    if (!existing) {
      throw new BadRequestException('Invoice not found');
    }

    const statusName = this.invoiceStatusName(existing);
    if (this.isPaidStatus(statusName)) {
      throw new BadRequestException('Invoice is already marked as paid');
    }

    const published =
      this.isInvoicedStatus(statusName) ||
      this.isPartiallyPaidStatus(statusName) ||
      Boolean(existing.sourceExternalReference);
    if (!published) {
      throw new BadRequestException(
        'Only published invoices can record received payment',
      );
    }

    const totalAmount = this.roundMoney(Number(existing.totalAmount ?? 0));
    const receivedAt = new Date();
    const createdByName = await this.resolvePaymentAuthorName(params.userId);

    await this.db.transaction(async (tx) => {
      await this.invoicePaymentsRepo.create({
        data: {
          tenantId,
          invoiceId: params.id,
          amount: String(paymentAmount),
          receivedAt,
          createdByUserId: params.userId ?? null,
          createdByName,
        },
        tx,
      });
      const payments = await this.invoicePaymentsRepo.findByInvoice({
        invoiceId: params.id,
        tenantId,
        tx,
      });
      const nextStatus = await this.applyPaymentTotals({
        invoiceId: params.id,
        tenantId,
        totalAmount,
        payments,
        userId: params.userId,
        tx,
      });
      this.logger.log(
        `${logPrefix} — invoice=${params.id} amount=${paymentAmount} received=${this.sumPayments(payments)}/${totalAmount} ${statusName || 'published'} → ${nextStatus}`,
      );
    });

    return this.loadShaped({ id: params.id, tenantId });
  }

  /**
   * Revise a recorded payment amount and refresh invoice totals/status.
   */
  async updatePayment(params: {
    id: string;
    paymentId: string;
    amount: unknown;
    userId?: string;
  }) {
    const logPrefix = 'InvoicesService.updatePayment';
    const tenantId = this.tenantContext.getTenantId();
    const paymentAmount = this.parsePaymentAmount(params.amount);
    const existing = await this.invoicesRepo.findOne({
      id: params.id,
      tenantId,
    });
    if (!existing) {
      throw new BadRequestException('Invoice not found');
    }

    const payment = await this.invoicePaymentsRepo.findOne({
      id: params.paymentId,
      invoiceId: params.id,
      tenantId,
    });
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    const totalAmount = this.roundMoney(Number(existing.totalAmount ?? 0));
    await this.db.transaction(async (tx) => {
      await this.invoicePaymentsRepo.update({
        id: params.paymentId,
        tenantId,
        data: { amount: String(paymentAmount) },
        tx,
      });
      const payments = await this.invoicePaymentsRepo.findByInvoice({
        invoiceId: params.id,
        tenantId,
        tx,
      });
      const nextStatus = await this.applyPaymentTotals({
        invoiceId: params.id,
        tenantId,
        totalAmount,
        payments,
        userId: params.userId,
        tx,
      });
      this.logger.log(
        `${logPrefix} — invoice=${params.id} payment=${params.paymentId} amount=${paymentAmount} received=${this.sumPayments(payments)}/${totalAmount} → ${nextStatus}`,
      );
    });

    return this.loadShaped({ id: params.id, tenantId });
  }

  /**
   * Remove a recorded payment and refresh invoice totals/status.
   */
  async deletePayment(params: {
    id: string;
    paymentId: string;
    userId?: string;
  }) {
    const logPrefix = 'InvoicesService.deletePayment';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.invoicesRepo.findOne({
      id: params.id,
      tenantId,
    });
    if (!existing) {
      throw new BadRequestException('Invoice not found');
    }

    const payment = await this.invoicePaymentsRepo.findOne({
      id: params.paymentId,
      invoiceId: params.id,
      tenantId,
    });
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    const totalAmount = this.roundMoney(Number(existing.totalAmount ?? 0));
    await this.db.transaction(async (tx) => {
      await this.invoicePaymentsRepo.delete({
        id: params.paymentId,
        invoiceId: params.id,
        tenantId,
        tx,
      });
      const payments = await this.invoicePaymentsRepo.findByInvoice({
        invoiceId: params.id,
        tenantId,
        tx,
      });
      const nextStatus = await this.applyPaymentTotals({
        invoiceId: params.id,
        tenantId,
        totalAmount,
        payments,
        userId: params.userId,
        tx,
      });
      this.logger.log(
        `${logPrefix} — invoice=${params.id} payment=${params.paymentId} received=${this.sumPayments(payments)}/${totalAmount} → ${nextStatus}`,
      );
    });

    return this.loadShaped({ id: params.id, tenantId });
  }

  /**
   * Local-only publish (Reviewed → Invoiced) used by insured/other email delivery.
   * Does not enqueue Crunchwork outbound sync.
   */
  async publishLocal(params: { id: string; userId?: string }) {
    const logPrefix = 'InvoicesService.publishLocal';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.invoicesRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Invoice not found');
    }

    const currentStatus = this.invoiceStatusName(existing);
    const statusLower = currentStatus.toLowerCase();
    if (statusLower === INVOICE_STATUS.INVOICED.toLowerCase()) {
      return this.loadShaped({ id: params.id, tenantId });
    }
    if (statusLower !== INVOICE_STATUS.REVIEWED.toLowerCase()) {
      throw new BadRequestException(
        'Invoice must be in Reviewed status before publishing',
      );
    }

    const invoicedStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: INVOICE_STATUS.INVOICED,
    });
    if (!invoicedStatusId) {
      throw new BadRequestException('Could not resolve Invoiced invoice status');
    }

    this.logger.log(
      `${logPrefix} — email-path local publish invoice=${params.id} Reviewed → Invoiced`,
    );
    await this.invoicesRepo.update({
      id: params.id,
      data: {
        statusLookupId: invoicedStatusId,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });
    return this.loadShaped({ id: params.id, tenantId });
  }

  /**
   * Publish a reviewed invoice. Internal jobs lock locally (Invoiced).
   * External jobs enqueue outbound sync to the provider (e.g. Crunchwork).
   * Insured/other recipients must use the email send-request path.
   */
  async publish(params: { id: string; userId?: string }) {
    const logPrefix = 'InvoicesService.publish';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.invoicesRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Invoice not found');
    }

    const recipientType = parseRecipientType(existing.recipientType);

    if (recipientType === 'insured' || recipientType === 'other') {
      throw new BadRequestException(
        'This invoice is set for email delivery. Use the email publish flow instead of insurer submit.',
      );
    }

    const currentStatus = this.invoiceStatusName(existing);
    const statusLower = currentStatus.toLowerCase();
    const syncFailed = existing.syncStatus === 'failed';
    const canPublish =
      statusLower === INVOICE_STATUS.REVIEWED.toLowerCase() ||
      (syncFailed &&
        (statusLower === INVOICE_STATUS.INVOICED.toLowerCase() ||
          statusLower === INVOICE_STATUS.REVIEWED.toLowerCase()));
    if (!canPublish) {
      throw new BadRequestException(
        syncFailed
          ? 'Invoice sync failed but status is not recoverable for republish'
          : 'Invoice must be in Reviewed status before publishing',
      );
    }

    const invoicedStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: INVOICE_STATUS.INVOICED,
    });
    if (!invoicedStatusId) {
      throw new BadRequestException('Could not resolve Invoiced invoice status');
    }

    const job = await this.resolveInvoiceJob({
      tenantId,
      jobId: existing.jobId,
      workOrderId: existing.workOrderId,
    });

    if (recipientType === 'insurer' && !this.isExternalJob(job)) {
      throw new BadRequestException(
        'Cannot publish to insurer: job is not linked to an external provider',
      );
    }

    // Local lock when no external job, or legacy invoices without recipientType on internal jobs
    if (!this.isExternalJob(job)) {
      this.logger.log(
        `${logPrefix} — internal publish invoice=${params.id} Reviewed → Invoiced`,
      );
      await this.invoicesRepo.update({
        id: params.id,
        data: {
          statusLookupId: invoicedStatusId,
          ...(params.userId ? { updatedByUserId: params.userId } : {}),
        },
      });
      return this.loadShaped({ id: params.id, tenantId });
    }

    // External / insurer path (also legacy external invoices without recipientType)
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
    if (!this.outboundSync) {
      this.logger.error(
        `InvoicesService.publish — OutboundSyncService not available, cannot send invoice ${params.id} to provider`,
      );
      throw new BadRequestException(
        'Cannot publish to provider: outbound sync is not configured',
      );
    }

    const reusedCwInvoiceId = await this.resolveExistingCrunchworkInvoiceId({
      tenantId,
      invoice: existing,
    });

    let localGroups = await this.catalogSelectionService.buildOutboundInvoiceGroups({
      purchaseOrderId: existing.purchaseOrderId,
      workOrderId: existing.workOrderId,
    });
    if (this.catalogOutbound && localGroups.length > 0) {
      const enriched = await this.catalogOutbound.enrichPayload({
        tenantId,
        body: { groups: localGroups },
      });
      localGroups = Array.isArray(enriched.groups)
        ? (enriched.groups as Record<string, unknown>[])
        : localGroups;
    }

    const payloadInvoiced = (existing.invoicePayload as Record<string, unknown> | null)
      ?.invoicedAmounts;
    const currentInvoicedAmounts =
      payloadInvoiced &&
      typeof payloadInvoiced === 'object' &&
      !Array.isArray(payloadInvoiced)
        ? (payloadInvoiced as Record<string, number>)
        : undefined;

    const priorPayload =
      existing.invoicePayload &&
      typeof existing.invoicePayload === 'object' &&
      !Array.isArray(existing.invoicePayload)
        ? (existing.invoicePayload as Record<string, unknown>)
        : {};
    const storedKind =
      priorPayload.cwInvoiceKind === 'progress' || priorPayload.cwInvoiceKind === 'vendorTax'
        ? (priorPayload.cwInvoiceKind as CrunchworkInvoiceKind)
        : undefined;
    // Only trust a stored kind after a successful CW publish.
    const lockedKind = existing.sourceExternalReference ? storedKind : undefined;

    const invoiceTotal = Number(existing.totalAmount ?? 0);
    const billableFromGroups = sumLocalGroupsInclusiveTotal(localGroups);
    let billableTotal = billableFromGroups;
    if (!(billableTotal > 0) && existing.workOrderId) {
      const wo = await this.workOrdersRepo.findOne({
        id: existing.workOrderId,
        tenantId,
      });
      const woTotal = Number(wo?.totalAmount ?? wo?.adjustedTotal ?? 0);
      if (Number.isFinite(woTotal) && woTotal > 0) billableTotal = woTotal;
    }

    const hasPriorPublishedSibling = await this.hasPriorPublishedSiblingInvoice({
      tenantId,
      invoiceId: params.id,
      purchaseOrderId: existing.purchaseOrderId,
    });

    // Staging IAG: Partial Invoicing off + /progress-invoices 403. Always push
    // via vendor-tax create/update; 2nd+ claims update the linked CW invoice
    // with cumulative line amounts from all published siblings.
    const cwInvoiceKind: CrunchworkInvoiceKind = 'vendorTax';
    const invoicedAmounts =
      (await this.resolveCumulativeInvoicedAmounts({
        tenantId,
        invoiceId: params.id,
        purchaseOrderId: existing.purchaseOrderId,
        current: currentInvoicedAmounts,
      })) ?? currentInvoicedAmounts;

    const progressMoney =
      hasPriorPublishedSibling ||
      shouldUseCrunchworkProgressInvoice({
        invoiceTotal,
        billableTotal,
        hasPriorPublishedSibling,
      })
        ? computeProgressInvoiceMoney({
            groups: localGroups,
            invoicedAmounts,
            headerTotal: invoiceTotal,
          })
        : null;

    this.logger.log(
      `${logPrefix} — publishing invoice=${params.id} via outbox connectionId=${connectionId} ` +
        `purchaseOrderId=${providerPurchaseOrderId} cwInvoiceKind=${cwInvoiceKind}` +
        (lockedKind ? ` lockedKind=${lockedKind}` : '') +
        (hasPriorPublishedSibling ? ' hasPriorPublishedSibling=true' : '') +
        (reusedCwInvoiceId ? ` reusingCwInvoiceId=${reusedCwInvoiceId}` : '') +
        ` billableTotal=${billableTotal} invoiceTotal=${invoiceTotal}` +
        (progressMoney
          ? ` progressTotal=${progressMoney.total} progressTax=${progressMoney.totalTax}`
          : ''),
    );

    const nextPayload: Record<string, unknown> = {
      ...priorPayload,
      cwInvoiceKind,
      ...(invoicedAmounts ? { invoicedAmounts } : {}),
    };

    await this.invoicesRepo.update({
      id: params.id,
      data: {
        statusLookupId: invoicedStatusId ?? existing.statusLookupId,
        syncStatus: 'pending',
        invoicePayload: nextPayload,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });

    try {
      await this.outboundSync.cancelPending({
        tenantId,
        entityType: 'invoice',
        entityId: params.id,
        tx: this.outboundSync['db'],
      });
      await this.outboundSync.enqueue({
        tenantId,
        connectionId,
        entityType: 'invoice',
        entityId: params.id,
        action: 'publish',
        payload: {
          purchaseOrderId: providerPurchaseOrderId,
          reusedCwInvoiceId,
          invoiceId: params.id,
          cwInvoiceKind,
          localGroups,
          ...(invoicedAmounts ? { invoicedAmounts } : {}),
          ...(progressMoney
            ? {
                total: progressMoney.total,
                totalTax: progressMoney.totalTax,
              }
            : {}),
          vendorInvoiceNumber: existing.invoiceNumber ?? existing.internalNumber ?? null,
          issueDate: existing.issueDate
            ? new Date(existing.issueDate as string | Date).toISOString()
            : undefined,
          note: existing.comments ?? null,
        },
        sourceEvent: 'api:publish',
        idempotencyKey: `invoice:${params.id}:publish:${cwInvoiceKind}`,
        tx: this.outboundSync['db'],
      });
    } catch (err) {
      this.logger.error(
        `InvoicesService.publish — failed to enqueue outbound sync for invoice ${params.id}: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadRequestException(
        `Failed to queue invoice for Crunchwork: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.loadShaped({ id: params.id, tenantId });
  }

  private async hasPriorPublishedSiblingInvoice(params: {
    tenantId: string;
    invoiceId: string;
    purchaseOrderId?: string | null;
  }): Promise<boolean> {
    if (!params.purchaseOrderId) return false;

    const rejected = new Set(['rejected', 'declined', 'cancelled', 'canceled']);
    const published = new Set([
      INVOICE_STATUS.INVOICED.toLowerCase(),
      INVOICE_STATUS.PARTIALLY_PAID.toLowerCase(),
      INVOICE_STATUS.PAID.toLowerCase(),
    ]);

    const siblings = await this.invoicesRepo.findByPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      tenantId: params.tenantId,
    });

    return siblings.some((row) => {
      if (row.id === params.invoiceId) return false;
      const status = (row.statusName ?? '').trim().toLowerCase();
      if (rejected.has(status)) return false;
      if (row.sourceExternalReference) return true;
      return published.has(status);
    });
  }

  /**
   * Prefer this invoice's CW id. If none, adopt a sibling's CW id on the same PO.
   * Staging IAG has Partial Invoicing disabled (only one vendor-tax invoice per PO)
   * and POST /progress-invoices returns 403, so 2nd+ local invoices must update
   * the linked CW invoice rather than create another.
   */
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
    if (!params.invoice.purchaseOrderId) return undefined;

    const siblings = await this.invoicesRepo.findByPurchaseOrder({
      purchaseOrderId: params.invoice.purchaseOrderId,
      tenantId: params.tenantId,
    });
    for (const row of siblings) {
      if (row.id === params.invoice.id) continue;
      const cwId = row.sourceExternalReference?.trim();
      if (cwId) return cwId;
    }
    return undefined;
  }

  /** Sum invoicedAmounts across published siblings + this invoice (same PO). */
  private async resolveCumulativeInvoicedAmounts(params: {
    tenantId: string;
    invoiceId: string;
    purchaseOrderId?: string | null;
    current?: Record<string, number>;
  }): Promise<Record<string, number> | undefined> {
    const maps: Array<Record<string, number> | undefined> = [params.current];
    if (params.purchaseOrderId) {
      const siblings = await this.invoicesRepo.findByPurchaseOrder({
        purchaseOrderId: params.purchaseOrderId,
        tenantId: params.tenantId,
      });
      for (const row of siblings) {
        if (row.id === params.invoiceId) continue;
        if (!row.sourceExternalReference) continue;
        const payload =
          row.invoicePayload &&
          typeof row.invoicePayload === 'object' &&
          !Array.isArray(row.invoicePayload)
            ? (row.invoicePayload as Record<string, unknown>)
            : null;
        const amounts = payload?.invoicedAmounts;
        if (amounts && typeof amounts === 'object' && !Array.isArray(amounts)) {
          maps.push(amounts as Record<string, number>);
        }
      }
    }
    return mergeInvoicedAmountMaps(maps);
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
    localGroups?: Record<string, unknown>[];
    invoicedAmounts?: Record<string, number>;
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

    let localGroups =
      params.localGroups && params.localGroups.length > 0
        ? params.localGroups
        : await this.catalogSelectionService.buildOutboundInvoiceGroups({
            purchaseOrderId: params.purchaseOrderId,
            workOrderId: params.workOrderId,
          });
    const tenantId = this.tenantContext.getTenantId();
    if (
      this.catalogOutbound &&
      localGroups.length > 0 &&
      !(params.localGroups && params.localGroups.length > 0)
    ) {
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
    const allocated = applyInvoicedAmountOverridesToGroups({
      groups: priced,
      invoicedAmounts: params.invoicedAmounts,
    });
    const updateGroups = toInvoiceUpdateGroups(allocated);
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

    const nextRecipientType = parseRecipientType(params.body.recipientType);
    if (nextRecipientType) {
      const statusName = this.invoiceStatusName({
        statusName: (existing as { status?: { name?: string } }).status?.name,
        sourceExternalReference: existing.sourceExternalReference,
      });
      const editable =
        statusName.toLowerCase() === INVOICE_STATUS.DRAFT.toLowerCase() ||
        statusName.toLowerCase() === INVOICE_STATUS.REVIEWED.toLowerCase();
      if (!editable) {
        throw new BadRequestException(
          'Recipient can only be changed while the invoice is Draft or Reviewed',
        );
      }
      data.recipientType = nextRecipientType;
      if (nextRecipientType === 'insurer') {
        const job = await this.resolveInvoiceJob({
          tenantId: this.tenantContext.getTenantId(),
          jobId: existing.jobId,
          workOrderId: existing.workOrderId,
        });
        if (!this.isExternalJob(job)) {
          throw new BadRequestException(
            'Insurer recipient is only available for Crunchwork / external jobs',
          );
        }
        data.recipientContactId = null;
      } else if (
        typeof params.body.recipientContactId === 'string' &&
        params.body.recipientContactId
      ) {
        const contact = await this.contactsRepo.findOne({
          id: params.body.recipientContactId,
          tenantId: this.tenantContext.getTenantId(),
        });
        if (!contact?.email?.trim()) {
          throw new BadRequestException(
            'Recipient contact must have an email address',
          );
        }
        data.recipientContactId = params.body.recipientContactId;
      } else {
        throw new BadRequestException(
          'recipientContactId is required for insured and other recipients',
        );
      }
    } else if (
      typeof params.body.recipientContactId === 'string' &&
      params.body.recipientContactId
    ) {
      data.recipientContactId = params.body.recipientContactId;
    }

    if (
      params.body.invoicePayload &&
      typeof params.body.invoicePayload === 'object' &&
      !Array.isArray(params.body.invoicePayload)
    ) {
      data.invoicePayload = params.body.invoicePayload as InvoiceInsert['invoicePayload'];
    }

    await this.invoicesRepo.update({
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

    const tenantId = this.tenantContext.getTenantId();
    return this.loadShaped({ id: params.id, tenantId });
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
