import { Injectable } from '@nestjs/common';
import { BillsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { RecordNumberService } from '../../common/record-number/record-number.service';

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
  constructor(
    private readonly billsRepo: BillsRepository,
    private readonly tenantContext: TenantContext,
    private readonly recordNumberService: RecordNumberService,
  ) {}

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
    return this.billsRepo.findAll({
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
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.billsRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.billsRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async findByPurchaseOrder(params: { purchaseOrderId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.billsRepo.findByPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      tenantId,
    });
  }

  async findByVendor(params: { vendorId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.billsRepo.findByVendor({
      vendorId: params.vendorId,
      tenantId,
    });
  }

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const {
      createdByUserId: _c,
      updatedByUserId: _u,
      billNumber: bodyBillNumber,
      ...rest
    } = params.body;
    const billNumber = await this.recordNumberService.resolve({
      tenantId,
      entity: 'bill',
      explicit: bodyBillNumber,
    });
    return this.billsRepo.create({
      data: {
        ...coerceBillWrite(rest),
        billNumber,
        tenantId,
        createdByUserId: params.userId ?? null,
        updatedByUserId: params.userId ?? null,
      } as any,
    });
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    userId?: string;
  }) {
    const { createdByUserId: _c, updatedByUserId: _u, ...rest } = params.body;
    return this.billsRepo.update({
      id: params.id,
      data: {
        ...coerceBillWrite(rest),
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      } as any,
    });
  }
}
