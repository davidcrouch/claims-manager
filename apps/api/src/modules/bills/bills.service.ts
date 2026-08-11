import { Injectable } from '@nestjs/common';
import { BillsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class BillsService {
  constructor(
    private readonly billsRepo: BillsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    purchaseOrderId?: string;
    status?: string;
    vendorId?: string;
    invoiceId?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.billsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      purchaseOrderId: params.purchaseOrderId,
      status: params.status,
      vendorId: params.vendorId,
      invoiceId: params.invoiceId,
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

  async findByInvoice(params: { invoiceId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.billsRepo.findByInvoice({
      invoiceId: params.invoiceId,
      tenantId,
    });
  }

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const { createdByUserId: _c, updatedByUserId: _u, ...rest } = params.body;
    return this.billsRepo.create({
      data: {
        ...rest,
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
        ...rest,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      } as any,
    });
  }
}
