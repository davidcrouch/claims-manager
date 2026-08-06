import { Injectable, Inject } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { quoteCustodyTransfers } from '../schema';

export type QuoteCustodyTransferRow = typeof quoteCustodyTransfers.$inferSelect;
export type QuoteCustodyTransferInsert = typeof quoteCustodyTransfers.$inferInsert;

@Injectable()
export class QuoteCustodyTransfersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByQuoteId(params: {
    quoteId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<QuoteCustodyTransferRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(quoteCustodyTransfers)
      .where(eq(quoteCustodyTransfers.quoteId, params.quoteId))
      .orderBy(desc(quoteCustodyTransfers.transferredAt));
  }

  async create(params: {
    data: QuoteCustodyTransferInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<QuoteCustodyTransferRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(quoteCustodyTransfers)
      .values(params.data)
      .returning();
    return row;
  }
}
