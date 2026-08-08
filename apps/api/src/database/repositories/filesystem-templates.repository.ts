import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, isNull, desc, asc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import {
  filesystemTemplates,
  filesystemTemplateCategories,
  filesystemTemplatePipelines,
  filesystemTemplatePipelineSteps,
} from '../schema';

export type FilesystemTemplateRow = typeof filesystemTemplates.$inferSelect;
export type FilesystemTemplateInsert = typeof filesystemTemplates.$inferInsert;
export type FilesystemTemplateCategoryRow = typeof filesystemTemplateCategories.$inferSelect;
export type FilesystemTemplateCategoryInsert = typeof filesystemTemplateCategories.$inferInsert;
export type FilesystemTemplatePipelineRow = typeof filesystemTemplatePipelines.$inferSelect;
export type FilesystemTemplatePipelineStepRow = typeof filesystemTemplatePipelineSteps.$inferSelect;

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

  /** Platform company default (backward compatible). */
  async findPlatformDefault(): Promise<FilesystemTemplateRow | null> {
    return this.findPlatformDefaultByKind('company');
  }

  async findPlatformDefaultByKind(
    kind: 'company' | 'project',
  ): Promise<FilesystemTemplateRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystemTemplates)
      .where(
        and(
          isNull(filesystemTemplates.tenantId),
          eq(filesystemTemplates.kind, kind),
          eq(filesystemTemplates.isDefault, true),
          isNull(filesystemTemplates.archivedAt),
        ),
      )
      .limit(1);
    if (row) return row;

    // Fallback: first platform template of that kind
    const [fallback] = await this.db
      .select()
      .from(filesystemTemplates)
      .where(
        and(
          isNull(filesystemTemplates.tenantId),
          eq(filesystemTemplates.kind, kind),
          isNull(filesystemTemplates.archivedAt),
        ),
      )
      .limit(1);
    return fallback ?? null;
  }

  async findAllByKind(
    tenantId: string,
    kind: 'company' | 'project',
  ): Promise<FilesystemTemplateRow[]> {
    return this.db
      .select()
      .from(filesystemTemplates)
      .where(
        and(
          or(
            eq(filesystemTemplates.tenantId, tenantId),
            isNull(filesystemTemplates.tenantId),
          ),
          eq(filesystemTemplates.kind, kind),
          isNull(filesystemTemplates.archivedAt),
        ),
      )
      .orderBy(desc(filesystemTemplates.isDefault), desc(filesystemTemplates.updatedAt));
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

  async listPipelines(templateId: string): Promise<FilesystemTemplatePipelineRow[]> {
    return this.db
      .select()
      .from(filesystemTemplatePipelines)
      .where(eq(filesystemTemplatePipelines.templateId, templateId))
      .orderBy(asc(filesystemTemplatePipelines.sortOrder));
  }

  async listPipelineSteps(
    pipelineId: string,
  ): Promise<FilesystemTemplatePipelineStepRow[]> {
    return this.db
      .select()
      .from(filesystemTemplatePipelineSteps)
      .where(eq(filesystemTemplatePipelineSteps.pipelineId, pipelineId))
      .orderBy(asc(filesystemTemplatePipelineSteps.stepOrder));
  }

  async listPipelinesWithSteps(templateId: string): Promise<
    Array<FilesystemTemplatePipelineRow & { steps: FilesystemTemplatePipelineStepRow[] }>
  > {
    const pipelines = await this.listPipelines(templateId);
    const withSteps = await Promise.all(
      pipelines.map(async (pipeline) => ({
        ...pipeline,
        steps: await this.listPipelineSteps(pipeline.id),
      })),
    );
    return withSteps;
  }

  async createPipeline(data: {
    templateId: string;
    templateCategoryId?: string | null;
    name: string;
    description?: string | null;
    isActive?: boolean;
    triggerOn?: string;
    sortOrder?: number;
  }): Promise<FilesystemTemplatePipelineRow> {
    const [pipeline] = await this.db
      .insert(filesystemTemplatePipelines)
      .values({
        templateId: data.templateId,
        templateCategoryId: data.templateCategoryId ?? null,
        name: data.name,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        triggerOn: data.triggerOn ?? 'upload_complete',
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return pipeline;
  }

  async updatePipeline(
    pipelineId: string,
    templateId: string,
    data: Partial<{
      name: string;
      description: string | null;
      isActive: boolean;
      triggerOn: string;
      sortOrder: number;
      templateCategoryId: string | null;
    }>,
  ): Promise<FilesystemTemplatePipelineRow | null> {
    const [updated] = await this.db
      .update(filesystemTemplatePipelines)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(filesystemTemplatePipelines.id, pipelineId),
          eq(filesystemTemplatePipelines.templateId, templateId),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async deletePipeline(pipelineId: string, templateId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(filesystemTemplatePipelines)
      .where(
        and(
          eq(filesystemTemplatePipelines.id, pipelineId),
          eq(filesystemTemplatePipelines.templateId, templateId),
        ),
      )
      .returning({ id: filesystemTemplatePipelines.id });
    return deleted.length > 0;
  }

  async findPipeline(
    pipelineId: string,
    templateId: string,
  ): Promise<FilesystemTemplatePipelineRow | null> {
    const [row] = await this.db
      .select()
      .from(filesystemTemplatePipelines)
      .where(
        and(
          eq(filesystemTemplatePipelines.id, pipelineId),
          eq(filesystemTemplatePipelines.templateId, templateId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async replacePipelineSteps(
    pipelineId: string,
    steps: Array<{ agentId: string; stepOrder: number; config?: Record<string, unknown> }>,
  ): Promise<FilesystemTemplatePipelineStepRow[]> {
    await this.db
      .delete(filesystemTemplatePipelineSteps)
      .where(eq(filesystemTemplatePipelineSteps.pipelineId, pipelineId));

    if (steps.length === 0) return [];

    return this.db
      .insert(filesystemTemplatePipelineSteps)
      .values(
        steps.map((s) => ({
          pipelineId,
          agentId: s.agentId,
          stepOrder: s.stepOrder,
          config: s.config ?? {},
        })),
      )
      .returning();
  }
}
