import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, asc, desc, ilike, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { appointments } from '../schema';

export type AppointmentRow = typeof appointments.$inferSelect;
export type AppointmentInsert = typeof appointments.$inferInsert;

@Injectable()
export class AppointmentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ data: AppointmentRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const conditions = [eq(appointments.tenantId, params.tenantId)];
    if (params.search) {
      conditions.push(ilike(appointments.name, `%${params.search}%`));
    }
    if (params.status) {
      conditions.push(eq(appointments.status, params.status));
    }
    const where = and(...conditions);

    const sortCol =
      params.sort === 'name' ? appointments.name :
      params.sort === 'status' ? appointments.status :
      params.sort === 'location' ? appointments.location :
      appointments.startDate;
    const orderBy = params.order === 'desc' ? desc(sortCol) : asc(sortCol);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(appointments)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(where),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<AppointmentRow | null> {
    const [row] = await this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, params.id),
          eq(appointments.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: {
    jobId: string;
    tenantId: string;
  }): Promise<AppointmentRow[]> {
    return this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.jobId, params.jobId),
          eq(appointments.tenantId, params.tenantId),
        ),
      )
      .orderBy(asc(appointments.startDate));
  }

  async create(params: {
    data: AppointmentInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<AppointmentRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(appointments)
      .values(params.data)
      .returning();
    return inserted;
  }

  async update(params: {
    id: string;
    data: Partial<AppointmentInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<AppointmentRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(appointments)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(appointments.id, params.id))
      .returning();
    return updated ?? null;
  }
}
