import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc, sql, ilike } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { documents } from '../schema';

export type DocumentRow = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;

export interface DocumentFilters {
  categoryId?: string;
  uncategorised?: boolean;
  relatedRecordType?: string;
  relatedRecordId?: string;
  search?: string;
  uploadStatus?: string;
}

@Injectable()
export class DocumentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    filters?: DocumentFilters;
    page?: number;
    limit?: number;
    sort?: string;
  }): Promise<{ data: DocumentRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const filters = params.filters ?? {};

    const conditions: any[] = [
      eq(documents.tenantId, params.tenantId),
      isNull(documents.archivedAt),
    ];

    if (filters.categoryId) {
      conditions.push(eq(documents.filesystemCategoryId, filters.categoryId));
    }

    if (filters.uncategorised) {
      conditions.push(isNull(documents.filesystemCategoryId));
    }

    if (filters.relatedRecordType) {
      conditions.push(eq(documents.relatedRecordType, filters.relatedRecordType));
    }

    if (filters.relatedRecordId) {
      conditions.push(eq(documents.relatedRecordId, filters.relatedRecordId));
    }

    if (filters.search) {
      conditions.push(ilike(documents.fileName, `%${filters.search}%`));
    }

    if (filters.uploadStatus) {
      conditions.push(eq(documents.uploadStatus, filters.uploadStatus));
    }

    const whereClause = and(...conditions);

    const orderBy = params.sort === 'name'
      ? documents.fileName
      : desc(documents.createdAt);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(documents)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(id: string, tenantId: string): Promise<DocumentRow | null> {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.tenantId, tenantId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(data: DocumentInsert): Promise<DocumentRow> {
    const [inserted] = await this.db
      .insert(documents)
      .values(data)
      .returning();
    return inserted;
  }

  async update(id: string, tenantId: string, data: Partial<DocumentInsert>): Promise<DocumentRow | null> {
    const [updated] = await this.db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .returning();
    return updated ?? null;
  }

  async archive(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(documents)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));
  }

  async hardDelete(id: string, tenantId: string): Promise<void> {
    await this.db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));
  }
}
