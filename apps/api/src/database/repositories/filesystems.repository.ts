import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, inArray, ilike } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import {
  filesystems,
  filesystemCategories,
  documents,
  type FilesystemKind,
} from '../schema';

export type FilesystemRow = typeof filesystems.$inferSelect;
export type FilesystemInsert = typeof filesystems.$inferInsert;
export type FilesystemCategoryRow = typeof filesystemCategories.$inferSelect;
export type FilesystemCategoryInsert = typeof filesystemCategories.$inferInsert;

@Injectable()
export class FilesystemsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** @deprecated Prefer findCompanyByTenant — returns the company filesystem. */
  async findByTenant(tenantId: string): Promise<FilesystemRow | null> {
    return this.findCompanyByTenant(tenantId);
  }

  async findCompanyByTenant(tenantId: string): Promise<FilesystemRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystems)
      .where(
        and(
          eq(filesystems.tenantId, tenantId),
          eq(filesystems.kind, 'company'),
          isNull(filesystems.archivedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByJob(tenantId: string, jobId: string): Promise<FilesystemRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystems)
      .where(
        and(
          eq(filesystems.tenantId, tenantId),
          eq(filesystems.kind, 'project'),
          eq(filesystems.jobId, jobId),
          isNull(filesystems.archivedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findById(tenantId: string, filesystemId: string): Promise<FilesystemRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystems)
      .where(
        and(
          eq(filesystems.id, filesystemId),
          eq(filesystems.tenantId, tenantId),
          isNull(filesystems.archivedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listProjectFilesystems(tenantId: string): Promise<FilesystemRow[]> {
    return this.db
      .select()
      .from(filesystems)
      .where(
        and(
          eq(filesystems.tenantId, tenantId),
          eq(filesystems.kind, 'project'),
          isNull(filesystems.archivedAt),
        ),
      );
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

  async findCategoryById(categoryId: string): Promise<FilesystemCategoryRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystemCategories)
      .where(eq(filesystemCategories.id, categoryId))
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

  async getCategoryTrees(filesystemIds: string[]): Promise<FilesystemCategoryRow[]> {
    if (filesystemIds.length === 0) return [];
    return this.db
      .select()
      .from(filesystemCategories)
      .where(
        and(
          inArray(filesystemCategories.filesystemId, filesystemIds),
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

  /**
   * Search categories by display name across all non-archived filesystems for a tenant.
   * Returns matching categories plus all ancestor categories needed to render the tree.
   */
  async searchCategories(
    tenantId: string,
    query: string,
  ): Promise<{
    matches: FilesystemCategoryRow[];
    ancestors: FilesystemCategoryRow[];
    filesystemIds: string[];
  }> {
    const tenantFilesystems = await this.db
      .select({ id: filesystems.id })
      .from(filesystems)
      .where(
        and(eq(filesystems.tenantId, tenantId), isNull(filesystems.archivedAt)),
      );
    const fsIds = tenantFilesystems.map((f) => f.id);
    if (fsIds.length === 0) return { matches: [], ancestors: [], filesystemIds: [] };

    const matches = await this.db
      .select()
      .from(filesystemCategories)
      .where(
        and(
          inArray(filesystemCategories.filesystemId, fsIds),
          isNull(filesystemCategories.archivedAt),
          ilike(filesystemCategories.displayName, `%${query}%`),
        ),
      )
      .orderBy(filesystemCategories.sortOrder);

    if (matches.length === 0) return { matches: [], ancestors: [], filesystemIds: [] };

    const matchedFsIds = [...new Set(matches.map((m) => m.filesystemId))];

    const allCategories = await this.db
      .select()
      .from(filesystemCategories)
      .where(
        and(
          inArray(filesystemCategories.filesystemId, matchedFsIds),
          isNull(filesystemCategories.archivedAt),
        ),
      )
      .orderBy(filesystemCategories.sortOrder);

    const matchIds = new Set(matches.map((m) => m.id));
    const byId = new Map(allCategories.map((c) => [c.id, c]));
    const ancestorIds = new Set<string>();

    for (const match of matches) {
      let parentId = match.parentCategoryId;
      while (parentId && !ancestorIds.has(parentId) && !matchIds.has(parentId)) {
        ancestorIds.add(parentId);
        parentId = byId.get(parentId)?.parentCategoryId ?? null;
      }
    }

    const ancestors = allCategories.filter(
      (c) => ancestorIds.has(c.id) && !matchIds.has(c.id),
    );

    return { matches, ancestors, filesystemIds: matchedFsIds };
  }

  async createTyped(params: {
    tenantId: string;
    kind: FilesystemKind;
    jobId?: string | null;
    name?: string;
    sourceTemplateId?: string | null;
  }): Promise<FilesystemRow> {
    return this.create({
      tenantId: params.tenantId,
      kind: params.kind,
      jobId: params.kind === 'project' ? (params.jobId ?? null) : null,
      name: params.name ?? (params.kind === 'company' ? 'Company Documents' : 'Project Documents'),
      sourceTemplateId: params.sourceTemplateId ?? null,
    });
  }
}
