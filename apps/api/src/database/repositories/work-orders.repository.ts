import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import {
  eq,
  and,
  isNull,
  desc,
  asc,
  sql,
  inArray,
  aliasedTable,
  getTableColumns,
  or,
  ilike,
} from 'drizzle-orm';
import { normalizeListJobIds, normalizeListUserIds } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { workOrders, lookupValues, users } from '../schema';

export type WorkOrderRow = typeof workOrders.$inferSelect;
export type WorkOrderInsert = typeof workOrders.$inferInsert;

export interface WorkOrderViewRow extends WorkOrderRow {
  statusName: string | null;
  statusExternalReference: string | null;
  workOrderTypeName: string | null;
  workOrderTypeExternalReference: string | null;
  assigneeName: string | null;
}

const assigneeJoinOn = sql`${workOrders.assignedToUserId} = ${users.id}::text`;

function buildWorkOrdersOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(workOrders.updatedAt)];
    case 'created_at_desc':
      return [desc(workOrders.createdAt)];
    case 'created_at_asc':
      return [asc(workOrders.createdAt)];
    case 'name_asc':
      return [asc(workOrders.name)];
    case 'name_desc':
      return [desc(workOrders.name)];
    case 'insurer_po_asc':
    case 'work_order_number_asc':
      return [asc(workOrders.workOrderNumber)];
    case 'insurer_po_desc':
    case 'work_order_number_desc':
      return [desc(workOrders.workOrderNumber)];
    case 'total_amount_asc':
      return [asc(workOrders.totalAmount)];
    case 'total_amount_desc':
      return [desc(workOrders.totalAmount)];
    case 'start_date_asc':
      return [asc(workOrders.startDate)];
    case 'start_date_desc':
      return [desc(workOrders.startDate)];
    case 'status_asc':
      return [asc(workOrders.statusLookupId)];
    case 'status_desc':
      return [desc(workOrders.statusLookupId)];
    case 'wo_type_asc':
      return [asc(workOrders.workOrderTypeLookupId)];
    case 'wo_type_desc':
      return [desc(workOrders.workOrderTypeLookupId)];
    case 'source_asc':
      return [asc(workOrders.sourceExternalReference)];
    case 'source_desc':
      return [desc(workOrders.sourceExternalReference)];
    case 'assignee_asc':
      return [asc(users.name)];
    case 'assignee_desc':
      return [desc(users.name)];
    case 'updated_at_desc':
    default:
      return [desc(workOrders.updatedAt)];
  }
}

