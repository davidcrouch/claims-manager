import { Injectable, Optional, BadRequestException, Logger } from '@nestjs/common';
import { QuotesRepository, JobsRepository, ClaimsRepository, type QuoteInsert, type QuoteViewRow, type JobRow } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { LookupResolver } from '../external/lookup-resolver.service';
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
    private readonly lookupResolver: LookupResolver,
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

  private async resolveStatusLookup(params: {
    tenantId: string;
    statusField: unknown;
  }): Promise<string | null> {
    if (!params.statusField || typeof params.statusField !== 'object') return null;
    const status = params.statusField as Record<string, unknown>;
    const extRef = (status.externalReference as string) ?? (status.id as string);
    if (!extRef) return null;
    return this.lookupResolver.resolve({
      tenantId: params.tenantId,
      domain: 'quote_status',
      externalReference: extRef,
      name: (status.name as string) ?? undefined,
      autoCreate: true,
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    statusId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.quotesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      statusId: params.statusId,
    });
    return { data: result.data.map(this.shapeQuoteResponse), total: result.total };
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.quotesRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await this.quotesRepo.findByJob({ jobId: params.jobId, tenantId });
    return rows.map(this.shapeQuoteResponse);
  }

  private shapeQuoteResponse(row: QuoteViewRow) {
    const { statusName, statusExternalReference, quoteTypeName, quoteTypeExternalReference, ...rest } = row;
    return {
      ...rest,
      status: row.statusLookupId
        ? { id: row.statusLookupId, name: statusName ?? undefined, externalReference: statusExternalReference ?? undefined }
        : undefined,
      quoteType: row.quoteTypeLookupId
        ? { id: row.quoteTypeLookupId, name: quoteTypeName ?? undefined, externalReference: quoteTypeExternalReference ?? undefined }
        : undefined,
    };
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const insertData: QuoteInsert = {
      tenantId,
      jobId: params.body.jobId as string,
      claimId: params.body.claimId as string,
      name: (params.body.name as string) || null,
      note: (params.body.note as string) || null,
      quoteDate: params.body.estimateDate
        ? new Date(params.body.estimateDate as string)
        : null,
      expiresInDays: params.body.expiresInDays
        ? Number(params.body.expiresInDays)
        : null,
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
      reference: existing.reference ?? undefined,
      note: existing.note,
      date: existing.quoteDate ?? undefined,
      expiresInDays: existing.expiresInDays ?? undefined,
      estimatedStartDate: existing.estimatedStartDate ?? undefined,
      estimatedCompletionDate: existing.estimatedCompletionDate ?? undefined,
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
    const statusLookupId = await this.resolveStatusLookup({
      tenantId,
      statusField: apiObj.status,
    });
    const updateData: Partial<QuoteInsert> = {
      externalReference: apiObj.id as string,
      quoteNumber: (apiObj.quoteNumber as string) || existing.quoteNumber,
      name: (apiObj.name as string) || existing.name,
      statusLookupId: statusLookupId ?? undefined,
      apiPayload: apiQuote as Record<string, unknown>,
    };
    const cwDate = (apiObj.date ?? apiObj.quoteDate) as string | undefined;
    if (cwDate) updateData.quoteDate = new Date(cwDate);
    if (apiObj.expiresInDays != null) updateData.expiresInDays = Number(apiObj.expiresInDays);
    if (apiObj.subTotal != null) updateData.subTotal = String(apiObj.subTotal);
    if (apiObj.totalTax != null) updateData.totalTax = String(apiObj.totalTax);
    const cwTotal = apiObj.total ?? apiObj.totalAmount;
    if (cwTotal != null) updateData.totalAmount = String(cwTotal);

    return this.quotesRepo.update({ id: params.id, data: updateData });
  }

  async delete(params: { id: string }): Promise<{ deleted: boolean; softDeleted: boolean }> {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.quotesRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Quote not found');
    }

    if (existing.externalReference) {
      await this.quotesRepo.softDelete({ id: params.id, tenantId });
      return { deleted: true, softDeleted: true };
    }

    await this.quotesRepo.hardDelete({ id: params.id, tenantId });
    return { deleted: true, softDeleted: false };
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

    const respObj = apiQuote as Record<string, unknown>;
    const updStatusLookupId = await this.resolveStatusLookup({
      tenantId,
      statusField: respObj.status,
    });
    const updData: Partial<QuoteInsert> = {
      apiPayload: apiQuote as Record<string, unknown>,
    };
    if (updStatusLookupId) updData.statusLookupId = updStatusLookupId;
    if (respObj.quoteNumber) updData.quoteNumber = String(respObj.quoteNumber);
    const respDate = (respObj.date ?? respObj.quoteDate) as string | undefined;
    if (respDate) updData.quoteDate = new Date(respDate);
    if (respObj.expiresInDays != null) updData.expiresInDays = Number(respObj.expiresInDays);
    if (respObj.subTotal != null) updData.subTotal = String(respObj.subTotal);
    if (respObj.totalTax != null) updData.totalTax = String(respObj.totalTax);
    const updTotal = respObj.total ?? respObj.totalAmount;
    if (updTotal != null) updData.totalAmount = String(updTotal);

    return this.quotesRepo.update({ id: params.id, data: updData });
  }
}
