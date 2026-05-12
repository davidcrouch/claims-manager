import { Injectable } from '@nestjs/common';
import { WorkOrdersRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    purchaseOrderId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      purchaseOrderId: params.purchaseOrderId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async findByPurchaseOrder(params: { purchaseOrderId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.findByPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      tenantId,
    });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.create({ data: { ...params.body, tenantId } as any });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    return this.workOrdersRepo.update({ id: params.id, data: params.body as any });
  }
}
