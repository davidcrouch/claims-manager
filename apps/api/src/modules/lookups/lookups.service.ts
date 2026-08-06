import { BadRequestException, Injectable } from '@nestjs/common';
import { LookupsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class LookupsService {
  constructor(
    private readonly lookupsRepo: LookupsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findByDomain(params: { domain: string; providerCode?: string }) {
    if (!this.tenantContext.hasTenant()) {
      return [];
    }
    const tenantId = this.tenantContext.getTenantId();
    return this.lookupsRepo.findByDomain({
      tenantId,
      domain: params.domain,
      providerCode: params.providerCode,
    });
  }

  async findOne(params: { id: string }) {
    if (!this.tenantContext.hasTenant()) {
      return null;
    }
    const tenantId = this.tenantContext.getTenantId();
    return this.lookupsRepo.findOne({ id: params.id, tenantId });
  }

  async ensureByName(params: { domain: string; name: string }) {
    if (!this.tenantContext.hasTenant()) {
      throw new BadRequestException('Tenant context required');
    }
    if (!params.domain?.trim() || !params.name?.trim()) {
      throw new BadRequestException('domain and name are required');
    }
    const tenantId = this.tenantContext.getTenantId();
    return this.lookupsRepo.findOrCreateByName({
      tenantId,
      domain: params.domain.trim(),
      name: params.name.trim(),
    });
  }
}
