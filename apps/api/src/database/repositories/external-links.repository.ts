import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { externalLinks } from '../schema';

export type ExternalLinkRow = typeof externalLinks.$inferSelect;
export type ExternalLinkInsert = typeof externalLinks.$inferInsert;

@Injectable()
export class ExternalLinksRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByExternalObjectId(params: {
    externalObjectId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ExternalLinkRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(externalLinks)
      .where(eq(externalLinks.externalObjectId, params.externalObjectId));
  }

  async findByInternalEntity(params: {
    internalEntityType: string;
    internalEntityId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ExternalLinkRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(externalLinks)
      .where(
        and(
          eq(externalLinks.internalEntityType, params.internalEntityType),
          eq(externalLinks.internalEntityId, params.internalEntityId),
        ),
      );
  }

  async upsert(params: {
    data: ExternalLinkInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<ExternalLinkRow> {
    const db = params.tx ?? this.db;
    const existing = await db
      .select()
      .from(externalLinks)
      .where(
        and(
          eq(externalLinks.externalObjectId, params.data.externalObjectId),
          eq(externalLinks.internalEntityType, params.data.internalEntityType),
          eq(externalLinks.internalEntityId, params.data.internalEntityId),
          eq(externalLinks.linkRole, params.data.linkRole ?? 'source'),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(externalLinks)
        .set({ ...params.data, updatedAt: new Date() })
        .where(eq(externalLinks.id, existing[0].id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(externalLinks)
      .values(params.data)
      .returning();
    return inserted;
  }

  async create(params: {
    data: ExternalLinkInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<ExternalLinkRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(externalLinks)
      .values(params.data)
      .returning();
    return inserted;
  }
}
