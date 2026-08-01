import { Injectable, Inject } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { poCustodyTransfers } from '../schema';

export type PoCustodyTransferRow = typeof poCustodyTransfers.$inferSelect;
export type PoCustodyTransferInsert = typeof poCustodyTransfers.$inferInsert;

@Injectable()
export class PoCustodyTransfersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByPurchaseOrderId(params: {
    purchaseOrderId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<PoCustodyTransferRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(poCustodyTransfers)
      .where(eq(poCustodyTransfers.purchaseOrderId, params.purchaseOrderId))
      .orderBy(desc(poCustodyTransfers.transferredAt));
  }

  async create(params: {
    data: PoCustodyTransferInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<PoCustodyTransferRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(poCustodyTransfers)
      .values(params.data)
      .returning();
    return row;
  }
}
