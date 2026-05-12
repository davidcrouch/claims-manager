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
    vendorId?: string;
    invoiceId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.billsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      purchaseOrderId: params.purchaseOrderId,
      vendorId: params.vendorId,
      invoiceId: params.invoiceId,
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

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.billsRepo.create({ data: { ...params.body, tenantId } as any });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    return this.billsRepo.update({ id: params.id, data: params.body as any });
  }
}
