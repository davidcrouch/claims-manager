import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { QuotesRepository, type QuoteInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class QuotesService {
  constructor(
    private readonly quotesRepo: QuotesRepository,
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
    statusId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.quotesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      statusId: params.statusId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.quotesRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.quotesRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async create(params: { body: Record<string, unknown> }) {
    const crunchworkTenantId = this.tenantContext.getCrunchworkTenantId();
    const connectionId = await this.resolveConnectionId(crunchworkTenantId);
    const apiQuote = await this.crunchworkService.createQuote({
      connectionId,
      body: params.body,
    });

    const tenantId = this.tenantContext.getTenantId();
    const apiObj = apiQuote as Record<string, unknown>;
    const insertData: QuoteInsert = {
      tenantId,
      jobId: (apiObj.jobId ?? apiObj.job_id ?? params.body?.jobId) as string,
      claimId: (apiObj.claimId ?? apiObj.claim_id ?? params.body?.claimId) as string,
      externalReference: apiObj.id as string,
      quoteNumber: apiObj.quoteNumber as string,
      apiPayload: apiQuote as Record<string, unknown>,
    };
    return this.quotesRepo.create({ data: insertData });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const crunchworkTenantId = this.tenantContext.getCrunchworkTenantId();
    const connectionId = await this.resolveConnectionId(crunchworkTenantId);
    const apiQuote = await this.crunchworkService.updateQuote({
      connectionId,
      quoteId: params.id,
      body: params.body,
    });

    return this.quotesRepo.update({
      id: params.id,
      data: { apiPayload: apiQuote as Record<string, unknown> },
    });
  }
}
