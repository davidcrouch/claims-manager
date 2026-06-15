import { Injectable, Inject } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { catalogAssemblyComponents } from '../schema';

export type CatalogAssemblyComponentRow = typeof catalogAssemblyComponents.$inferSelect;
export type CatalogAssemblyComponentInsert = typeof catalogAssemblyComponents.$inferInsert;

@Injectable()
export class CatalogAssemblyComponentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByAssemblyId(params: {
    tenantId: string;
    assemblyId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<CatalogAssemblyComponentRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(catalogAssemblyComponents)
      .where(
        and(
          eq(catalogAssemblyComponents.tenantId, params.tenantId),
          eq(catalogAssemblyComponents.assemblyId, params.assemblyId),
        ),
      )
      .orderBy(asc(catalogAssemblyComponents.sortIndex));
  }

  async replaceBom(params: {
    tenantId: string;
    assemblyId: string;
    lines: Omit<CatalogAssemblyComponentInsert, 'tenantId' | 'assemblyId' | 'id'>[];
    tx: DrizzleDbOrTx;
  }): Promise<CatalogAssemblyComponentRow[]> {
    await params.tx
      .delete(catalogAssemblyComponents)
      .where(
        and(
          eq(catalogAssemblyComponents.tenantId, params.tenantId),
          eq(catalogAssemblyComponents.assemblyId, params.assemblyId),
        ),
      );

    if (params.lines.length === 0) return [];

    return params.tx
      .insert(catalogAssemblyComponents)
      .values(
        params.lines.map((line, index) => ({
          ...line,
          tenantId: params.tenantId,
          assemblyId: params.assemblyId,
          sortIndex: line.sortIndex ?? index,
        })),
      )
      .returning();
  }

  async create(params: {
    tenantId: string;
    data: Omit<CatalogAssemblyComponentInsert, 'tenantId'>;
    tx?: DrizzleDbOrTx;
  }): Promise<CatalogAssemblyComponentRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(catalogAssemblyComponents)
      .values({ ...params.data, tenantId: params.tenantId })
      .returning();
    return row;
  }

  async update(params: {
    tenantId: string;
    id: string;
    data: Partial<Omit<CatalogAssemblyComponentInsert, 'tenantId' | 'id' | 'assemblyId'>>;
    tx?: DrizzleDbOrTx;
  }): Promise<CatalogAssemblyComponentRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .update(catalogAssemblyComponents)
      .set({ ...params.data, updatedAt: new Date() })
      .where(
        and(
          eq(catalogAssemblyComponents.id, params.id),
          eq(catalogAssemblyComponents.tenantId, params.tenantId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async delete(params: {
    tenantId: string;
    id: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    await db
      .delete(catalogAssemblyComponents)
      .where(
        and(
          eq(catalogAssemblyComponents.id, params.id),
          eq(catalogAssemblyComponents.tenantId, params.tenantId),
        ),
      );
  }

  /** Returns true if adding componentId to assemblyId would create a cycle. */
  async wouldCreateCycle(params: {
    tenantId: string;
    assemblyId: string;
    componentId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<boolean> {
    if (params.assemblyId === params.componentId) return true;

    const db = params.tx ?? this.db;
    const result = await db.execute<{ found: boolean }>(sql`
      WITH RECURSIVE descendants AS (
        SELECT component_id AS item_id
        FROM catalog_assembly_components
        WHERE assembly_id = ${params.componentId}::uuid
          AND tenant_id = ${params.tenantId}::uuid
        UNION ALL
        SELECT b.component_id
        FROM catalog_assembly_components b
        INNER JOIN descendants d ON b.assembly_id = d.item_id
        WHERE b.tenant_id = ${params.tenantId}::uuid
      )
      SELECT EXISTS(
        SELECT 1 FROM descendants WHERE item_id = ${params.assemblyId}::uuid
      ) AS found
    `);

    return result.rows[0]?.found ?? false;
  }

  async countByComponentId(params: {
    tenantId: string;
    componentId: string;
  }): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(catalogAssemblyComponents)
      .where(
        and(
          eq(catalogAssemblyComponents.tenantId, params.tenantId),
          eq(catalogAssemblyComponents.componentId, params.componentId),
        ),
      );
    return row?.count ?? 0;
  }
}
