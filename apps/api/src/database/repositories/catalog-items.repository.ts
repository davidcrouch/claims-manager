import { Injectable, Inject } from '@nestjs/common';
import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { catalogItems } from '../schema';

export type CatalogItemRow = typeof catalogItems.$inferSelect;
export type CatalogItemInsert = typeof catalogItems.$inferInsert;

@Injectable()
export class CatalogItemsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findMany(params: {
    tenantId: string;
    kind?: 'primitive' | 'assembly';
    typeId?: string;
    categoryIds?: string[];
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: CatalogItemRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions = [
      eq(catalogItems.tenantId, params.tenantId),
      isNull(catalogItems.deletedAt),
    ];

    if (params.kind) {
      conditions.push(eq(catalogItems.kind, params.kind));
    }
    if (params.typeId) {
      conditions.push(eq(catalogItems.typeId, params.typeId));
    }
    if (params.categoryIds && params.categoryIds.length > 0) {
      conditions.push(inArray(catalogItems.categoryId, params.categoryIds));
    }
    if (params.isActive !== undefined) {
      conditions.push(eq(catalogItems.isActive, params.isActive));
    } else {
      conditions.push(eq(catalogItems.isActive, true));
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(catalogItems.code, term),
          ilike(catalogItems.name, term),
          ilike(catalogItems.description, term),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(catalogItems)
        .where(whereClause)
        .orderBy(asc(catalogItems.code))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(catalogItems)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }

  async findById(params: {
    tenantId: string;
    id: string;
    includeDeleted?: boolean;
  }): Promise<CatalogItemRow | null> {
    const conditions = [
      eq(catalogItems.id, params.id),
      eq(catalogItems.tenantId, params.tenantId),
    ];
    if (!params.includeDeleted) {
      conditions.push(isNull(catalogItems.deletedAt));
    }
    const [row] = await this.db
      .select()
      .from(catalogItems)
      .where(and(...conditions))
      .limit(1);
    return row ?? null;
  }

  async findByCode(params: {
    tenantId: string;
    code: string;
  }): Promise<CatalogItemRow | null> {
    const [row] = await this.db
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.tenantId, params.tenantId),
          eq(catalogItems.code, params.code),
          isNull(catalogItems.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByExternalReference(params: {
    tenantId: string;
    externalReference: string;
  }): Promise<CatalogItemRow | null> {
    const [row] = await this.db
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.tenantId, params.tenantId),
          eq(catalogItems.externalReference, params.externalReference),
          isNull(catalogItems.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    tenantId: string;
    data: Omit<CatalogItemInsert, 'tenantId'>;
    tx?: DrizzleDbOrTx;
  }): Promise<CatalogItemRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(catalogItems)
      .values({ ...params.data, tenantId: params.tenantId })
      .returning();
    return row;
  }

  async update(params: {
    tenantId: string;
    id: string;
    data: Partial<Omit<CatalogItemInsert, 'tenantId' | 'id'>>;
    tx?: DrizzleDbOrTx;
  }): Promise<CatalogItemRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .update(catalogItems)
      .set({ ...params.data, updatedAt: new Date() })
      .where(and(eq(catalogItems.id, params.id), eq(catalogItems.tenantId, params.tenantId)))
      .returning();
    return row ?? null;
  }

  /**
   * Bulk-fetch external references for a set of catalog item IDs.
   * Returns a Map of internalId -> externalReference (only items that have one).
   */
  async findExternalReferences(params: {
    tenantId: string;
    ids: string[];
  }): Promise<Map<string, string>> {
    if (params.ids.length === 0) return new Map();
    const rows = await this.db
      .select({ id: catalogItems.id, externalReference: catalogItems.externalReference })
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.tenantId, params.tenantId),
          inArray(catalogItems.id, params.ids),
        ),
      );
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.externalReference) map.set(row.id, row.externalReference);
    }
    return map;
  }

  async softDelete(params: {
    tenantId: string;
    id: string;
    tx?: DrizzleDbOrTx;
  }): Promise<CatalogItemRow | null> {
    return this.update({
      tenantId: params.tenantId,
      id: params.id,
      data: { deletedAt: new Date(), isActive: false },
      tx: params.tx,
    });
  }
}
