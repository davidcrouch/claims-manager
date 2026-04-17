import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { appointments } from '../schema';

export type AppointmentRow = typeof appointments.$inferSelect;
export type AppointmentInsert = typeof appointments.$inferInsert;

@Injectable()
export class AppointmentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
