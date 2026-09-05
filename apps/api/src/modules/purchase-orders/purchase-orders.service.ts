import { Injectable, Optional, BadRequestException, Logger, Inject, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { PurchaseOrdersRepository } from '../../database/repositories';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../database/drizzle.module';
import {
  lookupValues,
  purchaseOrderGroups,
  purchaseOrderCombos,
  purchaseOrderItems,
  workOrderGroups,
  workOrderCombos,
  workOrderItems,
  proposalGroups,
  proposalCombos,
  proposalItems,
  invoices,
} from '../../database/schema';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';
import { RecordNumberService } from '../../common/record-number/record-number.service';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    private readonly recordNumberService: RecordNumberService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
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
    jobIds?: string[];
    status?: string;
    vendorId?: string;
    ownershipStatus?: string;
    captureMethod?: string;
    search?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.purchaseOrdersRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      jobIds: params.jobIds,
      status: params.status,
      vendorId: params.vendorId,
      ownershipStatus: params.ownershipStatus,
      captureMethod: params.captureMethod,
      search: params.search,
      sort: params.sort,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.purchaseOrdersRepo.findOne({ id: params.id, tenantId });
  }

  async assertPurchaseOrderEditable(params: { id: string }): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.purchaseOrdersRepo.findOne({ id: params.id, tenantId });
    if (!row) throw new NotFoundException('Purchase order not found');

    let statusName = '';
    if (row.statusLookupId) {
      const [lookup] = await this.db
        .select({ name: lookupValues.name })
        .from(lookupValues)
        .where(
          and(
            eq(lookupValues.id, row.statusLookupId),
            eq(lookupValues.tenantId, tenantId),
          ),
        )
        .limit(1);
      statusName = (lookup?.name ?? '').trim().toLowerCase();
    }
    if (!statusName) {
      const payload = row.purchaseOrderPayload as Record<string, unknown> | null;
      const statusBlock = payload?.status;
      if (statusBlock && typeof statusBlock === 'object') {
        statusName = String((statusBlock as Record<string, unknown>).name ?? '')
          .trim()
          .toLowerCase();
      }
    }

    if (statusName === 'archived') {
      throw new BadRequestException('Archived purchase orders cannot be edited');
    }
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.purchaseOrdersRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(`api:PurchaseOrdersService.create tenantId=${tenantId}`);
    const {
      createdByUserId: _c,
      updatedByUserId: _u,
      internalNumber: bodyInternalNumber,
      purchaseOrderNumber: bodyPurchaseOrderNumber,
      selectedItemIds: rawSelectedItemIds,
      ...rest
    } = params.body;

    const selectedItemIds = Array.isArray(rawSelectedItemIds)
      ? (rawSelectedItemIds as unknown[]).filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        )
      : [];

    const payload =
      rest.purchaseOrderPayload && typeof rest.purchaseOrderPayload === 'object'
        ? (rest.purchaseOrderPayload as Record<string, unknown>)
        : {};
    const sourceWorkOrderId =
      typeof payload.sourceWorkOrderId === 'string'
        ? payload.sourceWorkOrderId
        : null;
    const sourceProposalId =
      typeof payload.sourceProposalId === 'string'
        ? payload.sourceProposalId
        : null;
    const copyFromProposal = payload.copyLineItemsFromProposal === true;

    return this.db.transaction(async (tx) => {
      const internalNumber = await this.recordNumberService.resolve({
        tenantId,
        entity: 'purchase_order',
        explicit: bodyInternalNumber,
        tx,
      });
      const purchaseOrderNumber = this.recordNumberService.isBlank(bodyPurchaseOrderNumber)
        ? null
        : String(bodyPurchaseOrderNumber).trim();

      const po = await this.purchaseOrdersRepo.create({
        data: {
          ...rest,
          tenantId,
          internalNumber,
          purchaseOrderNumber,
          createdByUserId: params.userId ?? null,
          updatedByUserId: params.userId ?? null,
        } as any,
        tx,
      });

      if (sourceWorkOrderId && selectedItemIds.length > 0) {
        await this.copySelectedLineItemsFromWorkOrder({
          tenantId,
          purchaseOrderId: po.id,
          workOrderId: sourceWorkOrderId,
          selectedItemIds,
          tx,
        });
      } else if (sourceProposalId && copyFromProposal) {
        await this.copyLineItemsFromProposal({
          tenantId,
          purchaseOrderId: po.id,
          proposalId: sourceProposalId,
          tx,
        });
      }

      return po;
    });
  }

  /**
   * Copy selected work-order line items (groups → combos/scopes → items)
   * into a newly created purchase order. Selection semantics match RFQ
   * scope creation from an estimate.
   */
  private async copySelectedLineItemsFromWorkOrder(params: {
    tenantId: string;
    purchaseOrderId: string;
    workOrderId: string;
    selectedItemIds: string[];
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const { tenantId, purchaseOrderId, workOrderId, selectedItemIds, tx } =
      params;
    const logPrefix = 'PurchaseOrdersService.copySelectedLineItemsFromWorkOrder';
    const selectedSet = new Set(selectedItemIds);

    this.logger.log(
      `${logPrefix} poId=${purchaseOrderId} woId=${workOrderId} selectedItems=${selectedItemIds.length}`,
    );

    const sourceGroups = await tx
      .select()
      .from(workOrderGroups)
      .where(
        and(
          eq(workOrderGroups.tenantId, tenantId),
          eq(workOrderGroups.workOrderId, workOrderId),
          isNull(workOrderGroups.deletedAt),
        ),
      )
      .orderBy(workOrderGroups.sortIndex);

    if (sourceGroups.length === 0) {
      this.logger.debug(`${logPrefix} — no groups to copy`);
      return;
    }

    const groupIds = sourceGroups.map((g) => g.id);

    const sourceCombos = await tx
      .select()
      .from(workOrderCombos)
      .where(
        and(
          eq(workOrderCombos.tenantId, tenantId),
          inArray(workOrderCombos.workOrderGroupId, groupIds),
          isNull(workOrderCombos.deletedAt),
        ),
      )
      .orderBy(workOrderCombos.sortIndex);

    const comboIds = sourceCombos.map((c) => c.id);

    const sourceDirectItems =
      groupIds.length > 0
        ? await tx
            .select()
            .from(workOrderItems)
            .where(
              and(
                eq(workOrderItems.tenantId, tenantId),
                inArray(workOrderItems.workOrderGroupId, groupIds),
                isNull(workOrderItems.deletedAt),
              ),
            )
            .orderBy(workOrderItems.sortIndex)
        : [];

    const sourceComboItems =
      comboIds.length > 0
        ? await tx
            .select()
            .from(workOrderItems)
            .where(
              and(
                eq(workOrderItems.tenantId, tenantId),
                inArray(workOrderItems.workOrderComboId, comboIds),
                isNull(workOrderItems.deletedAt),
              ),
            )
            .orderBy(workOrderItems.sortIndex)
        : [];

    const comboIdMap = new Map<string, string>();

    for (const group of sourceGroups) {
      const groupDirectItems = sourceDirectItems.filter(
        (i) => i.workOrderGroupId === group.id && i.id && selectedSet.has(i.id),
      );
      const groupCombos = sourceCombos.filter(
        (c) => c.workOrderGroupId === group.id,
      );
      const relevantCombos = groupCombos.filter((c) => {
        if (selectedSet.has(c.id)) return true;
        return sourceComboItems.some(
          (i) => i.workOrderComboId === c.id && i.id && selectedSet.has(i.id),
        );
      });

      if (groupDirectItems.length === 0 && relevantCombos.length === 0) continue;

      const [poGroup] = await tx
        .insert(purchaseOrderGroups)
        .values({
          tenantId,
          purchaseOrderId,
          groupLabelLookupId: group.groupLabelLookupId,
          description: group.description,
          component: group.component,
          dimensions: group.dimensions,
          sortIndex: group.sortIndex,
          totals: group.totals,
          groupPayload: {
            ...((group.groupPayload as Record<string, unknown>) ?? {}),
            sourceWorkOrderGroupId: group.id,
          },
        })
        .returning();

      for (const item of groupDirectItems) {
        await tx.insert(purchaseOrderItems).values({
          tenantId,
          purchaseOrderGroupId: poGroup.id,
          catalogItemId: item.catalogItemId,
          quoteLineItemId: item.quoteLineItemId,
          unitTypeLookupId: item.unitTypeLookupId,
          name: item.name,
          component: item.component,
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
          reconciliation: item.reconciliation,
          manualAllocation: item.manualAllocation,
          sortIndex: item.sortIndex,
          note: item.note,
          tags: item.tags,
          totals: item.totals,
          itemPayload: {
            ...((item.itemPayload as Record<string, unknown>) ?? {}),
            sourceWorkOrderItemId: item.id,
          },
        });
      }

      for (const combo of relevantCombos) {
        const [poCombo] = await tx
          .insert(purchaseOrderCombos)
          .values({
            tenantId,
            purchaseOrderGroupId: poGroup.id,
            catalogComboId: combo.catalogComboId,
            quoteComboId: combo.quoteComboId,
            name: combo.name,
            component: combo.component,
            description: combo.description,
            category: combo.category,
            subCategory: combo.subCategory,
            quantity: combo.quantity,
            sortIndex: combo.sortIndex,
            totals: combo.totals,
            comboPayload: {
              ...((combo.comboPayload as Record<string, unknown>) ?? {}),
              sourceWorkOrderComboId: combo.id,
            },
          })
          .returning();
        comboIdMap.set(combo.id, poCombo.id);

        const siblingItemIds = sourceComboItems
          .filter((i) => i.workOrderComboId === combo.id && i.id)
          .map((i) => i.id as string);
        const anyChildSelected = siblingItemIds.some((id) => selectedSet.has(id));
        // Parent id alone means "select all". Once any child is in the set,
        // copy only those children — otherwise a stale parent id after
        // unchecking a row would pull the unchecked item back in.
        const includeAllChildren =
          selectedSet.has(combo.id) && !anyChildSelected;
        const comboChildItems = sourceComboItems.filter(
          (i) =>
            i.workOrderComboId === combo.id &&
            !!i.id &&
            (includeAllChildren || selectedSet.has(i.id)),
        );

        for (const item of comboChildItems) {
          await tx.insert(purchaseOrderItems).values({
            tenantId,
            purchaseOrderComboId: poCombo.id,
            catalogItemId: item.catalogItemId,
            quoteLineItemId: item.quoteLineItemId,
            unitTypeLookupId: item.unitTypeLookupId,
            name: item.name,
            component: item.component,
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
            reconciliation: item.reconciliation,
            manualAllocation: item.manualAllocation,
            sortIndex: item.sortIndex,
            note: item.note,
            tags: item.tags,
            totals: item.totals,
            itemPayload: {
              ...((item.itemPayload as Record<string, unknown>) ?? {}),
              sourceWorkOrderItemId: item.id,
            },
          });
        }
      }
    }

    // Remap nested parentComboId references inside combo payloads.
    for (const [sourceComboId, poComboId] of comboIdMap) {
      const sourceCombo = sourceCombos.find((c) => c.id === sourceComboId);
      if (!sourceCombo) continue;
      const payload =
        sourceCombo.comboPayload && typeof sourceCombo.comboPayload === 'object'
          ? { ...(sourceCombo.comboPayload as Record<string, unknown>) }
          : null;
      const parentId =
        payload && typeof payload.parentComboId === 'string'
          ? payload.parentComboId
          : null;
      if (!parentId) continue;
      const mappedParent = comboIdMap.get(parentId);
      if (!mappedParent || mappedParent === parentId) continue;
      await tx
        .update(purchaseOrderCombos)
        .set({
          comboPayload: {
            ...payload,
            parentComboId: mappedParent,
            sourceWorkOrderComboId: sourceComboId,
          },
        })
        .where(eq(purchaseOrderCombos.id, poComboId));
    }
  }

  async replaceSelectedLineItems(params: {
    id: string;
    selectedItemIds: string[];
  }): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const { id: purchaseOrderId, selectedItemIds } = params;
    const logPrefix = 'PurchaseOrdersService.replaceSelectedLineItems';

    if (selectedItemIds.length === 0) {
      throw new BadRequestException('Select at least one line item');
    }

    await this.assertPurchaseOrderEditable({ id: purchaseOrderId });

    const po = await this.purchaseOrdersRepo.findOne({ id: purchaseOrderId, tenantId });
    if (!po) throw new NotFoundException('Purchase order not found');

    const payload =
      po.purchaseOrderPayload && typeof po.purchaseOrderPayload === 'object'
        ? (po.purchaseOrderPayload as Record<string, unknown>)
        : {};
    const sourceWorkOrderId =
      typeof payload.sourceWorkOrderId === 'string' ? payload.sourceWorkOrderId : null;
    const sourceProposalId =
      typeof payload.sourceProposalId === 'string' ? payload.sourceProposalId : null;

    if (!sourceWorkOrderId && !sourceProposalId) {
      throw new BadRequestException(
        'Purchase order has no linked work order or proposal to rebuild line items from',
      );
    }

    this.logger.log(
      `${logPrefix} poId=${purchaseOrderId} selectedItems=${selectedItemIds.length} wo=${sourceWorkOrderId ?? 'none'} proposal=${sourceProposalId ?? 'none'}`,
    );

    await this.db.transaction(async (tx) => {
      const [invoiceRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.purchaseOrderId, purchaseOrderId),
          ),
        );
      if ((invoiceRow?.count ?? 0) > 0) {
        throw new BadRequestException(
          'Cannot change purchase order line items after bills have been created',
        );
      }

      await tx
        .delete(purchaseOrderGroups)
        .where(
          and(
            eq(purchaseOrderGroups.tenantId, tenantId),
            eq(purchaseOrderGroups.purchaseOrderId, purchaseOrderId),
          ),
        );

      if (sourceWorkOrderId) {
        await this.copySelectedLineItemsFromWorkOrder({
          tenantId,
          purchaseOrderId,
          workOrderId: sourceWorkOrderId,
          selectedItemIds,
          tx,
        });
      } else if (sourceProposalId) {
        await this.copyLineItemsFromProposal({
          tenantId,
          purchaseOrderId,
          proposalId: sourceProposalId,
          selectedItemIds,
          tx,
        });
      }
    });
  }

  /**
   * Copy the full proposal line-item hierarchy into a purchase order and
   * retain the source proposal reference on each copied node.
   */
  private async copyLineItemsFromProposal(params: {
    tenantId: string;
    purchaseOrderId: string;
    proposalId: string;
    selectedItemIds?: string[];
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const { tenantId, purchaseOrderId, proposalId, selectedItemIds, tx } = params;
    const logPrefix = 'PurchaseOrdersService.copyLineItemsFromProposal';

    const selectedSet =
      Array.isArray(selectedItemIds) && selectedItemIds.length > 0
        ? new Set(selectedItemIds)
        : null;

    this.logger.log(
      `${logPrefix} poId=${purchaseOrderId} proposalId=${proposalId} selectedItems=${selectedSet?.size ?? 'all'}`,
    );

    const sourceGroups = await tx
      .select()
      .from(proposalGroups)
      .where(
        and(
          eq(proposalGroups.tenantId, tenantId),
          eq(proposalGroups.proposalId, proposalId),
        ),
      )
      .orderBy(proposalGroups.sortIndex);

    if (sourceGroups.length === 0) {
      this.logger.debug(`${logPrefix} — no groups to copy`);
      return;
    }

    const groupIds = sourceGroups.map((g) => g.id);

    const sourceCombos = await tx
      .select()
      .from(proposalCombos)
      .where(
        and(
          eq(proposalCombos.tenantId, tenantId),
          inArray(proposalCombos.proposalGroupId, groupIds),
        ),
      )
      .orderBy(proposalCombos.sortIndex);

    const comboIds = sourceCombos.map((c) => c.id);

    const sourceDirectItems =
      groupIds.length > 0
        ? await tx
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

    const sourceComboItems =
      comboIds.length > 0
        ? await tx
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

    const groupIdMap = new Map<string, string>();
    for (const group of sourceGroups) {
      const [poGroup] = await tx
        .insert(purchaseOrderGroups)
        .values({
          tenantId,
          purchaseOrderId,
          groupLabelLookupId: group.groupLabelLookupId,
          description: group.description,
          component: group.component,
          dimensions: group.dimensions,
          sortIndex: group.sortIndex,
          totals: group.totals,
          groupPayload: {
            ...((group.groupPayload as Record<string, unknown>) ?? {}),
            sourceProposalGroupId: group.id,
            sourceProposalId: proposalId,
          },
        })
        .returning();
      groupIdMap.set(group.id, poGroup.id);
    }

    const comboIdMap = new Map<string, string>();
    for (const combo of sourceCombos) {
      const poGroupId = groupIdMap.get(combo.proposalGroupId);
      if (!poGroupId) continue;
      const childIds = sourceComboItems
        .filter((i) => i.proposalComboId === combo.id && i.id)
        .map((i) => i.id as string);
      if (
        selectedSet &&
        !selectedSet.has(combo.id) &&
        !childIds.some((id) => selectedSet.has(id))
      ) {
        continue;
      }
      const [poCombo] = await tx
        .insert(purchaseOrderCombos)
        .values({
          tenantId,
          purchaseOrderGroupId: poGroupId,
          name: combo.name,
          description: combo.description,
          category: combo.category,
          subCategory: combo.subCategory,
          quantity: combo.quantity,
          sortIndex: combo.sortIndex,
          totals: combo.totals,
          comboPayload: {
            ...((combo.comboPayload as Record<string, unknown>) ?? {}),
            sourceProposalComboId: combo.id,
            sourceProposalId: proposalId,
          },
        })
        .returning();
      comboIdMap.set(combo.id, poCombo.id);
    }

    for (const combo of sourceCombos) {
      const poComboId = comboIdMap.get(combo.id);
      if (!poComboId) continue;
      const payload =
        combo.comboPayload && typeof combo.comboPayload === 'object'
          ? { ...(combo.comboPayload as Record<string, unknown>) }
          : null;
      const parentId =
        payload && typeof payload.parentComboId === 'string'
          ? payload.parentComboId
          : null;
      if (!parentId) continue;
      const mappedParent = comboIdMap.get(parentId);
      if (!mappedParent || mappedParent === parentId) continue;
      await tx
        .update(purchaseOrderCombos)
        .set({
          comboPayload: {
            ...payload,
            parentComboId: mappedParent,
            sourceProposalComboId: combo.id,
            sourceProposalId: proposalId,
          },
        })
        .where(eq(purchaseOrderCombos.id, poComboId));
    }

    for (const item of sourceDirectItems) {
      const poGroupId = item.proposalGroupId
        ? groupIdMap.get(item.proposalGroupId)
        : undefined;
      if (!poGroupId) continue;
      if (selectedSet && item.id && !selectedSet.has(item.id)) continue;
      await tx.insert(purchaseOrderItems).values({
        tenantId,
        purchaseOrderGroupId: poGroupId,
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
        totals: item.totals,
        itemPayload: {
          ...((item.itemPayload as Record<string, unknown>) ?? {}),
          sourceProposalItemId: item.id,
          sourceProposalId: proposalId,
        },
      });
    }

    for (const item of sourceComboItems) {
      const poComboId = item.proposalComboId
        ? comboIdMap.get(item.proposalComboId)
        : undefined;
      if (!poComboId) continue;
      if (selectedSet && item.id && item.proposalComboId) {
        const siblingIds = sourceComboItems
          .filter((i) => i.proposalComboId === item.proposalComboId && i.id)
          .map((i) => i.id as string);
        const anyChildSelected = siblingIds.some((id) => selectedSet.has(id));
        const includeAll =
          selectedSet.has(item.proposalComboId) && !anyChildSelected;
        if (!includeAll && !selectedSet.has(item.id)) continue;
      }
      await tx.insert(purchaseOrderItems).values({
        tenantId,
        purchaseOrderComboId: poComboId,
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
        totals: item.totals,
        itemPayload: {
          ...((item.itemPayload as Record<string, unknown>) ?? {}),
          sourceProposalItemId: item.id,
          sourceProposalId: proposalId,
        },
      });
    }

    if (selectedSet) {
      for (const poGroupId of groupIdMap.values()) {
        const leftoverCombos = await tx
          .select({ id: purchaseOrderCombos.id })
          .from(purchaseOrderCombos)
          .where(eq(purchaseOrderCombos.purchaseOrderGroupId, poGroupId));
        const leftoverItems = await tx
          .select({ id: purchaseOrderItems.id })
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderGroupId, poGroupId));
        if (leftoverCombos.length === 0 && leftoverItems.length === 0) {
          await tx
            .delete(purchaseOrderGroups)
            .where(eq(purchaseOrderGroups.id, poGroupId));
        }
      }
    }
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    userId?: string;
  }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    if (typeof params.body.statusLookupId === 'string' && params.body.statusLookupId) {
      const updated = await this.purchaseOrdersRepo.update({
        id: params.id,
        data: {
          statusLookupId: params.body.statusLookupId,
          ...(params.userId ? { updatedByUserId: params.userId } : {}),
        },
      });
      if (this.outboundEvents && existing.jobId) {
        const status = (params.body.status as string) ?? '';
        if (status === 'Completed' || status === 'Complete') {
          this.outboundEvents.emitPurchaseOrderCompleted({
            purchaseOrderId: params.id,
            jobId: existing.jobId,
            tenantId: this.tenantContext.getTenantId(),
          }).catch(() => {});
        }
      }
      return updated;
    }

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiPo = await this.crunchworkService.updatePurchaseOrder({
      connectionId,
      purchaseOrderId: params.id,
      body: params.body,
    });

    return this.purchaseOrdersRepo.update({
      id: params.id,
      data: {
        purchaseOrderPayload: apiPo as Record<string, unknown>,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });
  }
}
