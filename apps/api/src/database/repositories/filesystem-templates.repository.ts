import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, isNull, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { filesystemTemplates, filesystemTemplateCategories } from '../schema';

export type FilesystemTemplateRow = typeof filesystemTemplates.$inferSelect;
export type FilesystemTemplateInsert = typeof filesystemTemplates.$inferInsert;
export type FilesystemTemplateCategoryRow = typeof filesystemTemplateCategories.$inferSelect;
export type FilesystemTemplateCategoryInsert = typeof filesystemTemplateCategories.$inferInsert;

@Injectable()
export class FilesystemTemplatesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Tenant-owned templates plus platform templates (tenant_id IS NULL). */
  async findAll(tenantId: string): Promise<FilesystemTemplateRow[]> {
    return this.db
      .select()
      .from(filesystemTemplates)
      .where(
        and(
          or(
            eq(filesystemTemplates.tenantId, tenantId),
            isNull(filesystemTemplates.tenantId),
          ),
          isNull(filesystemTemplates.archivedAt),
        ),
      )
      .orderBy(desc(filesystemTemplates.isDefault), desc(filesystemTemplates.updatedAt));
  }

  /** Resolve a template owned by the tenant or a platform template. */
  async findAccessible(id: string, tenantId: string): Promise<FilesystemTemplateRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystemTemplates)
      .where(
        and(
          eq(filesystemTemplates.id, id),
          or(
            eq(filesystemTemplates.tenantId, tenantId),
            isNull(filesystemTemplates.tenantId),
          ),
          isNull(filesystemTemplates.archivedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Tenant-owned template only (mutations). */
  async findOne(id: string, tenantId: string): Promise<FilesystemTemplateRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystemTemplates)
      .where(
        and(
          eq(filesystemTemplates.id, id),
          eq(filesystemTemplates.tenantId, tenantId),
          isNull(filesystemTemplates.archivedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findPlatformDefault(): Promise<FilesystemTemplateRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystemTemplates)
      .where(
        and(
          isNull(filesystemTemplates.tenantId),
          eq(filesystemTemplates.isDefault, true),
          isNull(filesystemTemplates.archivedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(data: FilesystemTemplateInsert): Promise<FilesystemTemplateRow> {
    const [inserted] = await this.db
      .insert(filesystemTemplates)
      .values(data)
      .returning();
    return inserted;
  }

  async update(id: string, tenantId: string, data: Partial<FilesystemTemplateInsert>): Promise<FilesystemTemplateRow | null> {
    const [updated] = await this.db
      .update(filesystemTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(filesystemTemplates.id, id), eq(filesystemTemplates.tenantId, tenantId)))
      .returning();
    return updated ?? null;
  }

  async archive(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(filesystemTemplates)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(filesystemTemplates.id, id), eq(filesystemTemplates.tenantId, tenantId)));
  }

  async getCategories(templateId: string): Promise<FilesystemTemplateCategoryRow[]> {
    return this.db
      .select()
      .from(filesystemTemplateCategories)
      .where(eq(filesystemTemplateCategories.templateId, templateId))
      .orderBy(filesystemTemplateCategories.sortOrder);
  }

  async replaceCategories(templateId: string, categories: FilesystemTemplateCategoryInsert[]): Promise<FilesystemTemplateCategoryRow[]> {
    await this.db
      .delete(filesystemTemplateCategories)
      .where(eq(filesystemTemplateCategories.templateId, templateId));

    if (categories.length === 0) return [];

    return this.db
      .insert(filesystemTemplateCategories)
      .values(categories)
      .returning();
  }
}
