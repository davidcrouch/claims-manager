import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, desc, asc, lt, sql, inArray, ilike, or, isNull, getTableColumns } from 'drizzle-orm';
import {
  normalizeListJobIds,
  normalizeListUserIds,
  parseCsvFilterValues,
} from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { tasks, users } from '../schema';

export type TaskRow = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;

export interface TaskViewRow extends TaskRow {
  assigneeName: string | null;
}

const assigneeJoinOn = sql`${tasks.assignedToUserId} = ${users.id}::text`;

function buildTasksOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(tasks.updatedAt)];
    case 'updated_at_desc':
      return [desc(tasks.updatedAt)];
    case 'created_at_desc':
      return [desc(tasks.createdAt)];
    case 'created_at_asc':
      return [asc(tasks.createdAt)];
    case 'due_date_asc':
      return [asc(tasks.dueDate)];
    case 'due_date_desc':
      return [desc(tasks.dueDate)];
    case 'priority_asc':
      return [asc(tasks.priority)];
    case 'priority_desc':
      return [desc(tasks.priority)];
    case 'assignee_asc':
      return [asc(users.name)];
    case 'assignee_desc':
      return [desc(users.name)];
    default:
      return [asc(tasks.dueDate), desc(tasks.createdAt)];
  }
}

@Injectable()
export class TasksRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    claimId?: string;
    status?: string | string[];
    priority?: string | string[];
    entityType?: string;
    entityId?: string;
    assignedToUserId?: string;
    assignedToUserIds?: string;
    search?: string;
    names?: string;
    taskTypes?: string;
    overdue?: boolean;
    sort?: string;
  }): Promise<{ data: TaskViewRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = eq(tasks.tenantId, params.tenantId);
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        jobIds.length === 1 ? eq(tasks.jobId, jobIds[0]) : inArray(tasks.jobId, jobIds),
      )!;
    }
    if (params.claimId) {
      whereClause = and(whereClause, eq(tasks.claimId, params.claimId))!;
    }
    const statuses = parseCsvFilterValues(params.status);
    const priorities = parseCsvFilterValues(params.priority);
    if (statuses) {
      if (statuses.length === 0) return { data: [], total: 0 };
      whereClause = and(whereClause, inArray(tasks.status, statuses))!;
    }
    if (priorities) {
      if (priorities.length === 0) return { data: [], total: 0 };
      whereClause = and(whereClause, inArray(tasks.priority, priorities))!;
    }
    if (params.entityType) {
      whereClause = and(whereClause, eq(tasks.relatedEntityType, params.entityType))!;
    }
    if (params.entityId) {
      whereClause = and(whereClause, eq(tasks.relatedEntityId, params.entityId))!;
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(ilike(tasks.name, term), ilike(tasks.description, term))!,
      )!;
    }

    const names = parseCsvFilterValues(params.names);
    if (names) {
      if (names.length === 0) return { data: [], total: 0 };
      whereClause = and(whereClause, inArray(tasks.name, names))!;
    }

    const taskTypes = parseCsvFilterValues(params.taskTypes);
    if (taskTypes) {
      if (taskTypes.length === 0) return { data: [], total: 0 };
      whereClause = and(whereClause, inArray(tasks.taskType, taskTypes))!;
    }

    const assigneeIds = normalizeListUserIds({
      userId: params.assignedToUserId,
      userIds: params.assignedToUserIds,
    });
    if (assigneeIds) {
      if (assigneeIds.length === 0) return { data: [], total: 0 };
      const includeBlank = assigneeIds.includes('__blank__');
      const realIds = assigneeIds.filter((id) => id !== '__blank__');
      if (includeBlank && realIds.length > 0) {
        whereClause = and(
          whereClause,
          or(isNull(tasks.assignedToUserId), inArray(tasks.assignedToUserId, realIds))!,
        )!;
      } else if (includeBlank) {
        whereClause = and(whereClause, isNull(tasks.assignedToUserId))!;
      } else {
        whereClause = and(whereClause, inArray(tasks.assignedToUserId, realIds))!;
      }
    }

    if (params.overdue) {
      whereClause = and(
        whereClause,
        eq(tasks.status, 'Open'),
        lt(tasks.dueDate, new Date()),
      )!;
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select(this.taskViewColumns())
        .from(tasks)
        .leftJoin(users, assigneeJoinOn)
        .where(whereClause)
        .orderBy(...buildTasksOrderBy(params.sort))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data: data as TaskViewRow[], total };
  }

  async findFilterOptions(params: { tenantId: string }): Promise<{
    names: string[];
    taskTypes: string[];
    assignees: { id: string; name: string }[];
  }> {
    const tenantWhere = eq(tasks.tenantId, params.tenantId);

    const [nameRows, typeRows, assigneeRows] = await Promise.all([
      this.db
        .selectDistinct({ name: tasks.name })
        .from(tasks)
        .where(tenantWhere)
        .orderBy(asc(tasks.name)),
      this.db
        .selectDistinct({ taskType: tasks.taskType })
        .from(tasks)
        .where(and(tenantWhere, sql`${tasks.taskType} IS NOT NULL AND btrim(${tasks.taskType}) <> ''`))
        .orderBy(asc(tasks.taskType)),
      this.db
        .selectDistinct({ id: tasks.assignedToUserId, name: users.name })
        .from(tasks)
        .leftJoin(users, assigneeJoinOn)
        .where(
          and(
            tenantWhere,
            sql`${tasks.assignedToUserId} IS NOT NULL AND btrim(${tasks.assignedToUserId}) <> ''`,
          ),
        )
        .orderBy(asc(users.name)),
    ]);

    return {
      names: nameRows.map((r) => r.name).filter((n) => (n ?? '').trim().length > 0),
      taskTypes: typeRows
        .map((r) => (r.taskType ?? '').trim())
        .filter(Boolean),
      assignees: assigneeRows
        .filter((r): r is { id: string; name: string | null } => !!r.id)
        .map((r) => ({ id: r.id, name: (r.name ?? '').trim() || r.id })),
    };
  }

  async findByEntity(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
  }): Promise<TaskViewRow[]> {
    const rows = await this.db
      .select(this.taskViewColumns())
      .from(tasks)
      .leftJoin(users, assigneeJoinOn)
      .where(
        and(
          eq(tasks.tenantId, params.tenantId),
          eq(tasks.relatedEntityType, params.entityType),
          eq(tasks.relatedEntityId, params.entityId),
        ),
      )
      .orderBy(asc(tasks.dueDate));
    return rows as TaskViewRow[];
  }

  async findOverdue(params: { tenantId: string }): Promise<TaskViewRow[]> {
    const rows = await this.db
      .select(this.taskViewColumns())
      .from(tasks)
      .leftJoin(users, assigneeJoinOn)
      .where(
        and(
          eq(tasks.tenantId, params.tenantId),
          eq(tasks.status, 'Open'),
          lt(tasks.dueDate, new Date()),
        ),
      )
      .orderBy(asc(tasks.dueDate));
    return rows as TaskViewRow[];
  }

  async findOne(params: {
    id: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<TaskViewRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select(this.taskViewColumns())
      .from(tasks)
      .leftJoin(users, assigneeJoinOn)
      .where(and(eq(tasks.id, params.id), eq(tasks.tenantId, params.tenantId)))
      .limit(1);
    return (row as TaskViewRow) ?? null;
  }

  async findByExternalReference(params: {
    tenantId: string;
    externalReference: string;
    tx?: DrizzleDbOrTx;
  }): Promise<TaskRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, params.tenantId),
          eq(tasks.externalReference, params.externalReference),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Crunchwork type UUID from a previously ingested task of the same type name.
   * IAG GET payloads often have taskType.externalReference = null, so outbound
   * create must send the CW id rather than the display name.
   */
  async findCwTaskTypeId(params: {
    tenantId: string;
    typeName: string;
  }): Promise<string | null> {
    const typeName = params.typeName.trim();
    if (!typeName) return null;
    const [row] = await this.db
      .select({
        id: sql<string>`${tasks.taskPayload}->'taskType'->>'id'`,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, params.tenantId),
          sql`(${tasks.taskPayload}->'taskType'->>'id') IS NOT NULL`,
          sql`btrim(${tasks.taskPayload}->'taskType'->>'id') <> ''`,
          or(
            eq(tasks.taskType, typeName),
            sql`(${tasks.taskPayload}->'taskType'->>'name') = ${typeName}`,
          ),
        ),
      )
      .orderBy(desc(tasks.updatedAt))
      .limit(1);
    const id = row?.id?.trim();
    return id || null;
  }

  async findByJob(params: { jobId: string; tenantId: string }): Promise<TaskViewRow[]> {
    const rows = await this.db
      .select(this.taskViewColumns())
      .from(tasks)
      .leftJoin(users, assigneeJoinOn)
      .where(and(eq(tasks.jobId, params.jobId), eq(tasks.tenantId, params.tenantId)))
      .orderBy(asc(tasks.dueDate));
    return rows as TaskViewRow[];
  }

  async findByClaim(params: { claimId: string; tenantId: string }): Promise<TaskViewRow[]> {
    const rows = await this.db
      .select(this.taskViewColumns())
      .from(tasks)
      .leftJoin(users, assigneeJoinOn)
      .where(and(eq(tasks.claimId, params.claimId), eq(tasks.tenantId, params.tenantId)))
      .orderBy(asc(tasks.dueDate));
    return rows as TaskViewRow[];
  }

  async create(params: { data: TaskInsert; tx?: DrizzleDbOrTx }): Promise<TaskRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(tasks).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<TaskInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<TaskRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(tasks)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(tasks.id, params.id))
      .returning();
    return updated ?? null;
  }

  async countByTenantAndStatus(params: {
    tenantId: string;
    status: string;
  }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, params.tenantId),
          eq(tasks.status, params.status),
        ),
      );
    return r?.count ?? 0;
  }

  private taskViewColumns() {
    return {
      ...getTableColumns(tasks),
      assigneeName: users.name,
    };
  }
}

