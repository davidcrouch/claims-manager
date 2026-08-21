import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, or, not, desc, asc, sql, inArray, isNull, ilike } from 'drizzle-orm';
import { normalizeListJobIds, parseCsvFilterValues } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { messages } from '../schema';

export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;

const unreadCondition = and(
  eq(messages.acknowledgementRequired, true),
  isNull(messages.acknowledgedAt),
)!;

const fromDisplayName = sql`COALESCE(
  NULLIF(btrim(${messages.messagePayload}->'createdByUser'->>'name'), ''),
  NULLIF(btrim(${messages.messagePayload}->'createdBy'->>'name'), ''),
  NULLIF(btrim(${messages.createdByUserId}), ''),
  'System'
)`;

const toDisplayName = sql`COALESCE(
  NULLIF(btrim(${messages.messagePayload}->'toUser'->>'name'), ''),
  '—'
)`;

@Injectable()
export class MessagesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    claimId?: string;
    fromJobId?: string;
    toJobId?: string;
    readStatus?: string;
    fromUserIds?: string;
    toUserIds?: string;
    fromNames?: string;
    toNames?: string;
    search?: string;
    sort?: string;
  }): Promise<{ data: MessageRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = eq(messages.tenantId, params.tenantId);
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        or(
          jobIds.length === 1
            ? eq(messages.fromJobId, jobIds[0])
            : inArray(messages.fromJobId, jobIds),
          jobIds.length === 1
            ? eq(messages.toJobId, jobIds[0])
            : inArray(messages.toJobId, jobIds),
        ),
      )!;
    }
    if (params.claimId) {
      whereClause = and(
        whereClause,
        or(
          eq(messages.fromClaimId, params.claimId),
          eq(messages.toClaimId, params.claimId),
        ),
      )!;
    }
    if (params.fromJobId) {
      whereClause = and(whereClause, eq(messages.fromJobId, params.fromJobId))!;
    }
    if (params.toJobId) {
      whereClause = and(whereClause, eq(messages.toJobId, params.toJobId))!;
    }

    const readStatuses = parseCsvFilterValues(params.readStatus);
    if (readStatuses) {
      if (readStatuses.length === 0) return { data: [], total: 0 };
      const normalized = readStatuses.map((s) => s.toLowerCase());
      const wantUnread = normalized.includes('unread');
      const wantRead = normalized.includes('read');
      if (wantUnread && !wantRead) {
        whereClause = and(whereClause, unreadCondition)!;
      } else if (wantRead && !wantUnread) {
        whereClause = and(whereClause, not(unreadCondition))!;
      }
      // both selected → no status filter
    }

    const fromUserIds = parseCsvFilterValues(params.fromUserIds);
    if (fromUserIds) {
      if (fromUserIds.length === 0) return { data: [], total: 0 };
      const includeBlank = fromUserIds.includes('__blank__');
      const realIds = fromUserIds.filter((id) => id !== '__blank__');
      if (includeBlank && realIds.length > 0) {
        whereClause = and(
          whereClause,
          or(isNull(messages.createdByUserId), inArray(messages.createdByUserId, realIds))!,
        )!;
      } else if (includeBlank) {
        whereClause = and(whereClause, isNull(messages.createdByUserId))!;
      } else {
        whereClause = and(whereClause, inArray(messages.createdByUserId, realIds))!;
      }
    }

    const toUserIds = parseCsvFilterValues(params.toUserIds);
    if (toUserIds) {
      if (toUserIds.length === 0) return { data: [], total: 0 };
      const includeBlank = toUserIds.includes('__blank__');
      const realIds = toUserIds.filter((id) => id !== '__blank__');
      if (includeBlank && realIds.length > 0) {
        whereClause = and(
          whereClause,
          or(isNull(messages.toUserId), inArray(messages.toUserId, realIds))!,
        )!;
      } else if (includeBlank) {
        whereClause = and(whereClause, isNull(messages.toUserId))!;
      } else {
        whereClause = and(whereClause, inArray(messages.toUserId, realIds))!;
      }
    }

    const fromNames = parseCsvFilterValues(params.fromNames);
    if (fromNames) {
      if (fromNames.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        sql`${fromDisplayName} IN (${sql.join(
          fromNames.map((n) => sql`${n}`),
          sql`, `,
        )})`,
      )!;
    }

    const toNames = parseCsvFilterValues(params.toNames);
    if (toNames) {
      if (toNames.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        sql`${toDisplayName} IN (${sql.join(
          toNames.map((n) => sql`${n}`),
          sql`, `,
        )})`,
      )!;
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(ilike(messages.subject, term), ilike(messages.body, term))!,
      )!;
    }

    let orderBy;
    switch (params.sort) {
      case 'subject_asc':
        orderBy = [asc(messages.subject)];
        break;
      case 'subject_desc':
        orderBy = [desc(messages.subject)];
        break;
      case 'created_at_asc':
        orderBy = [asc(messages.createdAt)];
        break;
      case 'created_at_desc':
      default:
        orderBy = [desc(messages.createdAt)];
        break;
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(messages)
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findFilterOptions(params: { tenantId: string }): Promise<{
    fromNames: string[];
    toNames: string[];
    statuses: ['Read', 'Unread'];
  }> {
    const tenantWhere = eq(messages.tenantId, params.tenantId);

    const [fromRows, toRows] = await Promise.all([
      this.db
        .selectDistinct({ name: fromDisplayName })
        .from(messages)
        .where(tenantWhere)
        .orderBy(sql`${fromDisplayName} ASC`),
      this.db
        .selectDistinct({ name: toDisplayName })
        .from(messages)
        .where(tenantWhere)
        .orderBy(sql`${toDisplayName} ASC`),
    ]);

    return {
      fromNames: fromRows
        .map((r) => String(r.name ?? '').trim())
        .filter(Boolean),
      toNames: toRows
        .map((r) => String(r.name ?? '').trim())
        .filter((n) => n && n !== '—'),
      statuses: ['Read', 'Unread'],
    };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<MessageRow | null> {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, params.id), eq(messages.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async create(params: { data: MessageInsert; tx?: DrizzleDbOrTx }): Promise<MessageRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(messages).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<MessageInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<MessageRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(messages)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(messages.id, params.id))
      .returning();
    return updated ?? null;
  }
}