@Injectable()
export class WorkOrdersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    purchaseOrderId?: string;
    /** Comma-separated status lookup IDs. */
    status?: string;
    /** Comma-separated work order type lookup IDs. */
    workOrderType?: string;
    assignedToUserId?: string;
    assignedToUserIds?: string;
    search?: string;
    sort?: string;
  }): Promise<{ data: WorkOrderViewRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const typeLookup = aliasedTable(lookupValues, 'wo_type_lookup');

    let whereClause = and(
      eq(workOrders.tenantId, params.tenantId),
      isNull(workOrders.deletedAt),
    );
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        jobIds.length === 1 ? eq(workOrders.jobId, jobIds[0]) : inArray(workOrders.jobId, jobIds),
      );
    }
    if (params.purchaseOrderId) {
      whereClause = and(whereClause, eq(workOrders.purchaseOrderId, params.purchaseOrderId));
    }
    const statusIds = params.status?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const typeIds = params.workOrderType?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (statusIds.length > 0) {
      whereClause = and(whereClause, inArray(workOrders.statusLookupId, statusIds));
    }
    if (typeIds.length > 0) {
      whereClause = and(whereClause, inArray(workOrders.workOrderTypeLookupId, typeIds));
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(workOrders.workOrderNumber, term),
          ilike(workOrders.internalNumber, term),
          ilike(workOrders.name, term),
          ilike(workOrders.externalId, term),
          ilike(workOrders.sourceExternalReference, term),
          sql`${workOrders.workOrderPayload}->>'purchaseOrderNumber' ILIKE ${term}`,
          ilike(workOrders.woForName, term),
          ilike(workOrders.note, term),
        )!,
      );
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
          or(isNull(workOrders.assignedToUserId), inArray(workOrders.assignedToUserId, realIds))!,
        );
      } else if (includeBlank) {
        whereClause = and(whereClause, isNull(workOrders.assignedToUserId));
      } else {
        whereClause = and(whereClause, inArray(workOrders.assignedToUserId, realIds));
      }
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          ...getTableColumns(workOrders),
          statusName: statusLookup.name,
          statusExternalReference: statusLookup.externalReference,
          workOrderTypeName: typeLookup.name,
          workOrderTypeExternalReference: typeLookup.externalReference,
          assigneeName: users.name,
        })
        .from(workOrders)
        .leftJoin(statusLookup, eq(workOrders.statusLookupId, statusLookup.id))
        .leftJoin(typeLookup, eq(workOrders.workOrderTypeLookupId, typeLookup.id))
        .leftJoin(users, assigneeJoinOn)
        .where(whereClause)
        .orderBy(...buildWorkOrdersOrderBy(params.sort))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(workOrders)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data: data as WorkOrderViewRow[], total };
  }

  async findFilterAssignees(params: {
    tenantId: string;
  }): Promise<{ id: string; name: string }[]> {
    const rows = await this.db
      .selectDistinct({ id: workOrders.assignedToUserId, name: users.name })
      .from(workOrders)
      .leftJoin(users, assigneeJoinOn)
      .where(
        and(
          eq(workOrders.tenantId, params.tenantId),
          isNull(workOrders.deletedAt),
          sql`${workOrders.assignedToUserId} IS NOT NULL AND btrim(${workOrders.assignedToUserId}) <> ''`,
        ),
      )
      .orderBy(asc(users.name));

    return rows
      .filter((r): r is { id: string; name: string | null } => !!r.id)
      .map((r) => ({ id: r.id, name: (r.name ?? '').trim() || r.id }));
  }

  async findOne(params: { id: string; tenantId: string }): Promise<WorkOrderViewRow | null> {
    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const typeLookup = aliasedTable(lookupValues, 'wo_type_lookup');
    const [row] = await this.db
      .select({
        ...getTableColumns(workOrders),
        statusName: statusLookup.name,
        statusExternalReference: statusLookup.externalReference,
        workOrderTypeName: typeLookup.name,
        workOrderTypeExternalReference: typeLookup.externalReference,
        assigneeName: users.name,
      })
      .from(workOrders)
      .leftJoin(statusLookup, eq(workOrders.statusLookupId, statusLookup.id))
      .leftJoin(typeLookup, eq(workOrders.workOrderTypeLookupId, typeLookup.id))
      .leftJoin(users, assigneeJoinOn)
      .where(and(eq(workOrders.id, params.id), eq(workOrders.tenantId, params.tenantId)))
      .limit(1);
    return (row as WorkOrderViewRow) ?? null;
  }

  async findByJob(params: { jobId: string; tenantId: string }): Promise<WorkOrderViewRow[]> {
    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const typeLookup = aliasedTable(lookupValues, 'wo_type_lookup');

    const data = await this.db
      .select({
        ...getTableColumns(workOrders),
        statusName: statusLookup.name,
        statusExternalReference: statusLookup.externalReference,
        workOrderTypeName: typeLookup.name,
        workOrderTypeExternalReference: typeLookup.externalReference,
        assigneeName: users.name,
      })
      .from(workOrders)
      .leftJoin(statusLookup, eq(workOrders.statusLookupId, statusLookup.id))
      .leftJoin(typeLookup, eq(workOrders.workOrderTypeLookupId, typeLookup.id))
      .leftJoin(users, assigneeJoinOn)
      .where(
        and(
          eq(workOrders.jobId, params.jobId),
          eq(workOrders.tenantId, params.tenantId),
          isNull(workOrders.deletedAt),
        ),
      )
      .orderBy(desc(workOrders.updatedAt));
    return data as WorkOrderViewRow[];
  }

  async findByPurchaseOrder(params: {
    purchaseOrderId: string;
    tenantId: string;
  }): Promise<WorkOrderRow[]> {
    return this.db
      .select()
      .from(workOrders)
      .where(
        and(
          eq(workOrders.purchaseOrderId, params.purchaseOrderId),
          eq(workOrders.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(workOrders.updatedAt));
  }

  async create(params: { data: WorkOrderInsert; tx?: DrizzleDbOrTx }): Promise<WorkOrderRow> {
    const db = params.tx ?? this.db;
    const [row] = await db.insert(workOrders).values(params.data).returning();
    return row;
  }

  async update(params: {
    id: string;
    data: Partial<WorkOrderInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<WorkOrderRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(workOrders)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(workOrders.id, params.id))
      .returning();
    return updated ?? null;
  }
}
