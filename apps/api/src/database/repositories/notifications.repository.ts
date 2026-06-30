import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, count } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { notifications } from '../schema';

export type NotificationRow = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: NotificationInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<NotificationRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(notifications)
      .values(params.data)
      .returning();
    return row;
  }

  async findUnreadByTenant(params: {
    tenantId: string;
    entityType?: string;
    limit?: number;
  }): Promise<NotificationRow[]> {
    const conditions = [
      eq(notifications.tenantId, params.tenantId),
      eq(notifications.isRead, false),
    ];
    if (params.entityType) {
      conditions.push(eq(notifications.entityType, params.entityType));
    }

    const limit = Math.min(params.limit ?? 50, 200);

    return this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async countUnreadByTenant(params: {
    tenantId: string;
  }): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, params.tenantId),
          eq(notifications.isRead, false),
        ),
      );
    return result?.value ?? 0;
  }

  async getUnreadEntityIds(params: {
    tenantId: string;
    entityType: string;
  }): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ entityId: notifications.entityId })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, params.tenantId),
          eq(notifications.entityType, params.entityType),
          eq(notifications.isRead, false),
        ),
      );
    return rows.map((r) => r.entityId);
  }

  async markAsRead(params: { id: string }): Promise<void> {
    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, params.id));
  }

  async markAsReadByEntity(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
  }): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.tenantId, params.tenantId),
          eq(notifications.entityType, params.entityType),
          eq(notifications.entityId, params.entityId),
          eq(notifications.isRead, false),
        ),
      )
      .returning({ id: notifications.id });
    return result.length;
  }

  async findAll(params: {
    tenantId: string;
    entityType?: string;
    isRead?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: NotificationRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const conditions = [eq(notifications.tenantId, params.tenantId)];
    if (params.entityType) {
      conditions.push(eq(notifications.entityType, params.entityType));
    }
    if (params.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, params.isRead));
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(whereClause)
        .orderBy(desc(notifications.createdAt))
        .offset(skip)
        .limit(limit),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.value ?? 0 };
  }
}
