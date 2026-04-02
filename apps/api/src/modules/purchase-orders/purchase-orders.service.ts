import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { PurchaseOrdersRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    vendorId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.purchaseOrdersRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      vendorId: params.vendorId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.purchaseOrdersRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.purchaseOrdersRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const crunchworkTenantId = this.tenantContext.getCrunchworkTenantId();
    const connectionId = await this.resolveConnectionId(crunchworkTenantId);
    const apiPo = await this.crunchworkService.updatePurchaseOrder({
      connectionId,
      purchaseOrderId: params.id,
      body: params.body,
    });

    return this.purchaseOrdersRepo.update({
      id: params.id,
      data: { purchaseOrderPayload: apiPo as Record<string, unknown> },
    });
  }
}
