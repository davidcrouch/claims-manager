import { Injectable, Optional, BadRequestException, Logger } from '@nestjs/common';
import { QuotesRepository, JobsRepository, ClaimsRepository, type QuoteInsert, type JobRow } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { CatalogOutboundService } from '../catalog/services/catalog-outbound.service';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';

@Injectable()
export class QuotesService {
  private readonly logger = new Logger('QuotesService');

  constructor(
    private readonly quotesRepo: QuotesRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly claimsRepo: ClaimsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    private readonly catalogSelectionService: CatalogSelectionService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly catalogOutbound?: CatalogOutboundService,
  ) {}

  /**
   * Resolve the integration connection for publishing.
   * Prefers the job's own connectionId (set when auto-created by a provider),
   * falls back to tenant-level provider lookup for manually created jobs.
   */
  private async resolveConnectionId(params: { tenantId: string; job?: JobRow | null }): Promise<string> {
    if (params.job?.connectionId) {
      this.logger.debug(
        `QuotesService.resolveConnectionId — using job.connectionId=${params.job.connectionId}`,
      );
      if (this.connectionResolver) {
        this.crunchworkService.setConnectionResolver(this.connectionResolver);
      }
      return params.job.connectionId;
    }

    if (!this.connectionResolver) return params.tenantId;
    this.crunchworkService.setConnectionResolver(this.connectionResolver);
    const connection = await this.connectionResolver.resolveForTenant({ tenantId: params.tenantId });
    if (!connection) {
      throw new BadRequestException('No active provider connection for tenant');
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
    const tenantId = this.tenantContext.getTenantId();
    const insertData: QuoteInsert = {
      tenantId,
      jobId: params.body.jobId as string,
      claimId: params.body.claimId as string,
      name: (params.body.name as string) || null,
      note: (params.body.note as string) || null,
      estimatedStartDate: (params.body.estimatedStart as string) || null,
      estimatedCompletionDate: (params.body.estimatedCompletion as string) || null,
      customData: { quoteType: params.body.quoteType || null },
    };
    return this.quotesRepo.create({ data: insertData });
  }

  async publish(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.quotesRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Quote not found');
    }
    if (existing.externalReference) {
      throw new BadRequestException('Quote already published to Crunchwork');
    }

    const job = existing.jobId
      ? await this.jobsRepo.findOne({ id: existing.jobId, tenantId })
      : null;
    if (existing.jobId && !job?.externalReference) {
      throw new BadRequestException('Job has no external reference — sync the job to Crunchwork first');
    }

    const connectionId = await this.resolveConnectionId({ tenantId, job });

    const claim = existing.claimId
      ? await this.claimsRepo.findOne({ id: existing.claimId, tenantId })
      : null;
    if (existing.claimId && !claim?.externalReference) {
      throw new BadRequestException('Claim has no external reference — sync the claim to Crunchwork first');
    }

    const custom = (existing.customData ?? {}) as Record<string, unknown>;
    const outboundBody: Record<string, unknown> = {
      jobId: job?.externalReference ?? null,
      claimId: claim?.externalReference ?? null,
      name: existing.name,
      note: existing.note,
      estimatedStart: existing.estimatedStartDate,
      estimatedCompletion: existing.estimatedCompletionDate,
    };
    if (custom.quoteType) {
      outboundBody.quoteType =
        typeof custom.quoteType === 'object' ? custom.quoteType : { id: custom.quoteType };
    }

    const groups = await this.catalogSelectionService.buildOutboundQuoteGroups({
      quoteId: params.id,
    });
    if (groups.length > 0) {
      outboundBody.groups = groups;
    }

    const enriched = this.catalogOutbound
      ? await this.catalogOutbound.enrichPayload({ tenantId, body: outboundBody })
      : outboundBody;
    const apiQuote = await this.crunchworkService.createQuote({
      connectionId,
      body: enriched,
    });

    const apiObj = apiQuote as Record<string, unknown>;
    return this.quotesRepo.update({
      id: params.id,
      data: {
        externalReference: apiObj.id as string,
        quoteNumber: (apiObj.quoteNumber as string) || existing.quoteNumber,
        apiPayload: apiQuote as Record<string, unknown>,
      },
    });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;
    if (!existing.externalReference) {
      throw new BadRequestException('Quote has no external reference — publish it first');
    }

    const tenantId = this.tenantContext.getTenantId();
    const job = existing.jobId
      ? await this.jobsRepo.findOne({ id: existing.jobId, tenantId })
      : null;
    const connectionId = await this.resolveConnectionId({ tenantId, job });
    const outboundBody = this.catalogOutbound
      ? await this.catalogOutbound.enrichPayload({ tenantId, body: params.body })
      : params.body;
    const apiQuote = await this.crunchworkService.updateQuote({
      connectionId,
      quoteId: existing.externalReference,
      body: outboundBody,
    });

    return this.quotesRepo.update({
      id: params.id,
      data: { apiPayload: apiQuote as Record<string, unknown> },
    });
  }
}
