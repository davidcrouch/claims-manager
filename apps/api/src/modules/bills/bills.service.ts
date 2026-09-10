import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  BillsRepository,
  JobsRepository,
  type BillViewRow,
} from '../../database/repositories';
import { attachJobSummaries } from '../../common/attach-job-summaries';
import { TenantContext } from '../../tenant/tenant-context';
import { RecordNumberService } from '../../common/record-number/record-number.service';
import { LookupResolver } from '../external/lookup-resolver.service';

const BILL_STATUS = {
  RECEIVED: 'Received',
  REVIEWED: 'Reviewed',
  REJECTED: 'Rejected',
} as const;

const BILL_DATE_FIELDS = [
  'issueDate',
  'receivedDate',
  'dueDate',
  'paymentDate',
] as const;

const BILL_NUMERIC_FIELDS = ['subTotal', 'totalTax', 'totalAmount'] as const;

function coerceBillWrite(body: Record<string, unknown>): Record<string, unknown> {
  const data = { ...body };
  for (const key of BILL_DATE_FIELDS) {
    const value = data[key];
    if (value === '' || value === null) {
      data[key] = null;
    } else if (typeof value === 'string') {
      const parsed = new Date(value);
      data[key] = Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  for (const key of BILL_NUMERIC_FIELDS) {
    const value = data[key];
    if (value != null && typeof value !== 'string') {
      data[key] = String(value);
    }
  }
  return data;
}

@Injectable()
export class BillsService {
  private readonly logger = new Logger('BillsService');

  constructor(
    private readonly billsRepo: BillsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly tenantContext: TenantContext,
    private readonly recordNumberService: RecordNumberService,
    private readonly lookupResolver: LookupResolver,
  ) {}

  private async resolveStatusLookupId(params: {
    tenantId: string;
    name: string;
  }): Promise<string | null> {
    return (
      (await this.lookupResolver.resolveByName({
        tenantId: params.tenantId,
        domain: 'bill_status',
        name: params.name,
      })) ??
      (await this.lookupResolver.resolve({
        tenantId: params.tenantId,
        domain: 'bill_status',
        externalReference: params.name,
        name: params.name,
        autoCreate: true,
      }))
    );
  }

  private shapeBill(row: BillViewRow) {
    const { statusName, statusExternalReference, ...rest } = row;
    return {
      ...rest,
      status: row.statusLookupId
        ? {
            id: row.statusLookupId,
            name: statusName ?? undefined,
            externalReference: statusExternalReference ?? undefined,
          }
        : undefined,
    };
  }

  private async loadShaped(params: { id: string; tenantId: string }) {
    const row = await this.billsRepo.findOne({
      id: params.id,
      tenantId: params.tenantId,
    });
    return row ? this.shapeBill(row) : null;
  }

  private billStatusName(row: { statusName?: string | null }): string {
    const name = (row.statusName ?? '').trim();
    if (name) return name;
    return BILL_STATUS.RECEIVED;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    purchaseOrderId?: string;
    status?: string;
    vendorId?: string;
    search?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.billsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      jobIds: params.jobIds,
      purchaseOrderId: params.purchaseOrderId,
      status: params.status,
      vendorId: params.vendorId,
      search: params.search,
      sort: params.sort,
    });
    return {
      data: await attachJobSummaries({
        tenantId,
        rows: result.data.map((row) => this.shapeBill(row)),
        jobsRepo: this.jobsRepo,
      }),
      total: result.total,
    };
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.loadShaped({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await this.billsRepo.findByJob({
      jobId: params.jobId,
      tenantId,
    });
    return rows.map((row) => this.shapeBill(row));
  }

  async findByPurchaseOrder(params: { purchaseOrderId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await this.billsRepo.findByPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      tenantId,
    });
    return rows.map((row) => this.shapeBill(row));
  }

  async findByVendor(params: { vendorId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await this.billsRepo.findByVendor({
      vendorId: params.vendorId,
      tenantId,
    });
    return rows.map((row) => this.shapeBill(row));
  }

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const logPrefix = 'BillsService.create';
    const tenantId = this.tenantContext.getTenantId();
    const {
      createdByUserId: _c,
      updatedByUserId: _u,
      billNumber: bodyBillNumber,
      invoicedAmounts: invoicedAmountsRaw,
      billPayload: bodyBillPayload,
      status: statusBody,
      ...rest
    } = params.body;

    const invoicedAmounts =
      invoicedAmountsRaw &&
      typeof invoicedAmountsRaw === 'object' &&
      !Array.isArray(invoicedAmountsRaw)
        ? (invoicedAmountsRaw as Record<string, number>)
        : undefined;

    const existingPayload =
      bodyBillPayload &&
      typeof bodyBillPayload === 'object' &&
      !Array.isArray(bodyBillPayload)
        ? (bodyBillPayload as Record<string, unknown>)
        : {};

    if (invoicedAmounts && rest.totalAmount != null) {
      const sum = Object.values(invoicedAmounts).reduce((acc, v) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? acc + n : acc;
      }, 0);
      const header = Number(rest.totalAmount);
      if (Number.isFinite(header) && Math.abs(sum - header) > 0.05) {
        this.logger.warn(
          `${logPrefix} — invoicedAmounts sum=${sum} differs from totalAmount=${header}`,
        );
      }
    }

    let statusLookupId =
      typeof rest.statusLookupId === 'string' && rest.statusLookupId
        ? rest.statusLookupId
        : null;
    const statusName =
      statusBody &&
      typeof statusBody === 'object' &&
      !Array.isArray(statusBody) &&
      typeof (statusBody as { name?: string }).name === 'string'
        ? (statusBody as { name: string }).name
        : BILL_STATUS.RECEIVED;
    if (!statusLookupId) {
      statusLookupId = await this.resolveStatusLookupId({
        tenantId,
        name: statusName,
      });
    }
    if (!statusLookupId) {
      throw new BadRequestException('Could not resolve Received bill status');
    }

    const billNumber = await this.recordNumberService.resolve({
      tenantId,
      entity: 'bill',
      explicit: bodyBillNumber,
    });
    this.logger.log(
      `${logPrefix} — status=${statusName} billNumber=${billNumber}`,
    );
    const inserted = await this.billsRepo.create({
      data: {
        ...coerceBillWrite(rest),
        billNumber,
        tenantId,
        statusLookupId,
        billPayload: {
          ...existingPayload,
          ...(invoicedAmounts ? { invoicedAmounts } : {}),
        },
        createdByUserId: params.userId ?? null,
        updatedByUserId: params.userId ?? null,
      } as any,
    });
    return this.loadShaped({ id: inserted.id, tenantId });
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    userId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const { createdByUserId: _c, updatedByUserId: _u, status: statusBody, ...rest } =
      params.body;
    const data = coerceBillWrite(rest);
    delete data.status;

    const statusName =
      statusBody &&
      typeof statusBody === 'object' &&
      !Array.isArray(statusBody) &&
      typeof (statusBody as { name?: string }).name === 'string'
        ? (statusBody as { name: string }).name
        : undefined;
    if (statusName) {
      const statusLookupId = await this.resolveStatusLookupId({
        tenantId,
        name: statusName,
      });
      if (statusLookupId) {
        data.statusLookupId = statusLookupId;
      }
    }

    await this.billsRepo.update({
      id: params.id,
      data: {
        ...data,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      } as any,
    });
    return this.loadShaped({ id: params.id, tenantId });
  }

  /**
   * Internal approval: Received → Reviewed. Requires a positive amount.
   */
  async approve(params: { id: string; userId?: string }) {
    const logPrefix = 'BillsService.approve';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.billsRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Bill not found');
    }

    const statusName = this.billStatusName(existing);
    if (statusName.toLowerCase() !== BILL_STATUS.RECEIVED.toLowerCase()) {
      throw new BadRequestException('Only received bills can be approved');
    }

    const amount = Number(existing.totalAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        'Bill amount must be greater than 0 to approve',
      );
    }

    const reviewedStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: BILL_STATUS.REVIEWED,
    });
    if (!reviewedStatusId) {
      throw new BadRequestException('Could not resolve Reviewed bill status');
    }

    this.logger.log(
      `${logPrefix} — bill=${params.id} amount=${amount} Received → Reviewed`,
    );

    await this.billsRepo.update({
      id: params.id,
      data: {
        statusLookupId: reviewedStatusId,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });

    return this.loadShaped({ id: params.id, tenantId });
  }

  /**
   * Reject a received bill. Requires bills.reject.
   */
  async reject(params: { id: string; userId?: string }) {
    const logPrefix = 'BillsService.reject';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.billsRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Bill not found');
    }

    const statusName = this.billStatusName(existing);
    if (statusName.toLowerCase() !== BILL_STATUS.RECEIVED.toLowerCase()) {
      throw new BadRequestException('Only received bills can be rejected');
    }

    const rejectedStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: BILL_STATUS.REJECTED,
    });
    if (!rejectedStatusId) {
      throw new BadRequestException('Could not resolve Rejected bill status');
    }

    this.logger.log(`${logPrefix} — bill=${params.id} Received → Rejected`);

    await this.billsRepo.update({
      id: params.id,
      data: {
        statusLookupId: rejectedStatusId,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });

    return this.loadShaped({ id: params.id, tenantId });
  }

  /**
   * Return a reviewed or rejected bill to Received so it can be edited and re-approved.
   */
  async returnToReceived(params: { id: string; userId?: string }) {
    const logPrefix = 'BillsService.returnToReceived';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.billsRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Bill not found');
    }

    const statusName = this.billStatusName(existing);
    const normalised = statusName.toLowerCase();
    const canReset =
      normalised === BILL_STATUS.REVIEWED.toLowerCase() ||
      normalised === 'rejected' ||
      normalised === 'declined';
    if (!canReset) {
      throw new BadRequestException(
        'Only reviewed or rejected bills can be returned to received',
      );
    }

    const receivedStatusId = await this.resolveStatusLookupId({
      tenantId,
      name: BILL_STATUS.RECEIVED,
    });
    if (!receivedStatusId) {
      throw new BadRequestException('Could not resolve Received bill status');
    }

    this.logger.log(
      `${logPrefix} — bill=${params.id} ${statusName} → Received`,
    );

    await this.billsRepo.update({
      id: params.id,
      data: {
        statusLookupId: receivedStatusId,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });

    return this.loadShaped({ id: params.id, tenantId });
  }
}
