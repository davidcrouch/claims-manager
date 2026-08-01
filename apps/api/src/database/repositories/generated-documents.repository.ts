import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, count } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { generatedDocuments } from '../schema';

export type GeneratedDocumentRow = typeof generatedDocuments.$inferSelect;
export type GeneratedDocumentInsert = typeof generatedDocuments.$inferInsert;

@Injectable()
export class GeneratedDocumentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: GeneratedDocumentInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<GeneratedDocumentRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(generatedDocuments)
      .values(params.data)
      .returning();
    return row;
  }

  async findById(params: {
    id: string;
    tenantId: string;
  }): Promise<GeneratedDocumentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(generatedDocuments)
      .where(
        and(
          eq(generatedDocuments.id, params.id),
          eq(generatedDocuments.tenantId, params.tenantId),
        ),
      );
    return row;
  }

  async findByEntity(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
  }): Promise<GeneratedDocumentRow[]> {
    return this.db
      .select()
      .from(generatedDocuments)
      .where(
        and(
          eq(generatedDocuments.tenantId, params.tenantId),
          eq(generatedDocuments.entityType, params.entityType),
          eq(generatedDocuments.entityId, params.entityId),
        ),
      )
      .orderBy(desc(generatedDocuments.createdAt));
  }

  async findAll(params: {
    tenantId: string;
    documentType?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: GeneratedDocumentRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const conditions = [eq(generatedDocuments.tenantId, params.tenantId)];
    if (params.documentType) {
      conditions.push(eq(generatedDocuments.documentType, params.documentType));
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(generatedDocuments)
        .where(whereClause)
        .orderBy(desc(generatedDocuments.createdAt))
        .offset(skip)
        .limit(limit),
      this.db
        .select({ value: count() })
        .from(generatedDocuments)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.value ?? 0 };
  }

  async updateStatus(params: {
    id: string;
    status: string;
    errorMessage?: string;
    s3KeyPdf?: string;
    s3KeyDocx?: string;
  }): Promise<GeneratedDocumentRow | undefined> {
    const updates: Record<string, unknown> = { status: params.status };
    if (params.errorMessage !== undefined) updates.errorMessage = params.errorMessage;
    if (params.s3KeyPdf !== undefined) updates.s3KeyPdf = params.s3KeyPdf;
    if (params.s3KeyDocx !== undefined) updates.s3KeyDocx = params.s3KeyDocx;

    const [row] = await this.db
      .update(generatedDocuments)
      .set(updates)
      .where(eq(generatedDocuments.id, params.id))
      .returning();
    return row;
  }
}
