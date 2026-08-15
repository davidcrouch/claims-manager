import { BadRequestException, Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
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
  proposals,
  proposalGroups,
  proposalCombos,
  proposalItems,
} from '../../database/schema';
import { TenantContext } from '../../tenant/tenant-context';
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
    status?: string;
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
      status: params.status,
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

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(`api:RfqsService.create tenantId=${tenantId}`);

    const {
      selectedItemIds,
      createdByUserId: _c,
      updatedByUserId: _u,
      ...rfqData
    } = params.body;
    const rfq = await this.rfqsRepo.create({
      data: {
        ...rfqData,
        tenantId,
        createdByUserId: params.userId ?? null,
        updatedByUserId: params.userId ?? null,
      } as any,
    });

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

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    userId?: string;
  }) {
    this.logger.log(`api:RfqsService.update id=${params.id}`);
    const { createdByUserId: _c, updatedByUserId: _u, ...rest } = params.body;
    return this.rfqsRepo.update({
      id: params.id,
      data: {
        ...rest,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      } as any,
    });
  }

  async replaceScopeItems(params: { rfqId: string; selectedItemIds: string[] }) {
    const tenantId = this.tenantContext.getTenantId();
    const { rfqId, selectedItemIds } = params;
    this.logger.log(
      `api:RfqsService.replaceScopeItems rfqId=${rfqId} selectedItems=${selectedItemIds.length}`,
    );

    if (selectedItemIds.length === 0) {
      throw new BadRequestException('Select at least one scope item');
    }

    const rfq = await this.rfqsRepo.findOne({ id: rfqId, tenantId });
    if (!rfq) throw new NotFoundException(`RFQ ${rfqId} not found`);
    if (!rfq.quoteId) {
      throw new BadRequestException('RFQ has no linked estimate to rebuild scope from');
    }

    const [proposalRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposals)
      .where(and(eq(proposals.tenantId, tenantId), eq(proposals.rfqId, rfqId)));
    if ((proposalRow?.count ?? 0) > 0) {
      throw new BadRequestException(
        'Cannot change RFQ scope after proposals have been created for this RFQ',
      );
    }

    // Clear optional lineage FKs so cascade delete of RFQ groups cannot violate refs.
    // Also capture existing RFQ notes so we can re-apply them after rebuild.
    const existingGroups = await this.db
      .select({
        id: rfqGroups.id,
        sourceQuoteGroupId: rfqGroups.sourceQuoteGroupId,
        note: rfqGroups.note,
      })
      .from(rfqGroups)
      .where(and(eq(rfqGroups.tenantId, tenantId), eq(rfqGroups.rfqId, rfqId)));
    const existingGroupIds = existingGroups.map((g) => g.id);

    const preservedNotes = {
      groups: new Map<string, string | null>(),
      combos: new Map<string, string | null>(),
      items: new Map<string, string | null>(),
    };
    for (const g of existingGroups) {
      if (g.sourceQuoteGroupId && g.note != null && g.note !== '') {
        preservedNotes.groups.set(g.sourceQuoteGroupId, g.note);
      }
    }

    if (existingGroupIds.length > 0) {
      const existingCombos = await this.db
        .select({
          id: rfqCombos.id,
          sourceQuoteComboId: rfqCombos.sourceQuoteComboId,
          note: rfqCombos.note,
        })
        .from(rfqCombos)
        .where(
          and(
            eq(rfqCombos.tenantId, tenantId),
            inArray(rfqCombos.rfqGroupId, existingGroupIds),
          ),
        );
      const existingComboIds = existingCombos.map((c) => c.id);
      for (const c of existingCombos) {
        if (c.sourceQuoteComboId && c.note != null && c.note !== '') {
          preservedNotes.combos.set(c.sourceQuoteComboId, c.note);
        }
      }

      const groupItems = await this.db
        .select({
          id: rfqItems.id,
          sourceQuoteItemId: rfqItems.sourceQuoteItemId,
          note: rfqItems.note,
        })
        .from(rfqItems)
        .where(
          and(
            eq(rfqItems.tenantId, tenantId),
            inArray(rfqItems.rfqGroupId, existingGroupIds),
          ),
        );
      const comboItems =
        existingComboIds.length > 0
          ? await this.db
              .select({
                id: rfqItems.id,
                sourceQuoteItemId: rfqItems.sourceQuoteItemId,
                note: rfqItems.note,
              })
              .from(rfqItems)
              .where(
                and(
                  eq(rfqItems.tenantId, tenantId),
                  inArray(rfqItems.rfqComboId, existingComboIds),
                ),
              )
          : [];
      for (const item of [...groupItems, ...comboItems]) {
        if (item.sourceQuoteItemId && item.note != null && item.note !== '') {
          preservedNotes.items.set(item.sourceQuoteItemId, item.note);
        }
      }
      const existingItemIds = [...groupItems, ...comboItems].map((i) => i.id);

      if (existingItemIds.length > 0) {
        await this.db
          .update(proposalItems)
          .set({ sourceRfqItemId: null })
          .where(inArray(proposalItems.sourceRfqItemId, existingItemIds));
      }
      if (existingComboIds.length > 0) {
        await this.db
          .update(proposalCombos)
          .set({ sourceRfqComboId: null })
          .where(inArray(proposalCombos.sourceRfqComboId, existingComboIds));
      }
      await this.db
        .update(proposalGroups)
        .set({ sourceRfqGroupId: null })
        .where(inArray(proposalGroups.sourceRfqGroupId, existingGroupIds));

      await this.db
        .delete(rfqGroups)
        .where(and(eq(rfqGroups.tenantId, tenantId), eq(rfqGroups.rfqId, rfqId)));
    }

    await this.createScopeItemsFromQuote({
      rfqId,
      quoteId: rfq.quoteId,
      tenantId,
      selectedItemIds,
      preservedNotes,
    });

    return this.getRfqLineItems({ rfqId });
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

    const assemblyCombos = groupCombos.filter((c) => !isScopeComboPayload(c.comboPayload));
    const scopeCombos = groupCombos.filter((c) => isScopeComboPayload(c.comboPayload));

    const mapCombo = (combo: (typeof groupCombos)[number]) => {
      const comboTotals = (combo.totals as Record<string, unknown>) ?? {};
      const kind = isScopeComboPayload(combo.comboPayload) ? 'scope' : 'assembly';
      return {
        id: combo.id,
        kind,
        sourceQuoteComboId: combo.sourceQuoteComboId ?? undefined,
        name: combo.name,
        description: combo.description,
        note: combo.note,
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
    };

    return {
      id: group.id,
      sourceQuoteGroupId: group.sourceQuoteGroupId ?? undefined,
      groupLabel: groupLabelObj,
      description: group.description,
      note: group.note,
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
      combos: assemblyCombos.map(mapCombo),
      scopes: scopeCombos.map((combo) => ({
        ...mapCombo(combo),
        combos: [],
      })),
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
      sourceQuoteItemId: item.sourceQuoteItemId ?? undefined,
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
    preservedNotes?: {
      groups: Map<string, string | null>;
      combos: Map<string, string | null>;
      items: Map<string, string | null>;
    };
  }) {
    const { rfqId, quoteId, tenantId, selectedItemIds, preservedNotes } = params;
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
          note: preservedNotes?.groups.get(group.id) ?? null,
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
          note: preservedNotes?.items.get(item.id) ?? item.note,
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
            note: preservedNotes?.combos.get(combo.id) ?? null,
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
            note: preservedNotes?.items.get(item.id) ?? item.note,
            totals: item.totals,
            itemPayload: item.itemPayload,
          });
        }
      }
    }
  }

  async updateLineNote(params: {
    rfqId: string;
    targetType: 'group' | 'combo' | 'item';
    targetId: string;
    note: string | null;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const { rfqId, targetType, targetId } = params;
    const note = params.note?.trim() ? params.note : null;

    this.logger.log(
      `api:RfqsService.updateLineNote rfqId=${rfqId} targetType=${targetType} targetId=${targetId}`,
    );

    if (!targetType || !['group', 'combo', 'item'].includes(targetType)) {
      throw new BadRequestException('targetType must be group, combo, or item');
    }
    if (!targetId) {
      throw new BadRequestException('targetId is required');
    }

    const rfq = await this.rfqsRepo.findOne({ id: rfqId, tenantId });
    if (!rfq) throw new NotFoundException(`RFQ ${rfqId} not found`);

    if (targetType === 'group') {
      const [group] = await this.db
        .select({ id: rfqGroups.id })
        .from(rfqGroups)
        .where(
          and(
            eq(rfqGroups.tenantId, tenantId),
            eq(rfqGroups.rfqId, rfqId),
            eq(rfqGroups.id, targetId),
          ),
        )
        .limit(1);
      if (!group) throw new NotFoundException(`RFQ group ${targetId} not found`);
      await this.db
        .update(rfqGroups)
        .set({ note, updatedAt: new Date() })
        .where(eq(rfqGroups.id, targetId));
      return { success: true, targetType, targetId, note };
    }

    if (targetType === 'combo') {
      const [combo] = await this.db
        .select({ id: rfqCombos.id, rfqGroupId: rfqCombos.rfqGroupId })
        .from(rfqCombos)
        .innerJoin(rfqGroups, eq(rfqCombos.rfqGroupId, rfqGroups.id))
        .where(
          and(
            eq(rfqCombos.tenantId, tenantId),
            eq(rfqCombos.id, targetId),
            eq(rfqGroups.rfqId, rfqId),
          ),
        )
        .limit(1);
      if (!combo) throw new NotFoundException(`RFQ combo ${targetId} not found`);
      await this.db
        .update(rfqCombos)
        .set({ note, updatedAt: new Date() })
        .where(eq(rfqCombos.id, targetId));
      return { success: true, targetType, targetId, note };
    }

    if (targetType === 'item') {
      const [item] = await this.db
        .select({
          id: rfqItems.id,
          rfqGroupId: rfqItems.rfqGroupId,
          rfqComboId: rfqItems.rfqComboId,
        })
        .from(rfqItems)
        .where(and(eq(rfqItems.tenantId, tenantId), eq(rfqItems.id, targetId)))
        .limit(1);
      if (!item) throw new NotFoundException(`RFQ item ${targetId} not found`);

      let belongsToRfq = false;
      if (item.rfqGroupId) {
        const [g] = await this.db
          .select({ id: rfqGroups.id })
          .from(rfqGroups)
          .where(
            and(
              eq(rfqGroups.id, item.rfqGroupId),
              eq(rfqGroups.rfqId, rfqId),
              eq(rfqGroups.tenantId, tenantId),
            ),
          )
          .limit(1);
        belongsToRfq = !!g;
      } else if (item.rfqComboId) {
        const [c] = await this.db
          .select({ id: rfqCombos.id })
          .from(rfqCombos)
          .innerJoin(rfqGroups, eq(rfqCombos.rfqGroupId, rfqGroups.id))
          .where(
            and(
              eq(rfqCombos.id, item.rfqComboId),
              eq(rfqGroups.rfqId, rfqId),
              eq(rfqCombos.tenantId, tenantId),
            ),
          )
          .limit(1);
        belongsToRfq = !!c;
      }
      if (!belongsToRfq) throw new NotFoundException(`RFQ item ${targetId} not found on RFQ ${rfqId}`);

      await this.db
        .update(rfqItems)
        .set({ note, updatedAt: new Date() })
        .where(eq(rfqItems.id, targetId));
      return { success: true, targetType, targetId, note };
    }

    throw new BadRequestException(`Invalid targetType: ${targetType}`);
  }
}
