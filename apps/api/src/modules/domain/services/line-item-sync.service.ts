import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  purchaseOrderGroups,
  purchaseOrderCombos,
  purchaseOrderItems,
  workOrderGroups,
  workOrderCombos,
  workOrderItems,
} from '../../../database/schema';

/**
 * Synchronises the three-level line-item hierarchy
 * (groups → combos → items) for a parent entity.
 *
 * Currently supports purchase_order. The service is designed to be
 * extended for quotes and other document types that share the same
 * group/combo/item structure.
 */
@Injectable()
export class LineItemSyncService {
  private readonly logger = new Logger('LineItemSyncService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async syncPurchaseOrderItems(params: {
    purchaseOrderId: string;
    tenantId: string;
    payload: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    const logPrefix = 'LineItemSyncService.syncPurchaseOrderItems';

    // Delete-and-recreate: cascading deletes on groups will remove combos and items
    await db
      .delete(purchaseOrderGroups)
      .where(eq(purchaseOrderGroups.purchaseOrderId, params.purchaseOrderId));

    const groups = (params.payload.groups as Record<string, unknown>[]) ?? [];
    this.logger.debug(
      `${logPrefix} — PO=${params.purchaseOrderId} groups=${groups.length}`,
    );

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const [createdGroup] = await db
        .insert(purchaseOrderGroups)
        .values({
          tenantId: params.tenantId,
          purchaseOrderId: params.purchaseOrderId,
          description: (group.description as string) ?? undefined,
          sortIndex: gi,
          groupPayload: group,
        })
        .returning();

      // Items directly on the group (flat structure from CW API)
      const directItems = (group.items as Record<string, unknown>[]) ?? [];
      for (let ii = 0; ii < directItems.length; ii++) {
        const item = directItems[ii];
        await db.insert(purchaseOrderItems).values({
          tenantId: params.tenantId,
          purchaseOrderGroupId: createdGroup.id,
          purchaseOrderComboId: null,
          name: (item.name as string) ?? undefined,
          description: (item.description as string) ?? undefined,
          category: (item.category as string) ?? undefined,
          subCategory: (item.subCategory as string) ?? undefined,
          itemType: (item.itemType as string) ?? undefined,
          quantity: (item.quantity as string) ?? undefined,
          tax: (item.tax as string) ?? undefined,
          unitCost: (item.unitCost as string) ?? undefined,
          buyCost: (item.buyCost as string) ?? undefined,
          sortIndex: ii,
          itemPayload: item,
        });
      }

      // Items nested within combos (hierarchical structure)
      const combos = (group.combos as Record<string, unknown>[]) ?? [];
      for (let ci = 0; ci < combos.length; ci++) {
        const combo = combos[ci];
        const [createdCombo] = await db
          .insert(purchaseOrderCombos)
          .values({
            tenantId: params.tenantId,
            purchaseOrderGroupId: createdGroup.id,
            name: (combo.name as string) ?? undefined,
            description: (combo.description as string) ?? undefined,
            category: (combo.category as string) ?? undefined,
            subCategory: (combo.subCategory as string) ?? undefined,
            quantity: (combo.quantity as string) ?? undefined,
            sortIndex: ci,
            comboPayload: combo,
          })
          .returning();

        const items = (combo.items as Record<string, unknown>[]) ?? [];
        for (let ii = 0; ii < items.length; ii++) {
          const item = items[ii];
          await db.insert(purchaseOrderItems).values({
            tenantId: params.tenantId,
            purchaseOrderComboId: createdCombo.id,
            name: (item.name as string) ?? undefined,
            description: (item.description as string) ?? undefined,
            category: (item.category as string) ?? undefined,
            subCategory: (item.subCategory as string) ?? undefined,
            itemType: (item.itemType as string) ?? undefined,
            quantity: (item.quantity as string) ?? undefined,
            tax: (item.tax as string) ?? undefined,
            unitCost: (item.unitCost as string) ?? undefined,
            buyCost: (item.buyCost as string) ?? undefined,
            sortIndex: ii,
            itemPayload: item,
          });
        }
      }
    }

    this.logger.log(
      `${logPrefix} — synced ${groups.length} groups for PO=${params.purchaseOrderId}`,
    );
  }

  async syncWorkOrderItems(params: {
    workOrderId: string;
    tenantId: string;
    payload: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    const logPrefix = 'LineItemSyncService.syncWorkOrderItems';

    await db
      .delete(workOrderGroups)
      .where(eq(workOrderGroups.workOrderId, params.workOrderId));

    const groups = (params.payload.groups as Record<string, unknown>[]) ?? [];
    this.logger.debug(
      `${logPrefix} — WO=${params.workOrderId} groups=${groups.length}`,
    );

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const directItems = (group.items as Record<string, unknown>[]) ?? [];
      const combos = (group.combos as Record<string, unknown>[]) ?? [];

      const [createdGroup] = await db
        .insert(workOrderGroups)
        .values({
          tenantId: params.tenantId,
          workOrderId: params.workOrderId,
          description: (group.description as string) ?? undefined,
          sortIndex: gi,
          groupPayload: group,
        })
        .returning();

      // Items directly on the group (flat structure from CW API)
      for (let ii = 0; ii < directItems.length; ii++) {
        const item = directItems[ii];
        await db.insert(workOrderItems).values({
          tenantId: params.tenantId,
          workOrderGroupId: createdGroup.id,
          workOrderComboId: null,
          name: (item.name as string) ?? undefined,
          description: (item.description as string) ?? undefined,
          category: (item.category as string) ?? undefined,
          subCategory: (item.subCategory as string) ?? undefined,
          itemType: (item.itemType as string) ?? undefined,
          quantity: (item.quantity as string) ?? undefined,
          tax: (item.tax as string) ?? undefined,
          unitCost: (item.unitCost as string) ?? undefined,
          buyCost: (item.buyCost as string) ?? undefined,
          sortIndex: ii,
          itemPayload: item,
        });
      }

      // Items nested within combos (hierarchical structure)
      for (let ci = 0; ci < combos.length; ci++) {
        const combo = combos[ci];
        const [createdCombo] = await db
          .insert(workOrderCombos)
          .values({
            tenantId: params.tenantId,
            workOrderGroupId: createdGroup.id,
            name: (combo.name as string) ?? undefined,
            description: (combo.description as string) ?? undefined,
            category: (combo.category as string) ?? undefined,
            subCategory: (combo.subCategory as string) ?? undefined,
            quantity: (combo.quantity as string) ?? undefined,
            sortIndex: ci,
            comboPayload: combo,
          })
          .returning();

        const items = (combo.items as Record<string, unknown>[]) ?? [];
        for (let ii = 0; ii < items.length; ii++) {
          const item = items[ii];
          await db.insert(workOrderItems).values({
            tenantId: params.tenantId,
            workOrderComboId: createdCombo.id,
            name: (item.name as string) ?? undefined,
            description: (item.description as string) ?? undefined,
            category: (item.category as string) ?? undefined,
            subCategory: (item.subCategory as string) ?? undefined,
            itemType: (item.itemType as string) ?? undefined,
            quantity: (item.quantity as string) ?? undefined,
            tax: (item.tax as string) ?? undefined,
            unitCost: (item.unitCost as string) ?? undefined,
            buyCost: (item.buyCost as string) ?? undefined,
            sortIndex: ii,
            itemPayload: item,
          });
        }
      }
    }

    this.logger.log(
      `${logPrefix} — synced ${groups.length} groups for WO=${params.workOrderId}`,
    );
  }
}
