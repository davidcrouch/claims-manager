import { Inject, Injectable, Optional, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import {
  QuotesRepository,
  JobsRepository,
  ClaimsRepository,
  LookupsRepository,
  WorkOrdersRepository,
  ProposalsRepository,
  type QuoteInsert,
  type QuoteViewRow,
  type QuoteRow,
  type JobRow,
  type JobViewRow,
} from '../../database/repositories';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../database/drizzle.module';
import {
  quoteGroups,
  quoteCombos,
  quoteItems,
  proposalItems,
  workOrderGroups,
  workOrderCombos,
  workOrderItems,
  organizations,
} from '../../database/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { LookupResolver } from '../external/lookup-resolver.service';
import { CatalogOutboundService } from '../catalog/services/catalog-outbound.service';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { DocumentIssuanceService } from '../domain/services/document-issuance.service';
@Injectable()
export class QuotesService {
  private readonly logger = new Logger('QuotesService');

  constructor(
    private readonly quotesRepo: QuotesRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly claimsRepo: ClaimsRepository,
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly proposalsRepo: ProposalsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    private readonly catalogSelectionService: CatalogSelectionService,
    private readonly lookupResolver: LookupResolver,
    private readonly lookupsRepo: LookupsRepository,
    private readonly documentIssuance: DocumentIssuanceService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly catalogOutbound?: CatalogOutboundService,
  ) {}

  private async resolvePublishedStatus(params: { tenantId: string }): Promise<{
    lookupId: string;
    outbound: { name: string; externalReference: string };
  }> {
    let lookupId =
      (await this.lookupResolver.resolveByName({
        tenantId: params.tenantId,
        domain: 'quote_status',
        name: 'Published',
      })) ??
      (await this.lookupResolver.resolve({
        tenantId: params.tenantId,
        domain: 'quote_status',
        externalReference: 'Published',
        name: 'Published',
        autoCreate: true,
      }));

    if (!lookupId) {
      throw new BadRequestException('Published quote status lookup not configured');
    }

    const lookup = await this.lookupsRepo.findOne({ id: lookupId, tenantId: params.tenantId });
    if (!lookup?.externalReference) {
      throw new BadRequestException('Published quote status lookup has no external reference');
    }

    return {
      lookupId,
      outbound: { name: lookup.name ?? 'Published', externalReference: lookup.externalReference },
    };
  }

  private async resolvePendingStatus(params: { tenantId: string }): Promise<{ lookupId: string }> {
    const lookupId =
      (await this.lookupResolver.resolveByName({
        tenantId: params.tenantId,
        domain: 'quote_status',
        name: 'Pending',
      })) ??
      (await this.lookupResolver.resolve({
        tenantId: params.tenantId,
        domain: 'quote_status',
        externalReference: 'Pending',
        name: 'Pending',
        autoCreate: true,
      }));

    if (!lookupId) {
      throw new BadRequestException('Pending quote status lookup not configured');
    }

    return { lookupId };
  }

  private async resolveApprovedStatus(params: { tenantId: string }): Promise<{ lookupId: string }> {
    const lookupId =
      (await this.lookupResolver.resolveByName({
        tenantId: params.tenantId,
        domain: 'quote_status',
        name: 'Approved',
      })) ??
      (await this.lookupResolver.resolve({
        tenantId: params.tenantId,
        domain: 'quote_status',
        externalReference: 'Approved',
        name: 'Approved',
        autoCreate: true,
      }));

    if (!lookupId) {
      throw new BadRequestException('Approved quote status lookup not configured');
    }

    return { lookupId };
  }

  private async resolveWoStatus(params: {
    tenantId: string;
    name: string;
  }): Promise<string | null> {
    return (
      (await this.lookupResolver.resolveByName({
        tenantId: params.tenantId,
        domain: 'work_order_status',
        name: params.name,
      })) ??
      (await this.lookupResolver.resolve({
        tenantId: params.tenantId,
        domain: 'work_order_status',
        externalReference: params.name,
        name: params.name,
        autoCreate: true,
      }))
    );
  }

  /** External jobs sync to an insurance provider (e.g. Crunchwork); internal/direct do not. */
  private isExternalJob(job: JobViewRow | JobRow | null | undefined): boolean {
    if (!job) return false;
    // Internal jobs are stored without a connectionId (see JobsService.create).
    const connectionId = (job as JobViewRow).connectionId;
    if (!connectionId) return false;
    const code = (job as JobViewRow).connectionProviderCode;
    if (!code || code === 'direct' || code === 'internal') return false;
    return true;
  }

  private applyQuoteApiFields(params: {
    apiObj: Record<string, unknown>;
    existing: Pick<QuoteRow, 'quoteNumber' | 'name'>;
    fallbackApiObj?: Record<string, unknown>;
    base?: Partial<QuoteInsert>;
  }): Partial<QuoteInsert> {
    const { apiObj, existing, fallbackApiObj, base = {} } = params;
    const source = { ...(fallbackApiObj ?? {}), ...apiObj };
    const updateData: Partial<QuoteInsert> = { ...base };

    if (source.quoteNumber) updateData.quoteNumber = String(source.quoteNumber);
    if (source.name) updateData.name = String(source.name);
    const cwDate = (source.date ?? source.quoteDate) as string | undefined;
    if (cwDate) updateData.quoteDate = new Date(cwDate);
    if (source.expiresInDays != null) updateData.expiresInDays = Number(source.expiresInDays);
    if (source.subTotal != null) updateData.subTotal = String(source.subTotal);
    if (source.totalTax != null) updateData.totalTax = String(source.totalTax);
    const cwTotal = source.total ?? source.totalAmount;
    if (cwTotal != null) updateData.totalAmount = String(cwTotal);

    if (!updateData.quoteNumber) updateData.quoteNumber = existing.quoteNumber ?? undefined;
    if (!updateData.name) updateData.name = existing.name ?? undefined;

    return updateData;
  }

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
    status?: string;
    statusId?: string;
    quoteType?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.quotesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      status: params.status,
      statusId: params.statusId,
      quoteType: params.quoteType,
      sort: params.sort,
    });
    return { data: result.data.map(this.shapeQuoteResponse), total: result.total };
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.quotesRepo.findOne({ id: params.id, tenantId });
    return row ? this.shapeQuoteResponse(row) : null;
  }

  async assertQuoteEditable(params: { id: string }): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.quotesRepo.findOne({ id: params.id, tenantId });
    if (!row) throw new NotFoundException('Quote not found');
    const statusName = (row.statusName ?? '').trim().toLowerCase();
    const locked =
      !!row.externalReference || (statusName !== '' && statusName !== 'draft');
    if (locked) {
      throw new BadRequestException('Published estimates cannot be edited');
    }
  }

  /** Map quote_to / quote_for / quote_from JSONB into CW to/for/from body fields. */
  private flattenPartyForOutbound(
    prefix: 'to' | 'for' | 'from',
    party: unknown,
  ): Record<string, unknown> {
    if (!party || typeof party !== 'object') return {};
    const p = party as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const map: Array<[string, string]> = [
      ['name', 'Name'],
      ['companyRegistrationNumber', 'CompanyRegistrationNumber'],
      ['contactName', 'ContactName'],
      ['clientReference', 'ClientReference'],
      ['phoneNumber', 'PhoneNumber'],
      ['email', 'Email'],
      ['unitNumber', 'UnitNumber'],
      ['streetNumber', 'StreetNumber'],
      ['streetName', 'StreetName'],
      ['suburb', 'Suburb'],
      ['postCode', 'PostCode'],
      ['state', 'State'],
      ['country', 'Country'],
    ];
    for (const [src, suffix] of map) {
      if (prefix === 'from' && src === 'clientReference') continue;
      const val = p[src];
      if (val !== undefined && val !== null && val !== '') {
        out[`${prefix}${suffix}`] = val;
      }
    }
    return out;
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await this.quotesRepo.findByJob({ jobId: params.jobId, tenantId });
    return rows.map(this.shapeQuoteResponse);
  }

  private shapeQuoteResponse(row: QuoteViewRow) {
    const {
      statusName,
      statusExternalReference,
      quoteTypeName,
      quoteTypeExternalReference,
      assigneeName,
      ...rest
    } = row;
    return {
      ...rest,
      assigneeName: assigneeName ?? null,
      status: row.statusLookupId
        ? { id: row.statusLookupId, name: statusName ?? undefined, externalReference: statusExternalReference ?? undefined }
        : undefined,
      quoteType: row.quoteTypeLookupId
        ? { id: row.quoteTypeLookupId, name: quoteTypeName ?? undefined, externalReference: quoteTypeExternalReference ?? undefined }
        : undefined,
    };
  }

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const draftStatusId =
      (await this.lookupResolver.resolveByName({
        tenantId,
        domain: 'quote_status',
        name: 'Draft',
      })) ??
      (await this.lookupResolver.resolve({
        tenantId,
        domain: 'quote_status',
        externalReference: 'Draft',
        name: 'Draft',
        autoCreate: true,
      }));

    const recipientOrganisationId =
      typeof params.body.recipientOrganisationId === 'string'
        ? params.body.recipientOrganisationId
        : null;

    const scheduleInfo: Record<string, unknown> = {};
    if (params.body.estimatedStart || params.body.estimatedStartDate) {
      scheduleInfo.estimatedStartDate =
        params.body.estimatedStart ?? params.body.estimatedStartDate;
    }
    if (params.body.estimatedCompletion || params.body.estimatedCompletionDate) {
      scheduleInfo.estimatedCompletionDate =
        params.body.estimatedCompletion ?? params.body.estimatedCompletionDate;
    }
    if (params.body.reasonForVariation != null) {
      scheduleInfo.reasonForVariation = params.body.reasonForVariation;
    }

    const insertData: QuoteInsert = {
      tenantId,
      jobId: params.body.jobId as string,
      claimId: (params.body.claimId as string) || null,
      issuerOrganisationId: tenantId,
      recipientOrganisationId,
      ownershipStatus: 'owned',
      name: (params.body.name as string) || null,
      reference: (params.body.reference as string) || null,
      note: (params.body.note as string) || null,
      quoteDate: params.body.estimateDate
        ? new Date(params.body.estimateDate as string)
        : params.body.date
          ? new Date(params.body.date as string)
          : null,
      expiresInDays: params.body.expiresInDays
        ? Number(params.body.expiresInDays)
        : null,
      estimatedStartDate:
        ((params.body.estimatedStart ?? params.body.estimatedStartDate) as string) ||
        null,
      estimatedCompletionDate:
        ((params.body.estimatedCompletion ??
          params.body.estimatedCompletionDate) as string) || null,
      scheduleInfo,
      quoteTo:
        params.body.quoteTo && typeof params.body.quoteTo === 'object'
          ? (params.body.quoteTo as Record<string, unknown>)
          : {},
      quoteFor:
        params.body.quoteFor && typeof params.body.quoteFor === 'object'
          ? (params.body.quoteFor as Record<string, unknown>)
          : {},
      quoteFrom:
        params.body.quoteFrom && typeof params.body.quoteFrom === 'object'
          ? (params.body.quoteFrom as Record<string, unknown>)
          : {},
      customData: { quoteType: params.body.quoteType || null },
      statusLookupId: draftStatusId ?? null,
      createdByUserId: params.userId ?? null,
      updatedByUserId: params.userId ?? null,
    };
    const to = insertData.quoteTo as Record<string, unknown> | undefined;
    if (to) {
      if (typeof to.name === 'string') insertData.quoteToName = to.name;
      if (typeof to.email === 'string') insertData.quoteToEmail = to.email;
    }
    const forParty = insertData.quoteFor as Record<string, unknown> | undefined;
    if (forParty && typeof forParty.name === 'string') {
      insertData.quoteForName = forParty.name;
    }
    return this.quotesRepo.create({ data: insertData });
  }

  async publish(params: { id: string; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.quotesRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Quote not found');
    }

    const pendingStatus = await this.resolvePendingStatus({ tenantId });
    if (existing.statusLookupId === pendingStatus.lookupId) {
      throw new BadRequestException('Estimate already published');
    }
    if (existing.externalReference) {
      throw new BadRequestException('Quote already published to Crunchwork');
    }

    const job = existing.jobId
      ? await this.jobsRepo.findOne({ id: existing.jobId, tenantId })
      : null;
    const isExternal = this.isExternalJob(job);

    // INTERNAL: mark Pending only (PDF generation is handled by the client wizard).
    if (!isExternal) {
      this.logger.log(
        `QuotesService.publish — internal publish setting status Pending (quoteId=${params.id})`,
      );
      await this.quotesRepo.update({
        id: params.id,
        data: {
          statusLookupId: pendingStatus.lookupId,
          ...(params.userId ? { updatedByUserId: params.userId } : {}),
        },
      });
      await this.maybeIssueCrossTenantProposal({
        quoteId: params.id,
        tenantId,
        userId: params.userId ?? 'system',
        recipientOrganisationId: existing.recipientOrganisationId,
      });
      const updated = await this.quotesRepo.findOne({ id: params.id, tenantId });
      return updated ? this.shapeQuoteResponse(updated) : null;
    }

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
    const jobApiPayload = (job?.apiPayload ?? {}) as Record<string, unknown>;
    const claimApiPayload = (claim?.apiPayload ?? {}) as Record<string, unknown>;
    const schedule = (existing.scheduleInfo ?? {}) as Record<string, unknown>;
    const outboundBody: Record<string, unknown> = {
      jobId: (jobApiPayload.id as string) ?? job?.externalReference ?? null,
      claimId: (claimApiPayload.id as string) ?? claim?.externalReference ?? null,
      name: existing.name,
      reference: existing.reference ?? undefined,
      note: existing.note,
      date: existing.quoteDate ?? undefined,
      expiresInDays: existing.expiresInDays ?? undefined,
      estimatedStartDate: existing.estimatedStartDate ?? undefined,
      estimatedCompletionDate: existing.estimatedCompletionDate ?? undefined,
      reasonForVariation:
        (schedule.reasonForVariation as string | undefined) ?? undefined,
      ...this.flattenPartyForOutbound('to', existing.quoteTo),
      ...this.flattenPartyForOutbound('for', existing.quoteFor),
      ...this.flattenPartyForOutbound('from', existing.quoteFrom),
    };
    if (custom.quoteType) {
      const qt = custom.quoteType;
      outboundBody.quoteType =
        typeof qt === 'object' && qt !== null
          ? qt
          : { externalReference: String(qt), name: String(qt) };
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
    this.logger.debug(
      `QuotesService.publish — outbound create payload groups=${groups.length}, ` +
      `items=${groups.reduce((n, g) => n + (Array.isArray((g as any).items) ? (g as any).items.length : 0), 0)}, ` +
      `combos=${groups.reduce((n, g) => n + (Array.isArray((g as any).combos) ? (g as any).combos.length : 0), 0)}`,
    );
    const createResponse = await this.crunchworkService.createQuote({
      connectionId,
      body: enriched,
    });

    const createObj = createResponse as Record<string, unknown>;
    const cwQuoteId = createObj.id as string | undefined;
    if (!cwQuoteId) {
      throw new BadRequestException('Crunchwork did not return a quote id after upload');
    }
    this.logger.log(
      `QuotesService.publish — draft quote uploaded to Crunchwork (cwQuoteId=${cwQuoteId})`,
    );

    // Provider-facing status remains Published; local estimate status is Pending.
    const publishedStatus = await this.resolvePublishedStatus({ tenantId });
    const publishBody: Record<string, unknown> = {
      status: publishedStatus.outbound,
    };
    const enrichedPublish = this.catalogOutbound
      ? await this.catalogOutbound.enrichPayload({ tenantId, body: publishBody })
      : publishBody;
    const updateResponse = await this.crunchworkService.updateQuote({
      connectionId,
      quoteId: cwQuoteId,
      body: enrichedPublish,
    });

    const updateObj = updateResponse as Record<string, unknown>;
    this.logger.log(
      `QuotesService.publish — Crunchwork quote status updated to Published; local status Pending (cwQuoteId=${cwQuoteId})`,
    );

    const updateData = this.applyQuoteApiFields({
      apiObj: updateObj,
      fallbackApiObj: createObj,
      existing,
      base: {
        externalReference: cwQuoteId,
        statusLookupId: pendingStatus.lookupId,
        apiPayload: updateResponse as Record<string, unknown>,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });

    await this.quotesRepo.update({ id: params.id, data: updateData });
    await this.maybeIssueCrossTenantProposal({
      quoteId: params.id,
      tenantId,
      userId: params.userId ?? 'system',
      recipientOrganisationId: existing.recipientOrganisationId,
    });
    const updated = await this.quotesRepo.findOne({ id: params.id, tenantId });
    return updated ? this.shapeQuoteResponse(updated) : null;
  }

  /**
   * When the estimate has an on-platform recipient org, create a Proposal in that tenant.
   */
  private async maybeIssueCrossTenantProposal(params: {
    quoteId: string;
    tenantId: string;
    userId: string;
    recipientOrganisationId: string | null;
  }): Promise<void> {
    const { quoteId, tenantId, userId, recipientOrganisationId } = params;
    if (!recipientOrganisationId || recipientOrganisationId === tenantId) {
      return;
    }

    const [recipientOrg] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, recipientOrganisationId))
      .limit(1);

    if (!recipientOrg || recipientOrg.subscriptionStatus !== 'active') {
      this.logger.debug(
        `QuotesService.maybeIssueCrossTenantProposal — recipient=${recipientOrganisationId} not an active tenant, skipping issuance`,
      );
      return;
    }

    const existingProposals = await this.proposalsRepo.findByQuote({ quoteId });
    if (existingProposals.some((p) => p.tenantId === recipientOrganisationId)) {
      this.logger.log(
        `QuotesService.maybeIssueCrossTenantProposal — proposal already exists for quote=${quoteId}`,
      );
      return;
    }

    await this.db.transaction(async (tx) => {
      await this.documentIssuance.execute({
        tenantId,
        userId,
        documentType: 'quote',
        documentId: quoteId,
        recipientTenantId: recipientOrganisationId,
        tx,
      });
    });

    this.logger.log(
      `QuotesService.maybeIssueCrossTenantProposal — issued proposal for quote=${quoteId} to tenant=${recipientOrganisationId}`,
    );
  }

  async incorporateProposalPricing(params: {
    quoteId: string;
    proposalId: string;
    itemMappings: Array<{ quoteItemId: string; proposalItemId: string }>;
  }): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const quote = await this.quotesRepo.findOne({ id: params.quoteId, tenantId });
    if (!quote) {
      throw new BadRequestException('Quote not found');
    }

    const proposal = await this.proposalsRepo.findOne({
      id: params.proposalId,
      tenantId,
    });
    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    await this.db.transaction(async (tx) => {
      for (const mapping of params.itemMappings) {
        const [proposalItem] = await tx
          .select()
          .from(proposalItems)
          .where(eq(proposalItems.id, mapping.proposalItemId))
          .limit(1);
        if (!proposalItem) {
          throw new BadRequestException(
            `Proposal item ${mapping.proposalItemId} not found`,
          );
        }

        const price = proposalItem.unitCost ?? null;
        await tx
          .update(quoteItems)
          .set({
            buyCost: price,
            allocatedCost: price,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(quoteItems.id, mapping.quoteItemId),
              eq(quoteItems.tenantId, tenantId),
            ),
          );
      }
    });

    this.logger.log(
      `QuotesService.incorporateProposalPricing — updated ${params.itemMappings.length} items on quote=${params.quoteId} from proposal=${params.proposalId}`,
    );
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

  /**
   * Apply editable Quote fields from Insurance REST API §3.3.6 Create/Update
   * (POST Create Optional/Required + POST Update Optional) onto a local draft.
   */
  private buildLocalDraftUpdate(params: {
    existing: NonNullable<Awaited<ReturnType<QuotesService['findOne']>>>;
    body: Record<string, unknown>;
    userId?: string;
  }): Partial<QuoteInsert> {
    const { existing, body, userId } = params;
    const data: Partial<QuoteInsert> = {
      ...(userId ? { updatedByUserId: userId } : {}),
    };

    if (typeof body.name === 'string' || body.name === null) {
      data.name = (body.name as string | null) || null;
    }
    if (typeof body.reference === 'string' || body.reference === null) {
      data.reference = (body.reference as string | null) || null;
    }
    if (typeof body.note === 'string' || body.note === null) {
      data.note = (body.note as string | null) || null;
    }
    if (body.date !== undefined || body.estimateDate !== undefined || body.quoteDate !== undefined) {
      const raw = (body.date ?? body.estimateDate ?? body.quoteDate) as string | null;
      data.quoteDate = raw ? new Date(raw) : null;
    }
    if (body.expiresInDays !== undefined) {
      data.expiresInDays =
        body.expiresInDays === null || body.expiresInDays === ''
          ? null
          : Number(body.expiresInDays);
    }
    if (body.estimatedStartDate !== undefined || body.estimatedStart !== undefined) {
      const raw = (body.estimatedStartDate ?? body.estimatedStart) as string | null;
      data.estimatedStartDate = raw || null;
    }
    if (body.estimatedCompletionDate !== undefined || body.estimatedCompletion !== undefined) {
      const raw = (body.estimatedCompletionDate ?? body.estimatedCompletion) as string | null;
      data.estimatedCompletionDate = raw || null;
    }

    const existingSchedule = (existing.scheduleInfo ?? {}) as Record<string, unknown>;
    if (body.reasonForVariation !== undefined || body.scheduleInfo) {
      const fromBody =
        body.scheduleInfo && typeof body.scheduleInfo === 'object'
          ? (body.scheduleInfo as Record<string, unknown>)
          : {};
      const reason =
        body.reasonForVariation !== undefined
          ? (body.reasonForVariation as string | null)
          : (fromBody.reasonForVariation as string | null | undefined);
      data.scheduleInfo = {
        ...existingSchedule,
        ...fromBody,
        ...(reason !== undefined ? { reasonForVariation: reason || null } : {}),
        ...(data.estimatedStartDate !== undefined
          ? { estimatedStartDate: data.estimatedStartDate }
          : {}),
        ...(data.estimatedCompletionDate !== undefined
          ? { estimatedCompletionDate: data.estimatedCompletionDate }
          : {}),
      };
    } else if (
      data.estimatedStartDate !== undefined ||
      data.estimatedCompletionDate !== undefined
    ) {
      data.scheduleInfo = {
        ...existingSchedule,
        ...(data.estimatedStartDate !== undefined
          ? { estimatedStartDate: data.estimatedStartDate }
          : {}),
        ...(data.estimatedCompletionDate !== undefined
          ? { estimatedCompletionDate: data.estimatedCompletionDate }
          : {}),
      };
    }

    const partyKeys = ['quoteTo', 'quoteFor', 'quoteFrom'] as const;
    for (const key of partyKeys) {
      if (body[key] && typeof body[key] === 'object') {
        data[key] = body[key] as Record<string, unknown>;
      }
    }
    if (data.quoteTo && typeof data.quoteTo === 'object') {
      const to = data.quoteTo as Record<string, unknown>;
      if (typeof to.name === 'string' || to.name === null) data.quoteToName = (to.name as string | null) || null;
      if (typeof to.email === 'string' || to.email === null) data.quoteToEmail = (to.email as string | null) || null;
    }
    if (data.quoteFor && typeof data.quoteFor === 'object') {
      const forParty = data.quoteFor as Record<string, unknown>;
      if (typeof forParty.name === 'string' || forParty.name === null) {
        data.quoteForName = (forParty.name as string | null) || null;
      }
    }

    if (typeof body.statusLookupId === 'string' && body.statusLookupId) {
      data.statusLookupId = body.statusLookupId;
    }

    if (body.quoteType !== undefined) {
      const existingCustom = (existing.customData ?? {}) as Record<string, unknown>;
      let quoteTypeVal: unknown = body.quoteType;
      if (typeof body.quoteType === 'string') {
        quoteTypeVal = body.quoteType;
      } else if (body.quoteType && typeof body.quoteType === 'object') {
        const qt = body.quoteType as Record<string, unknown>;
        quoteTypeVal =
          (qt.externalReference as string | undefined) ??
          (qt.name as string | undefined) ??
          qt;
      }
      data.customData = { ...existingCustom, quoteType: quoteTypeVal ?? null };
    }

    if (body.assignedToUserId !== undefined) {
      data.assignedToUserId = parseOptionalUserId(body.assignedToUserId) ?? null;
    }

    return data;
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    userId?: string;
  }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const bodyKeys = Object.keys(params.body);
    const assigneeOnly =
      bodyKeys.length === 1 && bodyKeys[0] === 'assignedToUserId';

    // Assignment can be changed anytime, including on published estimates.
    if (assigneeOnly) {
      await this.quotesRepo.update({
        id: params.id,
        data: {
          assignedToUserId:
            parseOptionalUserId(params.body.assignedToUserId) ?? null,
          ...(params.userId ? { updatedByUserId: params.userId } : {}),
        },
      });
      const updated = await this.quotesRepo.findOne({ id: params.id, tenantId });
      return updated ? this.shapeQuoteResponse(updated) : null;
    }

    // Local drafts (no CW id): apply §3.3.6 creatable/editable fields in-DB.
    if (!existing.externalReference) {
      await this.assertQuoteEditable({ id: params.id });
      const data = this.buildLocalDraftUpdate({
        existing,
        body: params.body,
        userId: params.userId,
      });
      const keys = Object.keys(data).filter((k) => k !== 'updatedByUserId');
      if (keys.length === 0 && typeof params.body.statusLookupId === 'string' && params.body.statusLookupId) {
        data.statusLookupId = params.body.statusLookupId;
      }
      if (Object.keys(data).filter((k) => k !== 'updatedByUserId').length === 0) {
        return existing;
      }
      await this.quotesRepo.update({ id: params.id, data });
      const updated = await this.quotesRepo.findOne({ id: params.id, tenantId });
      return updated ? this.shapeQuoteResponse(updated) : null;
    }

    if (typeof params.body.statusLookupId === 'string' && params.body.statusLookupId) {
      await this.quotesRepo.update({
        id: params.id,
        data: {
          statusLookupId: params.body.statusLookupId,
          ...(params.userId ? { updatedByUserId: params.userId } : {}),
        },
      });
      const updated = await this.quotesRepo.findOne({ id: params.id, tenantId });
      return updated ? this.shapeQuoteResponse(updated) : null;
    }

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
      ...(params.userId ? { updatedByUserId: params.userId } : {}),
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

  /**
   * Approve an internal estimate: set status to Approved and create a linked Work Order
   * with all line items (groups → combos → items) copied from the estimate.
   */
  async approve(params: { id: string; userId?: string }): Promise<{
    quote: ReturnType<typeof this.shapeQuoteResponse> | null;
    workOrderId: string;
  }> {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.quotesRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Quote not found');
    }

    const pendingStatus = await this.resolvePendingStatus({ tenantId });
    if (existing.statusLookupId !== pendingStatus.lookupId) {
      throw new BadRequestException('Only estimates in Pending status can be approved');
    }

    const job = existing.jobId
      ? await this.jobsRepo.findOne({ id: existing.jobId, tenantId })
      : null;
    if (this.isExternalJob(job)) {
      throw new BadRequestException('External estimates cannot be approved locally');
    }

    const approvedStatus = await this.resolveApprovedStatus({ tenantId });
    const woStatusId = await this.resolveWoStatus({ tenantId, name: 'Draft' });

    const woName = existing.name
      ? `WO — ${existing.name}`
      : `WO — Estimate ${existing.quoteNumber ?? params.id}`;

    const result = await this.db.transaction(async (tx) => {
      await this.quotesRepo.update({
        id: params.id,
        data: {
          statusLookupId: approvedStatus.lookupId,
          ...(params.userId ? { updatedByUserId: params.userId } : {}),
        },
        tx,
      });

      const wo = await this.workOrdersRepo.create({
        data: {
          tenantId,
          jobId: existing.jobId,
          claimId: existing.claimId ?? undefined,
          name: woName,
          totalAmount: existing.totalAmount ?? undefined,
          statusLookupId: woStatusId ?? undefined,
          note: `Created from approved estimate ${existing.quoteNumber ?? existing.name ?? params.id}`,
          createdByUserId: params.userId ?? null,
          updatedByUserId: params.userId ?? null,
        },
        tx,
      });

      await this.copyLineItemsToWorkOrder({
        tenantId,
        quoteId: params.id,
        workOrderId: wo.id,
        tx,
      });

      return { workOrderId: wo.id };
    });

    this.logger.log(
      `QuotesService.approve — quoteId=${params.id} set Approved, created workOrderId=${result.workOrderId}`,
    );

    const updated = await this.quotesRepo.findOne({ id: params.id, tenantId });
    return {
      quote: updated ? this.shapeQuoteResponse(updated) : null,
      workOrderId: result.workOrderId,
    };
  }

  /**
   * Copy the full quote line-item hierarchy (groups → combos → items) into a work order.
   */
  private async copyLineItemsToWorkOrder(params: {
    tenantId: string;
    quoteId: string;
    workOrderId: string;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const { tenantId, quoteId, workOrderId, tx } = params;
    const logPrefix = 'QuotesService.copyLineItemsToWorkOrder';

    const srcGroups = await tx
      .select()
      .from(quoteGroups)
      .where(and(eq(quoteGroups.tenantId, tenantId), eq(quoteGroups.quoteId, quoteId)))
      .orderBy(quoteGroups.sortIndex);

    if (srcGroups.length === 0) {
      this.logger.debug(`${logPrefix} — no groups to copy`);
      return;
    }

    const groupIds = srcGroups.map((g) => g.id);

    const srcCombos = await tx
      .select()
      .from(quoteCombos)
      .where(
        and(
          eq(quoteCombos.tenantId, tenantId),
          inArray(quoteCombos.quoteGroupId, groupIds),
          isNull(quoteCombos.deletedAt),
        ),
      )
      .orderBy(quoteCombos.sortIndex);

    const comboIds = srcCombos.map((c) => c.id);

    const srcGroupItems = groupIds.length > 0
      ? await tx
          .select()
          .from(quoteItems)
          .where(
            and(
              eq(quoteItems.tenantId, tenantId),
              inArray(quoteItems.quoteGroupId, groupIds),
              isNull(quoteItems.deletedAt),
            ),
          )
          .orderBy(quoteItems.sortIndex)
      : [];

    const srcComboItems = comboIds.length > 0
      ? await tx
          .select()
          .from(quoteItems)
          .where(
            and(
              eq(quoteItems.tenantId, tenantId),
              inArray(quoteItems.quoteComboId, comboIds),
              isNull(quoteItems.deletedAt),
            ),
          )
          .orderBy(quoteItems.sortIndex)
      : [];

    // Map old quote group ID → new WO group ID
    const groupIdMap = new Map<string, string>();
    for (const g of srcGroups) {
      const [woGroup] = await tx
        .insert(workOrderGroups)
        .values({
          tenantId,
          workOrderId,
          groupLabelLookupId: g.groupLabelLookupId,
          description: g.description,
          dimensions: g.dimensions,
          sortIndex: g.sortIndex,
          totals: g.totals,
        })
        .returning();
      groupIdMap.set(g.id, woGroup.id);
    }

    // Map old quote combo ID → new WO combo ID
    const comboIdMap = new Map<string, string>();
    for (const c of srcCombos) {
      const woGroupId = groupIdMap.get(c.quoteGroupId);
      if (!woGroupId) continue;
      const [woCombo] = await tx
        .insert(workOrderCombos)
        .values({
          tenantId,
          workOrderGroupId: woGroupId,
          catalogComboId: c.catalogComboId,
          name: c.name,
          description: c.description,
          category: c.category,
          subCategory: c.subCategory,
          quantity: c.quantity,
          sortIndex: c.sortIndex,
          totals: c.totals,
          comboPayload: c.comboPayload,
        })
        .returning();
      comboIdMap.set(c.id, woCombo.id);
    }

    for (const c of srcCombos) {
      const woComboId = comboIdMap.get(c.id);
      if (!woComboId) continue;
      const payload =
        c.comboPayload && typeof c.comboPayload === 'object'
          ? { ...(c.comboPayload as Record<string, unknown>) }
          : null;
      const parentId = payload && typeof payload.parentComboId === 'string' ? payload.parentComboId : null;
      if (!parentId) continue;
      const mappedParent = comboIdMap.get(parentId);
      if (!mappedParent || mappedParent === parentId) continue;
      await tx
        .update(workOrderCombos)
        .set({ comboPayload: { ...payload, parentComboId: mappedParent } })
        .where(eq(workOrderCombos.id, woComboId));
    }

    // Copy group-level items
    for (const item of srcGroupItems) {
      const woGroupId = groupIdMap.get(item.quoteGroupId!);
      if (!woGroupId) continue;
      await tx.insert(workOrderItems).values({
        tenantId,
        workOrderGroupId: woGroupId,
        catalogItemId: item.catalogItemId,
        unitTypeLookupId: item.unitTypeLookupId,
        name: item.name,
        description: item.description,
        category: item.category,
        subCategory: item.subCategory,
        itemType: item.itemType,
        quantity: item.quantity,
        tax: item.tax,
        unitCost: item.unitCost,
        buyCost: item.buyCost,
        markupType: item.markupType,
        markupValue: item.markupValue,
        sortIndex: item.sortIndex,
        note: item.note,
        tags: item.tags,
        totals: item.totals,
      });
    }

    // Copy combo-level items
    for (const item of srcComboItems) {
      const woComboId = comboIdMap.get(item.quoteComboId!);
      if (!woComboId) continue;
      await tx.insert(workOrderItems).values({
        tenantId,
        workOrderComboId: woComboId,
        catalogItemId: item.catalogItemId,
        unitTypeLookupId: item.unitTypeLookupId,
        name: item.name,
        description: item.description,
        category: item.category,
        subCategory: item.subCategory,
        itemType: item.itemType,
        quantity: item.quantity,
        tax: item.tax,
        unitCost: item.unitCost,
        buyCost: item.buyCost,
        markupType: item.markupType,
        markupValue: item.markupValue,
        sortIndex: item.sortIndex,
        note: item.note,
        tags: item.tags,
        totals: item.totals,
      });
    }

    this.logger.log(
      `${logPrefix} — copied ${srcGroups.length} groups, ${srcCombos.length} combos, ` +
      `${srcGroupItems.length + srcComboItems.length} items from quote ${quoteId} to WO ${workOrderId}`,
    );
  }
}

function parseOptionalUserId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '__unassigned__') return null;
  return trimmed;
}
