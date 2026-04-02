import { Injectable, NotImplementedException, Optional, BadRequestException } from '@nestjs/common';
import { VendorsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class VendorsService {
  private readonly allocationEnabled = process.env.VENDOR_ALLOCATION_ENABLED === 'true';

  constructor(
    private readonly vendorsRepo: VendorsRepository,
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
    search?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.vendorsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      search: params.search,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.vendorsRepo.findOne({ id: params.id, tenantId });
  }

  async getAllocation(params: {
    jobType: string;
    account: string;
    postcode: string;
    lossType?: string;
    totalLoss?: boolean;
  }): Promise<Record<string, unknown>[]> {
    if (!this.allocationEnabled) {
      throw new NotImplementedException(
        '[VendorsService.getAllocation] Vendor allocation is Phase 4 - set VENDOR_ALLOCATION_ENABLED=true',
      );
    }

    const crunchworkTenantId = this.tenantContext.getCrunchworkTenantId();
    const connectionId = await this.resolveConnectionId(crunchworkTenantId);
    return this.crunchworkService.getVendorAllocation({
      connectionId,
      jobType: params.jobType,
      account: params.account,
      postcode: params.postcode,
      lossType: params.lossType,
      totalLoss: params.totalLoss,
    });
  }
}
