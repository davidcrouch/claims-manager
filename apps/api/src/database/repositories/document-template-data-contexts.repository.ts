import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { documentTemplateDataContexts } from '../schema';

export type DocumentTemplateDataContextRow =
  typeof documentTemplateDataContexts.$inferSelect;
export type DocumentTemplateDataContextInsert =
  typeof documentTemplateDataContexts.$inferInsert;

@Injectable()
export class DocumentTemplateDataContextsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByType(params: {
    tenantId: string;
    documentType: string;
  }): Promise<DocumentTemplateDataContextRow | undefined> {
    const [row] = await this.db
      .select()
      .from(documentTemplateDataContexts)
      .where(
        and(
          eq(documentTemplateDataContexts.tenantId, params.tenantId),
          eq(documentTemplateDataContexts.documentType, params.documentType),
        ),
      )
      .limit(1);
    return row;
  }

  async upsert(params: {
    tenantId: string;
    documentType: string;
    enabledSlugs: string[];
  }): Promise<DocumentTemplateDataContextRow> {
    const existing = await this.findByType({
      tenantId: params.tenantId,
      documentType: params.documentType,
    });

    if (existing) {
      const [row] = await this.db
        .update(documentTemplateDataContexts)
        .set({
          enabledSlugs: params.enabledSlugs,
          updatedAt: new Date(),
        })
        .where(eq(documentTemplateDataContexts.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(documentTemplateDataContexts)
      .values({
        tenantId: params.tenantId,
        documentType: params.documentType,
        enabledSlugs: params.enabledSlugs,
      })
      .returning();
    return row;
  }
}
