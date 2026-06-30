import { Injectable, Inject, Logger } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../database/drizzle.module';
import type { DrizzleDB } from '../../database/drizzle.module';
import { RfqsRepository, LookupsRepository } from '../../database/repositories';
import {
  rfqGroups,
  rfqCombos,
  rfqItems,
  quoteGroups,
  quoteCombos,
  quoteItems,
} from '../../database/schema';
import { TenantContext } from '../../tenant/tenant-context';

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

@Injectable()
export class RfqsService {
  private readonly logger = new Logger('api:RfqsService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly rfqsRepo: RfqsRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    quoteId?: string;
    vendorId?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`api:RfqsService.findAll tenantId=${tenantId}`);
    return this.rfqsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      quoteId: params.quoteId,
      vendorId: params.vendorId,
      sort: params.sort,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`api:RfqsService.findOne id=${params.id} tenantId=${tenantId}`);
    return this.rfqsRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`api:RfqsService.findByJob jobId=${params.jobId} tenantId=${tenantId}`);
    return this.rfqsRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async findByQuote(params: { quoteId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`api:RfqsService.findByQuote quoteId=${params.quoteId} tenantId=${tenantId}`);
    return this.rfqsRepo.findByQuote({ quoteId: params.quoteId, tenantId });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(`api:RfqsService.create tenantId=${tenantId}`);

    const { selectedItemIds, ...rfqData } = params.body;
    const rfq = await this.rfqsRepo.create({ data: { ...rfqData, tenantId } as any });

    if (
      rfq.quoteId &&
      Array.isArray(selectedItemIds) &&
      selectedItemIds.length > 0
    ) {
      await this.createScopeItemsFromQuote({
        rfqId: rfq.id,
        quoteId: rfq.quoteId,
        tenantId,
        selectedItemIds: selectedItemIds as string[],
      });
    }

    return rfq;
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    this.logger.log(`api:RfqsService.update id=${params.id}`);
    return this.rfqsRepo.update({ id: params.id, data: params.body as any });
  }

  async getRfqLineItems(params: { rfqId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`api:RfqsService.getRfqLineItems rfqId=${params.rfqId}`);

    const groups = await this.db
      .select()
      .from(rfqGroups)
      .where(
        and(
          eq(rfqGroups.tenantId, tenantId),
          eq(rfqGroups.rfqId, params.rfqId),
        ),
      )
      .orderBy(rfqGroups.sortIndex);

    if (groups.length === 0) return [];

    const groupIds = groups.map((g) => g.id);

    const lookupIds = new Set<string>();
    for (const g of groups) {
      if (g.groupLabelLookupId) lookupIds.add(g.groupLabelLookupId);
    }

    const combos = await this.db
      .select()
      .from(rfqCombos)
      .where(
        and(
          eq(rfqCombos.tenantId, tenantId),
          inArray(rfqCombos.rfqGroupId, groupIds),
        ),
      )
      .orderBy(rfqCombos.sortIndex);

    const comboIds = combos.map((c) => c.id);

    const directItems = groupIds.length > 0
      ? await this.db
          .select()
          .from(rfqItems)
          .where(
            and(
              eq(rfqItems.tenantId, tenantId),
              inArray(rfqItems.rfqGroupId, groupIds),
            ),
          )
          .orderBy(rfqItems.sortIndex)
      : [];

    const comboChildItems = comboIds.length > 0
      ? await this.db
          .select()
          .from(rfqItems)
          .where(
            and(
              eq(rfqItems.tenantId, tenantId),
              inArray(rfqItems.rfqComboId, comboIds),
            ),
          )
          .orderBy(rfqItems.sortIndex)
      : [];

    for (const item of [...directItems, ...comboChildItems]) {
      if (item.unitTypeLookupId) lookupIds.add(item.unitTypeLookupId);
    }
    const lookupMap = lookupIds.size > 0
      ? await this.lookupsRepo.findByIds({ ids: [...lookupIds], tenantId })
      : new Map<string, any>();

    const combosByGroup = new Map<string, typeof combos>();
    for (const combo of combos) {
      const list = combosByGroup.get(combo.rfqGroupId) ?? [];
      list.push(combo);
      combosByGroup.set(combo.rfqGroupId, list);
    }

    const directItemsByGroup = new Map<string, typeof directItems>();
    for (const item of directItems) {
      if (!item.rfqGroupId) continue;
      const list = directItemsByGroup.get(item.rfqGroupId) ?? [];
      list.push(item);
      directItemsByGroup.set(item.rfqGroupId, list);
    }

    const comboItemsByCombo = new Map<string, typeof comboChildItems>();
    for (const item of comboChildItems) {
      if (!item.rfqComboId) continue;
      const list = comboItemsByCombo.get(item.rfqComboId) ?? [];
      list.push(item);
      comboItemsByCombo.set(item.rfqComboId, list);
    }

    return groups.map((group, index) => {
      const dimensions = (group.dimensions as Record<string, unknown>) ?? {};
      const groupTotals = (group.totals as Record<string, unknown>) ?? {};
      const groupCombos = combosByGroup.get(group.id) ?? [];

      const lookupValue = group.groupLabelLookupId
        ? lookupMap.get(group.groupLabelLookupId)
        : null;
      const groupLabelObj = lookupValue
        ? { id: lookupValue.id, name: lookupValue.name, externalReference: lookupValue.externalReference }
        : group.description
          ? { name: group.description }
          : { name: `Group ${index + 1}` };

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
          this.mapRfqItemRow(item, lookupMap),
        ),
        combos: groupCombos.map((combo) => {
          const comboTotals = (combo.totals as Record<string, unknown>) ?? {};
          return {
            id: combo.id,
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
              this.mapRfqItemRow(item, lookupMap),
            ),
          };
        }),
      };
    });
  }

  private mapRfqItemRow(
    item: typeof rfqItems.$inferSelect,
    lookupMap: Map<string, any>,
  ) {
    const unitLookup = item.unitTypeLookupId
      ? lookupMap.get(item.unitTypeLookupId)
      : null;
    const totals = (item.totals as Record<string, unknown>) ?? {};

    return {
      id: item.id,
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

  private async createScopeItemsFromQuote(params: {
    rfqId: string;
    quoteId: string;
    tenantId: string;
    selectedItemIds: string[];
  }) {
    const { rfqId, quoteId, tenantId, selectedItemIds } = params;
    const selectedSet = new Set(selectedItemIds);

    this.logger.log(
      `api:RfqsService.createScopeItemsFromQuote rfqId=${rfqId} quoteId=${quoteId} selectedItems=${selectedItemIds.length}`,
    );

    const sourceGroups = await this.db
      .select()
      .from(quoteGroups)
      .where(
        and(
          eq(quoteGroups.tenantId, tenantId),
          eq(quoteGroups.quoteId, quoteId),
        ),
      )
      .orderBy(quoteGroups.sortIndex);

    if (sourceGroups.length === 0) return;

    const groupIds = sourceGroups.map((g) => g.id);

    const sourceCombos = await this.db
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

    const comboIds = sourceCombos.map((c) => c.id);

    const sourceDirectItems = groupIds.length > 0
      ? await this.db
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

    const sourceComboItems = comboIds.length > 0
      ? await this.db
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

    for (const group of sourceGroups) {
      const groupDirectItems = sourceDirectItems.filter(
        (i) => i.quoteGroupId === group.id && i.id && selectedSet.has(i.id),
      );
      const groupCombos = sourceCombos.filter((c) => c.quoteGroupId === group.id);
      const relevantCombos = groupCombos.filter((c) => selectedSet.has(c.id));

      if (groupDirectItems.length === 0 && relevantCombos.length === 0) continue;

      const [rfqGroup] = await this.db
        .insert(rfqGroups)
        .values({
          tenantId,
          rfqId,
          sourceQuoteGroupId: group.id,
          groupLabelLookupId: group.groupLabelLookupId,
          description: group.description,
          dimensions: group.dimensions,
          sortIndex: group.sortIndex,
          totals: group.totals,
          groupPayload: group.groupPayload,
        })
        .returning();

      for (const item of groupDirectItems) {
        await this.db.insert(rfqItems).values({
          tenantId,
          rfqGroupId: rfqGroup.id,
          sourceQuoteItemId: item.id,
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
          sortIndex: item.sortIndex,
          note: item.note,
          totals: item.totals,
          itemPayload: item.itemPayload,
        });
      }

      for (const combo of relevantCombos) {
        const [rfqCombo] = await this.db
          .insert(rfqCombos)
          .values({
            tenantId,
            rfqGroupId: rfqGroup.id,
            sourceQuoteComboId: combo.id,
            name: combo.name,
            description: combo.description,
            category: combo.category,
            subCategory: combo.subCategory,
            quantity: combo.quantity,
            sortIndex: combo.sortIndex,
            totals: combo.totals,
            comboPayload: combo.comboPayload,
          })
          .returning();

        const comboChildItems = sourceComboItems.filter(
          (i) => i.quoteComboId === combo.id && i.id && selectedSet.has(i.id),
        );

        for (const item of comboChildItems) {
          await this.db.insert(rfqItems).values({
            tenantId,
            rfqComboId: rfqCombo.id,
            sourceQuoteItemId: item.id,
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
            sortIndex: item.sortIndex,
            note: item.note,
            totals: item.totals,
            itemPayload: item.itemPayload,
          });
        }
      }
    }
  }
}
