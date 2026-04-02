import { Injectable } from '@nestjs/common';
import { LookupsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class LookupsService {
  constructor(
    private readonly lookupsRepo: LookupsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findByDomain(params: { domain: string }) {
    if (!this.tenantContext.hasTenant()) {
      return [];
    }
    const tenantId = this.tenantContext.getTenantId();
    return this.lookupsRepo.findByDomain({ tenantId, domain: params.domain });
  }

  async findOne(params: { id: string }) {
    if (!this.tenantContext.hasTenant()) {
      return null;
    }
    const tenantId = this.tenantContext.getTenantId();
    return this.lookupsRepo.findOne({ id: params.id, tenantId });
  }
}
