import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { documentTemplates } from '../schema';

export type DocumentTemplateRow = typeof documentTemplates.$inferSelect;
export type DocumentTemplateInsert = typeof documentTemplates.$inferInsert;

@Injectable()
export class DocumentTemplatesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: DocumentTemplateInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<DocumentTemplateRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(documentTemplates)
      .values(params.data)
      .returning();
    return row;
  }

  async findById(params: {
    id: string;
    tenantId: string;
  }): Promise<DocumentTemplateRow | undefined> {
    const [row] = await this.db
      .select()
      .from(documentTemplates)
      .where(
        and(
          eq(documentTemplates.id, params.id),
          eq(documentTemplates.tenantId, params.tenantId),
        ),
      );
    return row;
  }

  async findByType(params: {
    tenantId: string;
    documentType: string;
  }): Promise<DocumentTemplateRow | undefined> {
    const [row] = await this.db
      .select()
      .from(documentTemplates)
      .where(
        and(
          eq(documentTemplates.tenantId, params.tenantId),
          eq(documentTemplates.documentType, params.documentType),
        ),
      )
      .limit(1);
    return row;
  }

  async findDefault(params: {
    tenantId: string;
    documentType: string;
  }): Promise<DocumentTemplateRow | undefined> {
    return this.findByType(params);
  }

  async findByTenant(params: {
    tenantId: string;
    documentType?: string;
  }): Promise<DocumentTemplateRow[]> {
    const conditions = [eq(documentTemplates.tenantId, params.tenantId)];
    if (params.documentType) {
      conditions.push(eq(documentTemplates.documentType, params.documentType));
    }
    return this.db
      .select()
      .from(documentTemplates)
      .where(and(...conditions))
      .orderBy(desc(documentTemplates.updatedAt));
  }

  async upsertByType(params: {
    tenantId: string;
    documentType: string;
    data: {
      name: string;
      filesystemDocumentId: string | null;
      s3Key?: string | null;
      isDefault?: boolean;
      version?: number;
    };
    tx?: DrizzleDbOrTx;
  }): Promise<DocumentTemplateRow> {
    const db = params.tx ?? this.db;
    const existing = await this.findByType({
      tenantId: params.tenantId,
      documentType: params.documentType,
    });

    if (existing) {
      const [row] = await db
        .update(documentTemplates)
        .set({
          name: params.data.name,
          filesystemDocumentId: params.data.filesystemDocumentId,
          s3Key: params.data.s3Key ?? existing.s3Key,
          isDefault: params.data.isDefault ?? true,
          version: params.data.version ?? existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(documentTemplates.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await db
      .insert(documentTemplates)
      .values({
        tenantId: params.tenantId,
        documentType: params.documentType,
        name: params.data.name,
        filesystemDocumentId: params.data.filesystemDocumentId,
        s3Key: params.data.s3Key ?? null,
        isDefault: params.data.isDefault ?? true,
        version: 1,
      })
      .returning();
    return row;
  }

  async update(params: {
    id: string;
    tenantId: string;
    data: Partial<DocumentTemplateInsert>;
  }): Promise<DocumentTemplateRow | undefined> {
    const [row] = await this.db
      .update(documentTemplates)
      .set({ ...params.data, updatedAt: new Date() })
      .where(
        and(
          eq(documentTemplates.id, params.id),
          eq(documentTemplates.tenantId, params.tenantId),
        ),
      )
      .returning();
    return row;
  }

  async clearDefault(params: {
    tenantId: string;
    documentType: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    await db
      .update(documentTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(documentTemplates.tenantId, params.tenantId),
          eq(documentTemplates.documentType, params.documentType),
          eq(documentTemplates.isDefault, true),
        ),
      );
  }

  async delete(params: {
    id: string;
    tenantId: string;
  }): Promise<boolean> {
    const result = await this.db
      .delete(documentTemplates)
      .where(
        and(
          eq(documentTemplates.id, params.id),
          eq(documentTemplates.tenantId, params.tenantId),
        ),
      )
      .returning({ id: documentTemplates.id });
    return result.length > 0;
  }

  async deleteByType(params: {
    tenantId: string;
    documentType: string;
  }): Promise<boolean> {
    const result = await this.db
      .delete(documentTemplates)
      .where(
        and(
          eq(documentTemplates.tenantId, params.tenantId),
          eq(documentTemplates.documentType, params.documentType),
        ),
      )
      .returning({ id: documentTemplates.id });
    return result.length > 0;
  }
}
