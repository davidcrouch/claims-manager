import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql, ilike, or } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { attachments } from '../schema';

export type AttachmentRow = typeof attachments.$inferSelect;
export type AttachmentInsert = typeof attachments.$inferInsert;

function buildAttachmentsOrderBy(sort?: string) {
  switch (sort) {
    case 'title_asc':
      return [asc(attachments.title)];
    case 'title_desc':
      return [desc(attachments.title)];
    case 'filename_asc':
      return [asc(attachments.fileName)];
    case 'filename_desc':
      return [desc(attachments.fileName)];
    case 'size_asc':
      return [asc(attachments.fileSize)];
    case 'size_desc':
      return [desc(attachments.fileSize)];
    case 'type_asc':
      return [asc(attachments.documentTypeLookupId)];
    case 'type_desc':
      return [desc(attachments.documentTypeLookupId)];
    case 'entity_asc':
      return [asc(attachments.relatedRecordType)];
    case 'entity_desc':
      return [desc(attachments.relatedRecordType)];
    case 'created_at_asc':
      return [asc(attachments.createdAt)];
    case 'created_at_desc':
    default:
      return [desc(attachments.createdAt)];
  }
}

@Injectable()
export class AttachmentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
    relatedRecordType?: string;
    sort?: string;
  }): Promise<{ data: AttachmentRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(attachments.tenantId, params.tenantId),
      isNull(attachments.deletedAt),
    );
    if (params.relatedRecordType) {
      whereClause = and(whereClause, eq(attachments.relatedRecordType, params.relatedRecordType));
    }
    if (params.search) {
      const pattern = `%${params.search}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(attachments.title, pattern),
          ilike(attachments.fileName, pattern),
        ),
      );
    }

    const orderBy = buildAttachmentsOrderBy(params.sort);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(attachments)
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(attachments)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<AttachmentRow | null> {
    const [row] = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, params.id), eq(attachments.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByRelatedRecord(params: {
    tenantId: string;
    relatedRecordType: string;
    relatedRecordId: string;
  }): Promise<AttachmentRow[]> {
    return this.db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.tenantId, params.tenantId),
          eq(attachments.relatedRecordType, params.relatedRecordType),
          eq(attachments.relatedRecordId, params.relatedRecordId),
        ),
      )
      .orderBy(desc(attachments.createdAt));
  }

  async create(params: { data: AttachmentInsert; tx?: DrizzleDbOrTx }): Promise<AttachmentRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(attachments).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<AttachmentInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<AttachmentRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(attachments)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(attachments.id, params.id))
      .returning();
    return updated ?? null;
  }
}
