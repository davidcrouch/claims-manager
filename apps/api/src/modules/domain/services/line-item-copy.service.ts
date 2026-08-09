import { Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

export type FieldMapValue = string | ((row: Record<string, unknown>) => unknown);
export type FieldMap = Record<string, FieldMapValue>;

export interface CopyConfig {
  sourceGroupTable: PgTable;
  sourceComboTable: PgTable;
  sourceItemTable: PgTable;
  targetGroupTable: PgTable;
  targetComboTable: PgTable;
  targetItemTable: PgTable;
  sourceParentFk: string;
  targetParentFk: string;
  sourceGroupFkOnCombo: string;
  targetGroupFkOnCombo: string;
  sourceGroupFkOnItem: string;
  targetGroupFkOnItem: string;
  sourceComboFkOnItem: string;
  targetComboFkOnItem: string;
  groupFieldMap: FieldMap;
  comboFieldMap: FieldMap;
  itemFieldMap: FieldMap;
  itemFilter?: (item: Record<string, unknown>) => boolean;
}

export interface CopyResult {
  groups: number;
  combos: number;
  items: number;
  groupIdMap: Map<string, string>;
  comboIdMap: Map<string, string>;
}

@Injectable()
export class LineItemCopyService {
  private readonly logger = new Logger('LineItemCopyService');

  async copyHierarchy(params: {
    sourceParentId: string;
    targetParentId: string;
    targetTenantId: string;
    config: CopyConfig;
    tx: DrizzleDbOrTx;
  }): Promise<CopyResult> {
    const { sourceParentId, targetParentId, targetTenantId, config, tx } = params;
    const groupIdMap = new Map<string, string>();
    const comboIdMap = new Map<string, string>();

    // 1. Load source groups
    const sourceGroups: Record<string, unknown>[] = await tx
      .select()
      .from(config.sourceGroupTable)
      .where(eq((config.sourceGroupTable as any)[config.sourceParentFk], sourceParentId));

    // 2. Copy groups
    for (const srcGroup of sourceGroups) {
      const groupData: Record<string, unknown> = {
        tenantId: targetTenantId,
        [config.targetParentFk]: targetParentId,
      };
      this.applyFieldMap(groupData, srcGroup, config.groupFieldMap);

      const [inserted] = await tx
        .insert(config.targetGroupTable)
        .values(groupData)
        .returning({ id: (config.targetGroupTable as any).id });
      groupIdMap.set(srcGroup.id as string, inserted.id);
    }

    // 3. Load source combos for all groups
    const sourceGroupIds = sourceGroups.map((g) => g.id as string);
    let sourceCombos: Record<string, unknown>[] = [];
    if (sourceGroupIds.length > 0) {
      sourceCombos = await tx
        .select()
        .from(config.sourceComboTable)
        .where(
          inArray(
            (config.sourceComboTable as any)[config.sourceGroupFkOnCombo],
            sourceGroupIds,
          ),
        );
    }

    // 4. Copy combos
    for (const srcCombo of sourceCombos) {
      const srcGroupId = srcCombo[config.sourceGroupFkOnCombo] as string;
      const targetGroupId = groupIdMap.get(srcGroupId);
      if (!targetGroupId) continue;

      const comboData: Record<string, unknown> = {
        tenantId: targetTenantId,
        [config.targetGroupFkOnCombo]: targetGroupId,
      };
      this.applyFieldMap(comboData, srcCombo, config.comboFieldMap);

      const [inserted] = await tx
        .insert(config.targetComboTable)
        .values(comboData)
        .returning({ id: (config.targetComboTable as any).id });
      comboIdMap.set(srcCombo.id as string, inserted.id);
    }

    // 5. Load source items
    let sourceItems: Record<string, unknown>[] = [];
    if (sourceGroupIds.length > 0) {
      sourceItems = await tx
        .select()
        .from(config.sourceItemTable)
        .where(
          inArray(
            (config.sourceItemTable as any)[config.sourceGroupFkOnItem],
            sourceGroupIds,
          ),
        );
    }

    // 6. Filter and copy items
    let itemCount = 0;
    for (const srcItem of sourceItems) {
      if (config.itemFilter && !config.itemFilter(srcItem)) continue;

      const srcGroupId = srcItem[config.sourceGroupFkOnItem] as string;
      const targetGroupId = groupIdMap.get(srcGroupId);
      if (!targetGroupId) continue;

      const srcComboId = srcItem[config.sourceComboFkOnItem] as string | null;
      const targetComboId = srcComboId ? comboIdMap.get(srcComboId) ?? null : null;

      const itemData: Record<string, unknown> = {
        tenantId: targetTenantId,
        [config.targetGroupFkOnItem]: targetGroupId,
        [config.targetComboFkOnItem]: targetComboId,
      };
      this.applyFieldMap(itemData, srcItem, config.itemFieldMap);

      await tx.insert(config.targetItemTable).values(itemData);
      itemCount++;
    }

    this.logger.debug(
      `LineItemCopyService.copyHierarchy — copied ${groupIdMap.size} groups, ${comboIdMap.size} combos, ${itemCount} items`,
    );

    return {
      groups: groupIdMap.size,
      combos: comboIdMap.size,
      items: itemCount,
      groupIdMap,
      comboIdMap,
    };
  }

  async updateTenantOnHierarchy(params: {
    parentId: string;
    parentFkColumn: string;
    groupTable: PgTable;
    comboTable: PgTable;
    itemTable: PgTable;
    groupFkOnCombo: string;
    groupFkOnItem: string;
    newTenantId: string;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const { parentId, parentFkColumn, groupTable, comboTable, itemTable, groupFkOnCombo, groupFkOnItem, newTenantId, tx } = params;

    await tx
      .update(groupTable)
      .set({ tenantId: newTenantId } as any)
      .where(eq((groupTable as any)[parentFkColumn], parentId));

    const groups = await tx
      .select({ id: (groupTable as any).id })
      .from(groupTable)
      .where(eq((groupTable as any)[parentFkColumn], parentId));

    if (groups.length > 0) {
      const groupIds = groups.map((g: any) => g.id);
      await tx
        .update(comboTable)
        .set({ tenantId: newTenantId } as any)
        .where(inArray((comboTable as any)[groupFkOnCombo], groupIds));

      await tx
        .update(itemTable)
        .set({ tenantId: newTenantId } as any)
        .where(inArray((itemTable as any)[groupFkOnItem], groupIds));
    }
  }

  private applyFieldMap(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
    fieldMap: FieldMap,
  ): void {
    for (const [targetField, sourceSpec] of Object.entries(fieldMap)) {
      if (typeof sourceSpec === 'function') {
        target[targetField] = sourceSpec(source);
      } else {
        target[targetField] = source[sourceSpec];
      }
    }
  }
}
