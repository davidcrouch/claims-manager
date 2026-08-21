import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, asc, desc, ilike, sql, inArray } from 'drizzle-orm';
import { normalizeListJobIds, parseCsvFilterValues } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { appointments, lookupValues } from '../schema';

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
    location?: string;
    appointmentTypeLookupIds?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    jobId?: string;
    jobIds?: string[];
  }): Promise<{ data: AppointmentRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const conditions = [eq(appointments.tenantId, params.tenantId)];
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      conditions.push(
        jobIds.length === 1
          ? eq(appointments.jobId, jobIds[0])
          : inArray(appointments.jobId, jobIds),
      );
    }
    if (params.search) {
      conditions.push(ilike(appointments.name, `%${params.search}%`));
    }
    const statuses = params.status?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (statuses.includes('__none__')) {
      return { data: [], total: 0 };
    }
    if (statuses.length > 0) {
      conditions.push(inArray(appointments.status, statuses));
    }
    const locations =
      params.location?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (locations.includes('__none__')) {
      return { data: [], total: 0 };
    }
    if (locations.length > 0) {
      conditions.push(inArray(appointments.location, locations));
    }

    const typeIds = parseCsvFilterValues(params.appointmentTypeLookupIds);
    if (typeIds) {
      if (typeIds.length === 0) return { data: [], total: 0 };
      conditions.push(inArray(appointments.appointmentTypeLookupId, typeIds));
    }

    const where = and(...conditions);

    const sortCol =
      params.sort === 'name' ? appointments.name :
      params.sort === 'status' ? appointments.status :
      params.sort === 'location' ? appointments.location :
      params.sort === 'created_at' ? appointments.createdAt :
      params.sort === 'updated_at' ? appointments.updatedAt :
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

  async findDistinctLocations(params: {
    tenantId: string;
  }): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ location: appointments.location })
      .from(appointments)
      .where(eq(appointments.tenantId, params.tenantId))
      .orderBy(asc(appointments.location));
    return rows
      .map((r) => (r.location ?? '').trim())
      .filter(Boolean);
  }

  async findFilterTypes(params: {
    tenantId: string;
  }): Promise<{ id: string; name: string }[]> {
    const rows = await this.db
      .selectDistinct({
        id: lookupValues.id,
        name: lookupValues.name,
      })
      .from(appointments)
      .innerJoin(
        lookupValues,
        eq(appointments.appointmentTypeLookupId, lookupValues.id),
      )
      .where(eq(appointments.tenantId, params.tenantId))
      .orderBy(asc(lookupValues.name));

    return rows
      .filter((r) => !!r.id)
      .map((r) => ({
        id: r.id,
        name: (r.name ?? '').trim() || r.id,
      }));
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
