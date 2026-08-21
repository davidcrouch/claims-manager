import { Injectable, Inject } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { taskTypeMappings } from '../schema';

export type TaskTypeMappingRow = typeof taskTypeMappings.$inferSelect;
export type TaskTypeMappingInsert = typeof taskTypeMappings.$inferInsert;

@Injectable()
export class TaskTypeMappingsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    includeInactive?: boolean;
    tx?: DrizzleDbOrTx;
  }): Promise<TaskTypeMappingRow[]> {
    const db = params.tx ?? this.db;
    const where = params.includeInactive
      ? eq(taskTypeMappings.tenantId, params.tenantId)
      : and(
          eq(taskTypeMappings.tenantId, params.tenantId),
          eq(taskTypeMappings.isActive, true),
        );

    return db
      .select()
      .from(taskTypeMappings)
      .where(where!)
      .orderBy(asc(taskTypeMappings.priority), asc(taskTypeMappings.titlePattern));
  }

  async findOne(params: {
    id: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<TaskTypeMappingRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(taskTypeMappings)
      .where(
        and(
          eq(taskTypeMappings.id, params.id),
          eq(taskTypeMappings.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async countForTenant(params: {
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<number> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(taskTypeMappings)
      .where(eq(taskTypeMappings.tenantId, params.tenantId));
    return row?.value ?? 0;
  }

  async create(params: {
    data: TaskTypeMappingInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<TaskTypeMappingRow> {
    const db = params.tx ?? this.db;
    const [row] = await db.insert(taskTypeMappings).values(params.data).returning();
    return row;
  }

  async createMany(params: {
    data: TaskTypeMappingInsert[];
    tx?: DrizzleDbOrTx;
  }): Promise<TaskTypeMappingRow[]> {
    if (params.data.length === 0) return [];
    const db = params.tx ?? this.db;
    return db
      .insert(taskTypeMappings)
      .values(params.data)
      .onConflictDoNothing()
      .returning();
  }

  async update(params: {
    id: string;
    tenantId: string;
    data: Partial<TaskTypeMappingInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<TaskTypeMappingRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .update(taskTypeMappings)
      .set({ ...params.data, updatedAt: new Date() })
      .where(
        and(
          eq(taskTypeMappings.id, params.id),
          eq(taskTypeMappings.tenantId, params.tenantId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async delete(params: {
    id: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<boolean> {
    const db = params.tx ?? this.db;
    const deleted = await db
      .delete(taskTypeMappings)
      .where(
        and(
          eq(taskTypeMappings.id, params.id),
          eq(taskTypeMappings.tenantId, params.tenantId),
        ),
      )
      .returning({ id: taskTypeMappings.id });
    return deleted.length > 0;
  }

  async distinctTaskTypes(params: {
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string[]> {
    const db = params.tx ?? this.db;
    const rows = await db
      .selectDistinct({ taskType: taskTypeMappings.taskType })
      .from(taskTypeMappings)
      .where(
        and(
          eq(taskTypeMappings.tenantId, params.tenantId),
          eq(taskTypeMappings.isActive, true),
        ),
      )
      .orderBy(asc(taskTypeMappings.taskType));
    return rows.map((r) => r.taskType).filter((t) => t.trim().length > 0);
  }
}
