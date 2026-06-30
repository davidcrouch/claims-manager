import { Injectable, Inject } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { catalogs, catalogItems } from '../schema';

export type CatalogRow = typeof catalogs.$inferSelect;
export type CatalogInsert = typeof catalogs.$inferInsert;

@Injectable()
export class CatalogsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    type?: string;
    activeOnly?: boolean;
  }): Promise<CatalogRow[]> {
    const conditions = [eq(catalogs.tenantId, params.tenantId)];

    if (params.type) {
      conditions.push(eq(catalogs.type, params.type));
    }
    if (params.activeOnly !== false) {
      conditions.push(eq(catalogs.isActive, true));
    }

    return this.db
      .select()
      .from(catalogs)
      .where(and(...conditions))
      .orderBy(desc(catalogs.createdAt));
  }

  async findById(params: {
    tenantId: string;
    id: string;
  }): Promise<CatalogRow | null> {
    const [row] = await this.db
      .select()
      .from(catalogs)
      .where(
        and(
          eq(catalogs.id, params.id),
          eq(catalogs.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByName(params: {
    tenantId: string;
    name: string;
  }): Promise<CatalogRow | null> {
    const [row] = await this.db
      .select()
      .from(catalogs)
      .where(
        and(
          eq(catalogs.tenantId, params.tenantId),
          eq(catalogs.name, params.name),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    tenantId: string;
    data: Omit<CatalogInsert, 'tenantId'>;
    tx?: DrizzleDbOrTx;
  }): Promise<CatalogRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(catalogs)
      .values({ ...params.data, tenantId: params.tenantId })
      .returning();
    return row;
  }

  async update(params: {
    tenantId: string;
    id: string;
    data: Partial<Omit<CatalogInsert, 'tenantId' | 'id'>>;
    tx?: DrizzleDbOrTx;
  }): Promise<CatalogRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .update(catalogs)
      .set({ ...params.data, updatedAt: new Date() })
      .where(and(eq(catalogs.id, params.id), eq(catalogs.tenantId, params.tenantId)))
      .returning();
    return row ?? null;
  }

  async deactivate(params: {
    tenantId: string;
    id: string;
    tx?: DrizzleDbOrTx;
  }): Promise<CatalogRow | null> {
    return this.update({
      tenantId: params.tenantId,
      id: params.id,
      data: { isActive: false },
      tx: params.tx,
    });
  }

  async countItems(params: {
    tenantId: string;
    catalogId: string;
  }): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.tenantId, params.tenantId),
          eq(catalogItems.catalogId, params.catalogId),
        ),
      );
    return result?.count ?? 0;
  }
}
