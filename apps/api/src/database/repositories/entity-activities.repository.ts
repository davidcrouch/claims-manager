import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, count } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { entityActivities } from '../schema';

export type EntityActivityRow = typeof entityActivities.$inferSelect;
export type EntityActivityInsert = typeof entityActivities.$inferInsert;

@Injectable()
export class EntityActivitiesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: EntityActivityInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<EntityActivityRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(entityActivities)
      .values(params.data)
      .returning();
    return row;
  }

  async createMany(params: {
    data: EntityActivityInsert[];
    tx?: DrizzleDbOrTx;
  }): Promise<EntityActivityRow[]> {
    if (params.data.length === 0) return [];
    const db = params.tx ?? this.db;
    return db.insert(entityActivities).values(params.data).returning();
  }

  async findByEntity(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: EntityActivityRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const whereClause = and(
      eq(entityActivities.tenantId, params.tenantId),
      eq(entityActivities.entityType, params.entityType),
      eq(entityActivities.entityId, params.entityId),
    );

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(entityActivities)
        .where(whereClause)
        .orderBy(desc(entityActivities.createdAt))
        .offset(skip)
        .limit(limit),
      this.db
        .select({ value: count() })
        .from(entityActivities)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.value ?? 0 };
  }

  async findByRelatedEntity(params: {
    tenantId: string;
    relatedEntityType: string;
    relatedEntityId: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: EntityActivityRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const whereClause = and(
      eq(entityActivities.tenantId, params.tenantId),
      eq(entityActivities.relatedEntityType, params.relatedEntityType),
      eq(entityActivities.relatedEntityId, params.relatedEntityId),
    );

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(entityActivities)
        .where(whereClause)
        .orderBy(desc(entityActivities.createdAt))
        .offset(skip)
        .limit(limit),
      this.db
        .select({ value: count() })
        .from(entityActivities)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.value ?? 0 };
  }
}
