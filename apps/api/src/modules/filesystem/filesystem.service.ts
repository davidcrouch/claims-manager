import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  ConflictException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { FilesystemsRepository } from '../../database/repositories/filesystems.repository';
import { FilesystemTemplatesRepository } from '../../database/repositories/filesystem-templates.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import {
  organizations,
  filesystemTemplatePipelines,
  filesystemTemplatePipelineSteps,
  documentPipelines,
  documentPipelineSteps,
} from '../../database/schema';
import { SetupFilesystemDto } from './dto/setup-filesystem.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReplaceCategoriesDto } from './dto/replace-categories.dto';
import { GenerateCategoryDescriptionDto } from './dto/generate-category-description.dto';
import type { ArtifactExportSettings } from './artifact-export.types';
import { SystemAgentRunner } from '../system-agents/system-agent-runner';
import { AgentRole } from '../system-agents/agent-roles';

const LOG = '[FilesystemService]';

@Injectable()
export class FilesystemService {
  private readonly logger = new Logger(FilesystemService.name);

  constructor(
    private readonly filesystemsRepo: FilesystemsRepository,
    private readonly templatesRepo: FilesystemTemplatesRepository,
    private readonly tenantContext: TenantContext,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional() private readonly agentRunner?: SystemAgentRunner,
  ) {}

