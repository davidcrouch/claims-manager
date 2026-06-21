import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { ClaimsRepository, type ClaimInsert, type ClaimViewRow } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class ClaimsService {
  constructor(
    private readonly claimsRepo: ClaimsRepository,
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
    sort?: string;
    status?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.claimsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      search: params.search,
      sort: params.sort,
      status: params.status,
    });
    return { data: result.data.map(this.shapeClaimResponse), total: result.total };
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const claim = await this.claimsRepo.findOne({ id: params.id, tenantId });
    return claim ? this.shapeClaimResponse(claim) : null;
  }

  private shapeClaimResponse(row: ClaimViewRow) {
    const { statusName, statusExternalReference, accountName, accountExternalReference, ...rest } = row;
    return {
      ...rest,
      status: row.statusLookupId
        ? { id: row.statusLookupId, name: statusName ?? undefined, externalReference: statusExternalReference ?? undefined }
        : undefined,
      account: row.accountLookupId
        ? { id: row.accountLookupId, name: accountName ?? undefined, externalReference: accountExternalReference ?? undefined }
        : undefined,
    };
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiClaim = await this.crunchworkService.createClaim({
      connectionId,
      body: params.body,
    });

    const apiClaimObj = apiClaim as { id?: string; claimNumber?: string };
    const insertData: ClaimInsert = {
      tenantId,
      externalReference: apiClaimObj.id,
      apiPayload: apiClaim as Record<string, unknown>,
      claimNumber: apiClaimObj.claimNumber,
    };
    return this.claimsRepo.create({ data: insertData });
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
  }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiClaim = await this.crunchworkService.updateClaim({
      connectionId,
      claimId: params.id,
      body: params.body,
    });

    const apiClaimObj = apiClaim as { claimNumber?: string };
    return this.claimsRepo.update({
      id: params.id,
      data: {
        apiPayload: apiClaim as Record<string, unknown>,
        claimNumber: apiClaimObj.claimNumber ?? existing.claimNumber,
      },
    });
  }
}
