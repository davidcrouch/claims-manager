import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { externalObjectVersions } from '../schema';

export type ExternalObjectVersionRow = typeof externalObjectVersions.$inferSelect;
export type ExternalObjectVersionInsert = typeof externalObjectVersions.$inferInsert;

@Injectable()
export class ExternalObjectVersionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: ExternalObjectVersionInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<ExternalObjectVersionRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(externalObjectVersions)
      .values(params.data)
      .returning();
    return inserted!;
  }

  async findByExternalObjectId(params: {
    externalObjectId: string;
    limit?: number;
  }): Promise<ExternalObjectVersionRow[]> {
    return this.db
      .select()
      .from(externalObjectVersions)
      .where(eq(externalObjectVersions.externalObjectId, params.externalObjectId))
      .orderBy(desc(externalObjectVersions.versionNumber))
      .limit(params.limit ?? 20);
  }

  async getLatestVersionNumber(params: {
    externalObjectId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<number> {
    const db = params.tx ?? this.db;
    const [result] = await db
      .select({
        maxVersion: sql<number>`COALESCE(MAX(${externalObjectVersions.versionNumber}), 0)`,
      })
      .from(externalObjectVersions)
      .where(eq(externalObjectVersions.externalObjectId, params.externalObjectId));
    return result?.maxVersion ?? 0;
  }
}