  /**
   * Returns the tenant filesystem if it exists. Does not auto-create —
   * tenants must call setupFromTemplate / setupFromDefault first.
   */
  async getFilesystem() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.getFilesystem tenantId=${tenantId}`);

    const filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem) return null;

    const categories = await this.filesystemsRepo.getCategoryTree(filesystem.id);
    return { ...filesystem, categories };
  }

  async setupFromTemplate(dto: SetupFilesystemDto) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.setupFromTemplate templateId=${dto.templateId} tenantId=${tenantId}`);

    const template = await this.templatesRepo.findAccessible(dto.templateId, tenantId);
    if (!template) throw new NotFoundException('Template not found');

    return this.copyTemplateToTenantFilesystem({
      tenantId,
      templateId: template.id,
    });
  }

  async setupFromDefault() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.setupFromDefault tenantId=${tenantId}`);

    const template = await this.templatesRepo.findPlatformDefault();
    if (!template) {
      throw new NotFoundException('Platform default filesystem template not found');
    }

    return this.copyTemplateToTenantFilesystem({
      tenantId,
      templateId: template.id,
    });
  }

  private async copyTemplateToTenantFilesystem(params: {
    tenantId: string;
    templateId: string;
  }) {
    const { tenantId, templateId } = params;

    let filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem) {
      filesystem = await this.filesystemsRepo.create({ tenantId });
    }

    const existingCategories = await this.filesystemsRepo.getCategoryTree(filesystem.id);
    if (existingCategories.length > 0 || filesystem.sourceTemplateId) {
      throw new BadRequestException(
        'Filesystem is already set up; clear categories before re-applying a template',
      );
    }

    const templateCategories = await this.templatesRepo.getCategories(templateId);

    const idMap = new Map<string, string>();
    for (const cat of templateCategories) {
      idMap.set(cat.id, crypto.randomUUID());
    }

    const categoryInserts = templateCategories.map((cat) => ({
      id: idMap.get(cat.id)!,
      filesystemId: filesystem.id,
      parentCategoryId: cat.parentCategoryId
        ? idMap.get(cat.parentCategoryId) ?? null
        : null,
      displayName: cat.displayName,
      description: cat.description ?? null,
      slug: cat.slug,
      config: cat.config ?? {},
      sortOrder: cat.sortOrder,
    }));

    await this.filesystemsRepo.replaceCategories(filesystem.id, categoryInserts);

    // Copy template pipelines → org document pipelines
    const templatePipelines = await this.db
      .select()
      .from(filesystemTemplatePipelines)
      .where(eq(filesystemTemplatePipelines.templateId, templateId));

    const pipelineIdMap = new Map<string, string>();
    for (const tp of templatePipelines) {
      const targetCategoryId = tp.templateCategoryId
        ? idMap.get(tp.templateCategoryId) ?? null
        : null;

      const [inserted] = await this.db
        .insert(documentPipelines)
        .values({
          tenantId,
          filesystemId: filesystem.id,
          categoryId: targetCategoryId,
          name: tp.name,
          description: tp.description,
          isActive: tp.isActive,
          triggerOn: tp.triggerOn,
          sortOrder: tp.sortOrder,
        })
        .returning();

      pipelineIdMap.set(tp.id, inserted.id);
    }

    for (const [templatePipelineId, orgPipelineId] of pipelineIdMap) {
      const templateSteps = await this.db
        .select()
        .from(filesystemTemplatePipelineSteps)
        .where(eq(filesystemTemplatePipelineSteps.pipelineId, templatePipelineId))
        .orderBy(asc(filesystemTemplatePipelineSteps.stepOrder));

      if (templateSteps.length > 0) {
        await this.db.insert(documentPipelineSteps).values(
          templateSteps.map((s) => ({
            pipelineId: orgPipelineId,
            agentId: s.agentId,
            stepOrder: s.stepOrder,
            config: s.config ?? {},
          })),
        );
      }
    }

    await this.filesystemsRepo.update(filesystem.id, {
      sourceTemplateId: templateId,
      copiedAt: new Date(),
    });

    this.logger.log(
      `${LOG}.copyTemplateToTenantFilesystem fs=${filesystem.id} cats=${templateCategories.length} pipelines=${templatePipelines.length}`,
    );

    const updatedFs = await this.filesystemsRepo.findByTenant(tenantId);
    const categories = await this.filesystemsRepo.getCategoryTree(filesystem.id);
    return { ...updatedFs, categories };
  }

  async updateFilesystem(id: string, data: { name?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem || filesystem.id !== id) throw new NotFoundException('Filesystem not found');

    return this.filesystemsRepo.update(id, {
      ...(data.name !== undefined && { name: data.name }),
    });
  }

  async replaceCategories(filesystemId: string, dto: ReplaceCategoriesDto) {
    const tenantId = this.tenantContext.getTenantId();
    const filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem || filesystem.id !== filesystemId) throw new NotFoundException('Filesystem not found');

    this.logger.debug(`${LOG}.replaceCategories filesystemId=${filesystemId} count=${dto.categories.length}`);

    const categoryInserts = dto.categories.map((cat) => ({
      id: cat.id ?? crypto.randomUUID(),
      filesystemId,
      parentCategoryId: cat.parentCategoryId ?? null,
      displayName: cat.displayName,
      description: cat.description ?? null,
      slug: cat.slug,
      config: cat.config ?? {},
      sortOrder: cat.sortOrder ?? 0,
    }));

    return this.filesystemsRepo.replaceCategories(filesystemId, categoryInserts);
  }

  async addCategory(filesystemId: string, dto: CreateCategoryDto) {
    const tenantId = this.tenantContext.getTenantId();
    const filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem || filesystem.id !== filesystemId) throw new NotFoundException('Filesystem not found');

    this.logger.debug(`${LOG}.addCategory filesystemId=${filesystemId} displayName="${dto.displayName}"`);

    return this.filesystemsRepo.addCategory({
      filesystemId,
      parentCategoryId: dto.parentCategoryId ?? null,
      displayName: dto.displayName,
      description: dto.description ?? null,
      slug: dto.slug,
      config: dto.config ?? {},
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateCategory(filesystemId: string, categoryId: string, dto: UpdateCategoryDto) {
    const tenantId = this.tenantContext.getTenantId();
    const filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem || filesystem.id !== filesystemId) throw new NotFoundException('Filesystem not found');

    const updated = await this.filesystemsRepo.updateCategory(categoryId, {
      ...(dto.displayName !== undefined && { displayName: dto.displayName }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.config !== undefined && { config: dto.config }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.parentCategoryId !== undefined && { parentCategoryId: dto.parentCategoryId }),
    });
    if (!updated) throw new NotFoundException('Category not found');
    return updated;
  }

  async archiveCategory(filesystemId: string, categoryId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem || filesystem.id !== filesystemId) throw new NotFoundException('Filesystem not found');

    const cat = await this.filesystemsRepo.findCategory(categoryId, filesystemId);
    if (!cat) throw new NotFoundException('Category not found');

    await this.filesystemsRepo.archiveCategoryWithReparent({
      filesystemId,
      categoryId,
      parentCategoryId: cat.parentCategoryId,
      tenantId,
    });

    this.logger.log(`${LOG}.archiveCategory categoryId=${categoryId}`);
    return { archived: true };
  }

  async generateCategoryDescription(dto: GenerateCategoryDescriptionDto) {
    if (!this.agentRunner?.isEnabled()) {
      throw new ServiceUnavailableException(
        'AI description generation requires GCP_PROJECT_ID (local/dev uses ADC via gcloud auth application-default login)',
      );
    }

    const tenantId = this.tenantContext.getTenantId();
    const siblingList = dto.siblingCategories
      .map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ''}`)
      .join('\n');

    const prompt =
      `Write a filing description for the document category "${dto.categoryName}" ` +
      `in a construction/insurance claims document filesystem.\n\n` +
      `Sibling categories for context:\n${siblingList || '(none)'}\n\n` +
      `Include what belongs here and what should NOT be filed here. Return only the description.`;

    const result = await this.agentRunner.run(
      tenantId,
      AgentRole.CATEGORY_DESCRIPTION_GEN,
      { tenantId },
      { prompt },
    );

    return { description: result.text.trim() };
  }

  async getArtifactExportSettings(): Promise<ArtifactExportSettings> {
    const tenantId = this.tenantContext.getTenantId();
    const [row] = await this.db
      .select({ config: organizations.config })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    const config = (row?.config ?? {}) as Record<string, unknown>;
    const filesystem = (config.filesystem ?? {}) as Record<string, unknown>;
    return (filesystem.artifactExport ?? {}) as ArtifactExportSettings;
  }

  async updateArtifactExportSettings(
    input: ArtifactExportSettings,
  ): Promise<ArtifactExportSettings> {
    const tenantId = this.tenantContext.getTenantId();
    const fs = await this.filesystemsRepo.findByTenant(tenantId);
    if (!fs) {
      throw new ConflictException(`${LOG}.updateArtifactExportSettings: no filesystem`);
    }

    if (input.defaultCategoryId) {
      await this.assertActiveCategory(fs.id, input.defaultCategoryId);
    }
    for (const categoryId of Object.values(input.categoryByContentType ?? {})) {
      if (categoryId) await this.assertActiveCategory(fs.id, categoryId);
    }

    const [row] = await this.db
      .select({ config: organizations.config })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    const config = (row?.config ?? {}) as Record<string, unknown>;
    const filesystem = (config.filesystem ?? {}) as Record<string, unknown>;
    const nextConfig = {
      ...config,
      filesystem: {
        ...filesystem,
        artifactExport: input,
      },
    };

    await this.db
      .update(organizations)
      .set({ config: nextConfig })
      .where(eq(organizations.id, tenantId));

    return input;
  }

  private async assertActiveCategory(filesystemId: string, categoryId: string) {
    const cat = await this.filesystemsRepo.findCategory(categoryId, filesystemId);
    if (!cat || cat.archivedAt) {
      throw new BadRequestException(`Invalid category id: ${categoryId}`);
    }
  }
}
