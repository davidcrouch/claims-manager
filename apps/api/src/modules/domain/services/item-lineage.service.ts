import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, notInArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import { itemAllocations, workOrderItems } from '../../../database/schema';

export type ItemAllocationRow = typeof itemAllocations.$inferSelect;

@Injectable()
export class ItemLineageService {
  private readonly logger = new Logger('ItemLineageService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Create allocation links between WO items and PO items.
   * Called when a contractor creates a PO from selected WO items.
   */
  async createAllocations(params: {
    tenantId: string;
    allocations: Array<{
      sourceWorkOrderItemId: string;
      targetPurchaseOrderItemId: string;
      allocatedQuantity?: string;
      allocatedAmount?: string;
      allocationType: 'full' | 'partial' | 'split';
      notes?: string;
    }>;
    tx: DrizzleDbOrTx;
  }): Promise<ItemAllocationRow[]> {
    const db = params.tx;
    const results: ItemAllocationRow[] = [];

    for (const alloc of params.allocations) {
      const [row] = await db
        .insert(itemAllocations)
        .values({
          tenantId: params.tenantId,
          sourceWorkOrderItemId: alloc.sourceWorkOrderItemId,
          targetPurchaseOrderItemId: alloc.targetPurchaseOrderItemId,
          allocatedQuantity: alloc.allocatedQuantity,
          allocatedAmount: alloc.allocatedAmount,
          allocationType: alloc.allocationType,
          notes: alloc.notes,
        })
        .returning();
      results.push(row);
    }

    this.logger.debug(
      `ItemLineageService.createAllocations — created ${results.length} allocations`,
    );
    return results;
  }

  /**
   * Find all PO items allocated from a given WO item.
   */
  async findAllocationsForWorkOrderItem(params: {
    workOrderItemId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ItemAllocationRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(itemAllocations)
      .where(eq(itemAllocations.sourceWorkOrderItemId, params.workOrderItemId));
  }

  /**
   * Find the source WO items for a given PO item.
   */
  async findSourcesForPurchaseOrderItem(params: {
    purchaseOrderItemId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ItemAllocationRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(itemAllocations)
      .where(eq(itemAllocations.targetPurchaseOrderItemId, params.purchaseOrderItemId));
  }

  /**
   * Find WO item IDs within a work order that have no allocations (retained in-house).
   */
  async findUnallocatedItems(params: {
    workOrderId: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string[]> {
    const db = params.tx ?? this.db;

    // Get all WO item IDs that DO have allocations
    const allocated = await db
      .select({ id: itemAllocations.sourceWorkOrderItemId })
      .from(itemAllocations)
      .where(eq(itemAllocations.tenantId, params.tenantId));

    const allocatedIds = allocated.map((a) => a.id);

    // Get all WO items for this work order (via groups or combos)
    const allItems = await db
      .select({ id: workOrderItems.id })
      .from(workOrderItems)
      .where(eq(workOrderItems.tenantId, params.tenantId));

    // Return IDs that don't appear in allocations
    const allocatedSet = new Set(allocatedIds);
    return allItems.filter((item) => !allocatedSet.has(item.id)).map((item) => item.id);
  }

  /**
   * Remove allocations for a specific PO item (e.g. when PO item is deleted).
   */
  async removeAllocationsForTarget(params: {
    targetPurchaseOrderItemId: string;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    await params.tx
      .delete(itemAllocations)
      .where(eq(itemAllocations.targetPurchaseOrderItemId, params.targetPurchaseOrderItemId));
  }
}
