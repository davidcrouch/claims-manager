import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { LookupsRepository, ProposalsRepository } from '../../database/repositories';
import { proposalCombos, proposalGroups, proposalItems } from '../../database/schema';
import { TenantContext } from '../../tenant/tenant-context';
import { LookupResolutionService } from '../domain/services/lookup-resolution.service';
import { isScopeComboPayload } from '../catalog/catalog.utils';

function parseDecimal(value: string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function asNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

const PROPOSAL_DATE_FIELDS = ['receivedDate', 'proposalDate'] as const;
const PROPOSAL_NUMERIC_FIELDS = ['subTotal', 'totalTax', 'totalAmount'] as const;

function coerceProposalWrite(body: Record<string, unknown>): Record<string, unknown> {
  const data = { ...body };
  for (const key of PROPOSAL_DATE_FIELDS) {
    const value = data[key];
    if (typeof value === 'string') {
      data[key] = new Date(value);
    }
  }
  for (const key of PROPOSAL_NUMERIC_FIELDS) {
    const value = data[key];
    if (value != null && typeof value !== 'string') {
      data[key] = String(value);
    }
  }
  return data;
}

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger('ProposalsService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly proposalsRepo: ProposalsRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly tenantContext: TenantContext,
    private readonly lookupResolution: LookupResolutionService,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    rfqId?: string;
    status?: string;
    vendorId?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      rfqId: params.rfqId,
      status: params.status,
      vendorId: params.vendorId,
      sort: params.sort,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findOne({ id: params.id, tenantId });
  }

  async getProposalLineItems(params: { proposalId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`ProposalsService.getProposalLineItems proposalId=${params.proposalId}`);

    const groups = await this.db
      .select()
      .from(proposalGroups)
      .where(
        and(
          eq(proposalGroups.tenantId, tenantId),
          eq(proposalGroups.proposalId, params.proposalId),
        ),
      )
      .orderBy(proposalGroups.sortIndex);

    if (groups.length === 0) return [];

    const groupIds = groups.map((g) => g.id);

    const lookupIds = new Set<string>();
    for (const g of groups) {
      if (g.groupLabelLookupId) lookupIds.add(g.groupLabelLookupId);
    }

    const combos = await this.db
      .select()
      .from(proposalCombos)
      .where(
        and(
          eq(proposalCombos.tenantId, tenantId),
          inArray(proposalCombos.proposalGroupId, groupIds),
        ),
      )
      .orderBy(proposalCombos.sortIndex);

    const comboIds = combos.map((c) => c.id);

    const directItems =
      groupIds.length > 0
        ? await this.db
            .select()
            .from(proposalItems)
            .where(
              and(
                eq(proposalItems.tenantId, tenantId),
                inArray(proposalItems.proposalGroupId, groupIds),
              ),
            )
            .orderBy(proposalItems.sortIndex)
        : [];

    const comboChildItems =
      comboIds.length > 0
        ? await this.db
            .select()
            .from(proposalItems)
            .where(
              and(
                eq(proposalItems.tenantId, tenantId),
                inArray(proposalItems.proposalComboId, comboIds),
              ),
            )
            .orderBy(proposalItems.sortIndex)
        : [];

    for (const item of [...directItems, ...comboChildItems]) {
      if (item.unitTypeLookupId) lookupIds.add(item.unitTypeLookupId);
    }
    const lookupMap =
      lookupIds.size > 0
        ? await this.lookupsRepo.findByIds({ ids: [...lookupIds], tenantId })
        : new Map();

    const combosByGroup = new Map<string, typeof combos>();
    for (const combo of combos) {
      const list = combosByGroup.get(combo.proposalGroupId) ?? [];
      list.push(combo);
      combosByGroup.set(combo.proposalGroupId, list);
    }

    const directItemsByGroup = new Map<string, typeof directItems>();
    for (const item of directItems) {
      if (!item.proposalGroupId) continue;
      const list = directItemsByGroup.get(item.proposalGroupId) ?? [];
      list.push(item);
      directItemsByGroup.set(item.proposalGroupId, list);
    }

    const comboItemsByCombo = new Map<string, typeof comboChildItems>();
    for (const item of comboChildItems) {
      if (!item.proposalComboId) continue;
      const list = comboItemsByCombo.get(item.proposalComboId) ?? [];
      list.push(item);
      comboItemsByCombo.set(item.proposalComboId, list);
    }

    return groups.map((group, index) => {
      const dimensions = (group.dimensions as Record<string, unknown>) ?? {};
      const groupTotals = (group.totals as Record<string, unknown>) ?? {};
      const groupCombos = combosByGroup.get(group.id) ?? [];
      const assemblyCombos = groupCombos.filter((c) => !isScopeComboPayload(c.comboPayload));
      const scopeCombos = groupCombos.filter((c) => isScopeComboPayload(c.comboPayload));

      const lookupValue = group.groupLabelLookupId
        ? lookupMap.get(group.groupLabelLookupId)
        : null;
      const groupLabelObj = lookupValue
        ? { id: lookupValue.id, name: lookupValue.name, externalReference: lookupValue.externalReference }
        : group.description
          ? { name: group.description }
          : { name: `Group ${index + 1}` };

      const mapCombo = (combo: (typeof groupCombos)[number]) => {
        const comboTotals = (combo.totals as Record<string, unknown>) ?? {};
        const kind = isScopeComboPayload(combo.comboPayload) ? 'scope' : 'assembly';
        return {
          id: combo.id,
          kind,
          sourceRfqComboId: combo.sourceRfqComboId ?? undefined,
          name: combo.name,
          description: combo.description,
          category: combo.category,
          subCategory: combo.subCategory,
          index: combo.sortIndex,
          quantity: parseDecimal(combo.quantity),
          subTotal: asNumber(comboTotals.subTotal),
          totalTax: asNumber(comboTotals.totalTax),
          total: asNumber(comboTotals.total),
          items: (comboItemsByCombo.get(combo.id) ?? []).map((item) =>
            this.mapProposalItemRow(item, lookupMap),
          ),
        };
      };

      return {
        id: group.id,
        groupLabel: groupLabelObj,
        description: group.description,
        length: asNumber(dimensions.length),
        width: asNumber(dimensions.width),
        height: asNumber(dimensions.height),
        index: group.sortIndex,
        subTotal: asNumber(groupTotals.subTotal),
        totalTax: asNumber(groupTotals.totalTax),
        total: asNumber(groupTotals.total),
        items: (directItemsByGroup.get(group.id) ?? []).map((item) =>
          this.mapProposalItemRow(item, lookupMap),
        ),
        combos: assemblyCombos.map(mapCombo),
        scopes: scopeCombos.map((combo) => ({
          ...mapCombo(combo),
          combos: [],
        })),
      };
    });
  }

  private mapProposalItemRow(
    item: typeof proposalItems.$inferSelect,
    lookupMap: Map<string, { id: string; name: string | null; externalReference: string | null; [k: string]: unknown }>,
  ) {
    const unitLookup = item.unitTypeLookupId ? lookupMap.get(item.unitTypeLookupId) : null;
    const totals = (item.totals as Record<string, unknown>) ?? {};

    return {
      id: item.id,
      sourceRfqItemId: item.sourceRfqItemId ?? undefined,
      name: item.name,
      description: item.description,
      category: item.category,
      subCategory: item.subCategory,
      type: item.itemType,
      index: item.sortIndex,
      quantity: parseDecimal(item.quantity),
      tax: parseDecimal(item.tax),
      unitCost: parseDecimal(item.unitCost),
      buyCost: parseDecimal(item.buyCost),
      unitType: unitLookup
        ? { id: unitLookup.id, name: unitLookup.name, externalReference: unitLookup.externalReference }
        : undefined,
      note: item.note,
      subTotal: asNumber(totals.subTotal),
      totalTax: asNumber(totals.totalTax),
      total: asNumber(totals.total),
    };
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
    const data = coerceProposalWrite(params.body);
    this.logger.log(
      `ProposalsService.create tenantId=${tenantId} quoteId=${String(data.quoteId ?? '')} jobId=${String(data.jobId ?? '')}`,
    );
    return this.proposalsRepo.create({ data: { ...data, tenantId } as any });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.proposalsRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Proposal not found');
    }

    const data: Record<string, unknown> = coerceProposalWrite(params.body);

    // Resolve status by name if provided as { status: { name } }
    const statusObj = params.body.status as { name?: string } | undefined;
    if (statusObj?.name && typeof statusObj.name === 'string') {
      const statusLookupId = await this.lookupResolution.resolve({
        tenantId,
        domain: 'proposal_status',
        externalReference: statusObj.name,
        name: statusObj.name,
        autoCreate: true,
      });
      if (statusLookupId) {
        data.statusLookupId = statusLookupId;
      }
      delete data.status;
    }

    return this.proposalsRepo.update({ id: params.id, data: data as any });
  }

  async accept(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.proposalsRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Proposal not found');
    }

    const statusLookupId = await this.lookupResolution.resolve({
      tenantId,
      domain: 'proposal_status',
      externalReference: 'Accepted',
      name: 'Accepted',
      autoCreate: true,
    });

    const updated = await this.proposalsRepo.update({
      id: params.id,
      data: { statusLookupId: statusLookupId ?? undefined },
    });

    this.logger.log(`ProposalsService.accept — proposal=${params.id} accepted`);
    return updated;
  }

  async decline(params: { id: string; reason?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.proposalsRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Proposal not found');
    }

    const statusLookupId = await this.lookupResolution.resolve({
      tenantId,
      domain: 'proposal_status',
      externalReference: 'Declined',
      name: 'Declined',
      autoCreate: true,
    });

    const customData = {
      ...((existing.customData as Record<string, unknown> | null) ?? {}),
      ...(params.reason ? { declineReason: params.reason } : {}),
    };

    const updated = await this.proposalsRepo.update({
      id: params.id,
      data: {
        statusLookupId: statusLookupId ?? undefined,
        customData,
      },
    });

    this.logger.log(`ProposalsService.decline — proposal=${params.id} declined`);
    return updated;
  }
}
