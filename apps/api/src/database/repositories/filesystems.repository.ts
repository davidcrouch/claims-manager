import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { filesystems, filesystemCategories } from '../schema';

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

  async updateCategory(id: string, data: Partial<FilesystemCategoryInsert>): Promise<FilesystemCategoryRow | null> {
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

  async replaceCategories(filesystemId: string, categories: FilesystemCategoryInsert[]): Promise<FilesystemCategoryRow[]> {
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
