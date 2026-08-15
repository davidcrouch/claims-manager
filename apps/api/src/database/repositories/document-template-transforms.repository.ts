import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { documentTemplateTransforms, documentTemplateTransformVersions } from '../schema';

export type DocumentTemplateTransformRow =
  typeof documentTemplateTransforms.$inferSelect;
export type DocumentTemplateTransformInsert =
  typeof documentTemplateTransforms.$inferInsert;
export type DocumentTemplateTransformVersionRow =
  typeof documentTemplateTransformVersions.$inferSelect;

@Injectable()
export class DocumentTemplateTransformsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByType(params: {
    tenantId: string;
    documentType: string;
  }): Promise<DocumentTemplateTransformRow | undefined> {
    const [row] = await this.db
      .select()
      .from(documentTemplateTransforms)
      .where(
        and(
          eq(documentTemplateTransforms.tenantId, params.tenantId),
          eq(documentTemplateTransforms.documentType, params.documentType),
        ),
      )
      .limit(1);
    return row;
  }

  async findByTenant(params: {
    tenantId: string;
  }): Promise<DocumentTemplateTransformRow[]> {
    return this.db
      .select()
      .from(documentTemplateTransforms)
      .where(eq(documentTemplateTransforms.tenantId, params.tenantId));
  }

  async upsert(params: {
    tenantId: string;
    documentType: string;
    jsonataRules?: string | null;
    targetSchema?: unknown;
    testData?: unknown;
    updatedBy?: string | null;
  }): Promise<DocumentTemplateTransformRow> {
    const existing = await this.findByType({
      tenantId: params.tenantId,
      documentType: params.documentType,
    });

    if (existing) {
      await this.db.insert(documentTemplateTransformVersions).values({
        transformId: existing.id,
        version: existing.version,
        jsonataRules: existing.jsonataRules,
        targetSchema: existing.targetSchema,
        createdBy: existing.updatedBy,
      });

      const nextVersion = existing.version + 1;
      const [row] = await this.db
        .update(documentTemplateTransforms)
        .set({
          jsonataRules: params.jsonataRules ?? existing.jsonataRules,
          targetSchema: params.targetSchema ?? existing.targetSchema,
          testData: params.testData ?? existing.testData,
          updatedBy: params.updatedBy ?? existing.updatedBy,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(eq(documentTemplateTransforms.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(documentTemplateTransforms)
      .values({
        tenantId: params.tenantId,
        documentType: params.documentType,
        jsonataRules: params.jsonataRules ?? null,
        targetSchema: params.targetSchema ?? null,
        testData: params.testData ?? null,
        updatedBy: params.updatedBy ?? null,
      })
      .returning();
    return row;
  }

  async getVersions(params: {
    transformId: string;
  }): Promise<DocumentTemplateTransformVersionRow[]> {
    return this.db
      .select()
      .from(documentTemplateTransformVersions)
      .where(eq(documentTemplateTransformVersions.transformId, params.transformId))
      .orderBy(desc(documentTemplateTransformVersions.version));
  }

  async delete(params: {
    tenantId: string;
    documentType: string;
  }): Promise<boolean> {
    const result = await this.db
      .delete(documentTemplateTransforms)
      .where(
        and(
          eq(documentTemplateTransforms.tenantId, params.tenantId),
          eq(documentTemplateTransforms.documentType, params.documentType),
        ),
      )
      .returning({ id: documentTemplateTransforms.id });
    return result.length > 0;
  }
}
