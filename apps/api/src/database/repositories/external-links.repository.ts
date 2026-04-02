import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { externalLinks } from '../schema';

export type ExternalLinkRow = typeof externalLinks.$inferSelect;
export type ExternalLinkInsert = typeof externalLinks.$inferInsert;

@Injectable()
export class ExternalLinksRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByExternalObjectId(params: {
    externalObjectId: string;
  }): Promise<ExternalLinkRow[]> {
    return this.db
      .select()
      .from(externalLinks)
      .where(eq(externalLinks.externalObjectId, params.externalObjectId));
  }

  async findByInternalEntity(params: {
    internalEntityType: string;
    internalEntityId: string;
  }): Promise<ExternalLinkRow[]> {
    return this.db
      .select()
      .from(externalLinks)
      .where(
        and(
          eq(externalLinks.internalEntityType, params.internalEntityType),
          eq(externalLinks.internalEntityId, params.internalEntityId),
        ),
      );
  }

  async upsert(params: { data: ExternalLinkInsert }): Promise<ExternalLinkRow> {
    const existing = await this.db
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
      const [updated] = await this.db
        .update(externalLinks)
        .set({ ...params.data, updatedAt: new Date() })
        .where(eq(externalLinks.id, existing[0]!.id))
        .returning();
      return updated!;
    }

    const [inserted] = await this.db
      .insert(externalLinks)
      .values(params.data)
      .returning();
    return inserted!;
  }

  async create(params: { data: ExternalLinkInsert }): Promise<ExternalLinkRow> {
    const [inserted] = await this.db
      .insert(externalLinks)
      .values(params.data)
      .returning();
    return inserted!;
  }
}
