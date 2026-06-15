import { Injectable, Inject } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { catalogItemTypes } from '../schema';

export type CatalogItemTypeRow = typeof catalogItemTypes.$inferSelect;
export type CatalogItemTypeInsert = typeof catalogItemTypes.$inferInsert;

@Injectable()
export class CatalogItemTypesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: { tenantId: string; activeOnly?: boolean }): Promise<CatalogItemTypeRow[]> {
    const conditions = [eq(catalogItemTypes.tenantId, params.tenantId)];
    if (params.activeOnly !== false) {
      conditions.push(eq(catalogItemTypes.isActive, true));
    }
    return this.db
      .select()
      .from(catalogItemTypes)
      .where(and(...conditions))
      .orderBy(asc(catalogItemTypes.sortIndex), asc(catalogItemTypes.name));
  }

  async findById(params: {
    tenantId: string;
    id: string;
  }): Promise<CatalogItemTypeRow | null> {
    const [row] = await this.db
      .select()
      .from(catalogItemTypes)
      .where(
        and(eq(catalogItemTypes.id, params.id), eq(catalogItemTypes.tenantId, params.tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByCode(params: {
    tenantId: string;
    code: string;
  }): Promise<CatalogItemTypeRow | null> {
    const [row] = await this.db
      .select()
      .from(catalogItemTypes)
      .where(
        and(
          eq(catalogItemTypes.tenantId, params.tenantId),
          eq(catalogItemTypes.code, params.code),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    tenantId: string;
    data: Omit<CatalogItemTypeInsert, 'tenantId'>;
  }): Promise<CatalogItemTypeRow> {
    const [row] = await this.db
      .insert(catalogItemTypes)
      .values({ ...params.data, tenantId: params.tenantId })
      .returning();
    return row;
  }

  async update(params: {
    tenantId: string;
    id: string;
    data: Partial<Omit<CatalogItemTypeInsert, 'tenantId' | 'id'>>;
  }): Promise<CatalogItemTypeRow | null> {
    const [row] = await this.db
      .update(catalogItemTypes)
      .set({ ...params.data, updatedAt: new Date() })
      .where(
        and(eq(catalogItemTypes.id, params.id), eq(catalogItemTypes.tenantId, params.tenantId)),
      )
      .returning();
    return row ?? null;
  }
}
