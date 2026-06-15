import { Injectable, Inject } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { catalogCategories } from '../schema';

export type CatalogCategoryRow = typeof catalogCategories.$inferSelect;
export type CatalogCategoryInsert = typeof catalogCategories.$inferInsert;

@Injectable()
export class CatalogCategoriesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    activeOnly?: boolean;
  }): Promise<CatalogCategoryRow[]> {
    const conditions = [eq(catalogCategories.tenantId, params.tenantId)];
    if (params.activeOnly !== false) {
      conditions.push(eq(catalogCategories.isActive, true));
    }
    return this.db
      .select()
      .from(catalogCategories)
      .where(and(...conditions))
      .orderBy(asc(catalogCategories.sortIndex), asc(catalogCategories.name));
  }

  async findById(params: {
    tenantId: string;
    id: string;
  }): Promise<CatalogCategoryRow | null> {
    const [row] = await this.db
      .select()
      .from(catalogCategories)
      .where(
        and(eq(catalogCategories.id, params.id), eq(catalogCategories.tenantId, params.tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async findDescendantIds(params: {
    tenantId: string;
    categoryId: string;
  }): Promise<string[]> {
    const result = await this.db.execute<{ id: string }>(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM catalog_categories
        WHERE id = ${params.categoryId}::uuid AND tenant_id = ${params.tenantId}::uuid
        UNION ALL
        SELECT c.id FROM catalog_categories c
        INNER JOIN descendants d ON c.parent_category_id = d.id
        WHERE c.tenant_id = ${params.tenantId}::uuid
      )
      SELECT id FROM descendants
    `);
    return result.rows.map((r) => r.id);
  }

  async hasChildren(params: { tenantId: string; categoryId: string }): Promise<boolean> {
    const [row] = await this.db
      .select({ id: catalogCategories.id })
      .from(catalogCategories)
      .where(
        and(
          eq(catalogCategories.tenantId, params.tenantId),
          eq(catalogCategories.parentCategoryId, params.categoryId),
        ),
      )
      .limit(1);
    return !!row;
  }

  async create(params: {
    tenantId: string;
    data: Omit<CatalogCategoryInsert, 'tenantId'>;
  }): Promise<CatalogCategoryRow> {
    const [row] = await this.db
      .insert(catalogCategories)
      .values({ ...params.data, tenantId: params.tenantId })
      .returning();
    return row;
  }

  async update(params: {
    tenantId: string;
    id: string;
    data: Partial<Omit<CatalogCategoryInsert, 'tenantId' | 'id'>>;
  }): Promise<CatalogCategoryRow | null> {
    const [row] = await this.db
      .update(catalogCategories)
      .set({ ...params.data, updatedAt: new Date() })
      .where(
        and(eq(catalogCategories.id, params.id), eq(catalogCategories.tenantId, params.tenantId)),
      )
      .returning();
    return row ?? null;
  }

  async deactivate(params: { tenantId: string; id: string }): Promise<CatalogCategoryRow | null> {
    return this.update({
      tenantId: params.tenantId,
      id: params.id,
      data: { isActive: false },
    });
  }

  async findRoots(params: { tenantId: string }): Promise<CatalogCategoryRow[]> {
    return this.db
      .select()
      .from(catalogCategories)
      .where(
        and(
          eq(catalogCategories.tenantId, params.tenantId),
          isNull(catalogCategories.parentCategoryId),
          eq(catalogCategories.isActive, true),
        ),
      )
      .orderBy(asc(catalogCategories.sortIndex));
  }

  async findByParentIds(params: {
    tenantId: string;
    parentIds: string[];
  }): Promise<CatalogCategoryRow[]> {
    if (params.parentIds.length === 0) return [];
    return this.db
      .select()
      .from(catalogCategories)
      .where(
        and(
          eq(catalogCategories.tenantId, params.tenantId),
          inArray(catalogCategories.parentCategoryId, params.parentIds),
          eq(catalogCategories.isActive, true),
        ),
      )
      .orderBy(asc(catalogCategories.sortIndex));
  }
}
