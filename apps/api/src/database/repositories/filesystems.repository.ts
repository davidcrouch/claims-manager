import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { filesystems, filesystemCategories, documents } from '../schema';

export type FilesystemRow = typeof filesystems.$inferSelect;
export type FilesystemInsert = typeof filesystems.$inferInsert;
export type FilesystemCategoryRow = typeof filesystemCategories.$inferSelect;
export type FilesystemCategoryInsert = typeof filesystemCategories.$inferInsert;

@Injectable()
export class FilesystemsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByTenant(tenantId: string): Promise<FilesystemRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystems)
      .where(
        and(
          eq(filesystems.tenantId, tenantId),
          isNull(filesystems.archivedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(data: FilesystemInsert): Promise<FilesystemRow> {
    const [inserted] = await this.db
      .insert(filesystems)
      .values(data)
      .returning();
    return inserted;
  }

  async update(id: string, data: Partial<FilesystemInsert>): Promise<FilesystemRow | null> {
    const [updated] = await this.db
      .update(filesystems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(filesystems.id, id))
      .returning();
    return updated ?? null;
  }

  async addCategory(data: FilesystemCategoryInsert): Promise<FilesystemCategoryRow> {
    const [inserted] = await this.db
      .insert(filesystemCategories)
      .values(data)
      .returning();
    return inserted;
  }

  async findCategory(
    categoryId: string,
    filesystemId: string,
  ): Promise<FilesystemCategoryRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystemCategories)
      .where(
        and(
          eq(filesystemCategories.id, categoryId),
          eq(filesystemCategories.filesystemId, filesystemId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async updateCategory(
    id: string,
    data: Partial<FilesystemCategoryInsert>,
  ): Promise<FilesystemCategoryRow | null> {
    const [updated] = await this.db
      .update(filesystemCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(filesystemCategories.id, id))
      .returning();
    return updated ?? null;
  }

  async archiveCategory(id: string): Promise<void> {
    await this.db
      .update(filesystemCategories)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(filesystemCategories.id, id));
  }

  /**
   * Soft-archive a category after re-parenting children and reassigning documents.
   */
  async archiveCategoryWithReparent(params: {
    filesystemId: string;
    categoryId: string;
    parentCategoryId: string | null;
    tenantId: string;
  }): Promise<void> {
    const { filesystemId, categoryId, parentCategoryId, tenantId } = params;

    await this.db
      .update(filesystemCategories)
      .set({
        parentCategoryId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(filesystemCategories.parentCategoryId, categoryId),
          eq(filesystemCategories.filesystemId, filesystemId),
        ),
      );

    await this.db
      .update(documents)
      .set({
        filesystemCategoryId: parentCategoryId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.filesystemCategoryId, categoryId),
          eq(documents.tenantId, tenantId),
        ),
      );

    await this.db
      .update(filesystemCategories)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(filesystemCategories.id, categoryId));
  }

  async getCategoryTree(filesystemId: string): Promise<FilesystemCategoryRow[]> {
    return this.db
      .select()
      .from(filesystemCategories)
      .where(
        and(
          eq(filesystemCategories.filesystemId, filesystemId),
          isNull(filesystemCategories.archivedAt),
        ),
      )
      .orderBy(filesystemCategories.sortOrder);
  }

  async replaceCategories(
    filesystemId: string,
    categories: FilesystemCategoryInsert[],
  ): Promise<FilesystemCategoryRow[]> {
    await this.db
      .delete(filesystemCategories)
      .where(eq(filesystemCategories.filesystemId, filesystemId));

    if (categories.length === 0) return [];

    return this.db
      .insert(filesystemCategories)
      .values(categories)
      .returning();
  }
}
