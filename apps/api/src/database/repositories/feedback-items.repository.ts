import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, asc, count, ilike, or, sql, inArray, type SQL } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { feedbackItems } from '../schema';

export type FeedbackItemRow = typeof feedbackItems.$inferSelect;
export type FeedbackItemInsert = typeof feedbackItems.$inferInsert;

function splitCsv(value?: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Display page label used in list UI: pageLabel, else pathname, else blank. */
const pageLabelExpr = sql<string>`COALESCE(
  NULLIF(TRIM(${feedbackItems.pageContext}->>'pageLabel'), ''),
  NULLIF(TRIM(${feedbackItems.pageContext}->>'pathname'), ''),
  ''
)`;

const reporterLabelExpr = sql<string>`COALESCE(
  NULLIF(TRIM(${feedbackItems.reportedByName}), ''),
  NULLIF(TRIM(${feedbackItems.reportedByUserId}), ''),
  ''
)`;

const priorityRankExpr = sql`CASE ${feedbackItems.priority}
  WHEN 'critical' THEN 1
  WHEN 'high' THEN 2
  WHEN 'medium' THEN 3
  WHEN 'low' THEN 4
  ELSE 5
END`;

const statusRankExpr = sql`CASE ${feedbackItems.status}
  WHEN 'open' THEN 1
  WHEN 'in_progress' THEN 2
  WHEN 'resolved' THEN 3
  WHEN 'closed' THEN 4
  ELSE 5
END`;

function buildFeedbackOrderBy(sort?: string): SQL[] {
  switch (sort) {
    case 'title_asc':
      return [asc(feedbackItems.title)];
    case 'title_desc':
      return [desc(feedbackItems.title)];
    case 'type_asc':
      return [asc(feedbackItems.type)];
    case 'type_desc':
      return [desc(feedbackItems.type)];
    case 'priority_asc':
      return [asc(priorityRankExpr), asc(feedbackItems.priority)];
    case 'priority_desc':
      return [desc(priorityRankExpr), desc(feedbackItems.priority)];
    case 'status_asc':
      return [asc(statusRankExpr), asc(feedbackItems.status)];
    case 'status_desc':
      return [desc(statusRankExpr), desc(feedbackItems.status)];
    case 'reported_by_asc':
      return [asc(reporterLabelExpr)];
    case 'reported_by_desc':
      return [desc(reporterLabelExpr)];
    case 'page_asc':
      return [asc(pageLabelExpr)];
    case 'page_desc':
      return [desc(pageLabelExpr)];
    case 'created_at_asc':
      return [asc(feedbackItems.createdAt)];
    case 'created_at_desc':
    default:
      return [desc(feedbackItems.createdAt)];
  }
}

function applyCsvInFilter(params: {
  where: SQL | undefined;
  column: typeof feedbackItems.type | typeof feedbackItems.status | typeof feedbackItems.priority;
  csv?: string;
}): SQL | undefined {
  const values = splitCsv(params.csv);
  if (values.length === 0) return params.where;
  if (values.length === 1) {
    return and(params.where, eq(params.column, values[0]));
  }
  return and(params.where, inArray(params.column, values));
}

function applyLabelCsvFilter(params: {
  where: SQL | undefined;
  expr: SQL;
  csv?: string;
}): SQL | undefined {
  const raw = splitCsv(params.csv);
  if (raw.length === 0) return params.where;
  const includeBlank = raw.includes('__blank__');
  const labels = raw.filter((value) => value !== '__blank__');
  const parts: SQL[] = [];
  if (labels.length === 1) {
    parts.push(sql`${params.expr} = ${labels[0]}`);
  } else if (labels.length > 1) {
    parts.push(sql`${params.expr} IN (${sql.join(labels.map((l) => sql`${l}`), sql`, `)})`);
  }
  if (includeBlank) {
    parts.push(sql`${params.expr} = ''`);
  }
  if (parts.length === 0) return params.where;
  const matched = parts.length === 1 ? parts[0] : or(...parts)!;
  return and(params.where, matched);
}

function applyReporterCsvFilter(params: {
  where: SQL | undefined;
  csv?: string;
}): SQL | undefined {
  const values = splitCsv(params.csv);
  if (values.length === 0) return params.where;
  if (values.length === 1) {
    return and(params.where, eq(feedbackItems.reportedByUserId, values[0]));
  }
  return and(params.where, inArray(feedbackItems.reportedByUserId, values));
}

@Injectable()
export class FeedbackItemsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: FeedbackItemInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<FeedbackItemRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(feedbackItems)
      .values(params.data)
      .returning();
    return row;
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<FeedbackItemRow | undefined> {
    const [row] = await this.db
      .select()
      .from(feedbackItems)
      .where(
        and(
          eq(feedbackItems.id, params.id),
          eq(feedbackItems.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    return row;
  }

  async findAll(params: {
    tenantId: string;
    type?: string;
    status?: string;
    priority?: string;
    reportedBy?: string;
    pageLabel?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: FeedbackItemRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause: SQL | undefined = eq(feedbackItems.tenantId, params.tenantId);

    whereClause = applyCsvInFilter({
      where: whereClause,
      column: feedbackItems.type,
      csv: params.type,
    });
    whereClause = applyCsvInFilter({
      where: whereClause,
      column: feedbackItems.status,
      csv: params.status,
    });
    whereClause = applyCsvInFilter({
      where: whereClause,
      column: feedbackItems.priority,
      csv: params.priority,
    });
    whereClause = applyReporterCsvFilter({
      where: whereClause,
      csv: params.reportedBy,
    });
    whereClause = applyLabelCsvFilter({
      where: whereClause,
      expr: pageLabelExpr,
      csv: params.pageLabel,
    });

    if (params.search) {
      whereClause = and(
        whereClause,
        or(
          ilike(feedbackItems.title, `%${params.search}%`),
          ilike(feedbackItems.description, `%${params.search}%`),
        )!,
      );
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(feedbackItems)
        .where(whereClause)
        .orderBy(...buildFeedbackOrderBy(params.sort))
        .offset(skip)
        .limit(limit),
      this.db
        .select({ value: count() })
        .from(feedbackItems)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.value ?? 0 };
  }

  async findFilterOptions(params: {
    tenantId: string;
  }): Promise<{
    reporters: { userId: string; name: string | null }[];
    pages: string[];
  }> {
    const tenantWhere = eq(feedbackItems.tenantId, params.tenantId);

    const [reporterRows, pageRows] = await Promise.all([
      this.db
        .selectDistinct({
          userId: feedbackItems.reportedByUserId,
          name: feedbackItems.reportedByName,
        })
        .from(feedbackItems)
        .where(tenantWhere)
        .orderBy(asc(feedbackItems.reportedByName)),
      this.db
        .selectDistinct({ label: pageLabelExpr })
        .from(feedbackItems)
        .where(tenantWhere)
        .orderBy(asc(pageLabelExpr)),
    ]);

    return {
      reporters: reporterRows.map((row) => ({
        userId: row.userId,
        name: row.name,
      })),
      pages: pageRows.map((row) => row.label ?? ''),
    };
  }

  async update(params: {
    id: string;
    tenantId: string;
    data: Partial<
      Pick<
        FeedbackItemInsert,
        'status' | 'priority' | 'resolution' | 'tags' | 'title' | 'description'
      >
    >;
  }): Promise<FeedbackItemRow | undefined> {
    const [row] = await this.db
      .update(feedbackItems)
      .set({ ...params.data, updatedAt: new Date() })
      .where(
        and(
          eq(feedbackItems.id, params.id),
          eq(feedbackItems.tenantId, params.tenantId),
        ),
      )
      .returning();
    return row;
  }

  async delete(params: {
    id: string;
    tenantId: string;
  }): Promise<FeedbackItemRow | undefined> {
    const [row] = await this.db
      .delete(feedbackItems)
      .where(
        and(
          eq(feedbackItems.id, params.id),
          eq(feedbackItems.tenantId, params.tenantId),
        ),
      )
      .returning();
    return row;
  }

  async countByStatus(params: {
    tenantId: string;
  }): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        status: feedbackItems.status,
        count: count(),
      })
      .from(feedbackItems)
      .where(eq(feedbackItems.tenantId, params.tenantId))
      .groupBy(feedbackItems.status);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = row.count;
    }
    return result;
  }

  async countByType(params: {
    tenantId: string;
  }): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        type: feedbackItems.type,
        count: count(),
      })
      .from(feedbackItems)
      .where(eq(feedbackItems.tenantId, params.tenantId))
      .groupBy(feedbackItems.type);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.type] = row.count;
    }
    return result;
  }
}
