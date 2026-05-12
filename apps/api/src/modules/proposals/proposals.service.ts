import { Injectable } from '@nestjs/common';
import { ProposalsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly proposalsRepo: ProposalsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    rfqId?: string;
    vendorId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      rfqId: params.rfqId,
      vendorId: params.vendorId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async findByRfq(params: { rfqId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findByRfq({ rfqId: params.rfqId, tenantId });
  }

  async findByVendor(params: { vendorId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findByVendor({
      vendorId: params.vendorId,
      tenantId,
    });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.create({ data: { ...params.body, tenantId } as any });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    return this.proposalsRepo.update({ id: params.id, data: params.body as any });
  }
}
