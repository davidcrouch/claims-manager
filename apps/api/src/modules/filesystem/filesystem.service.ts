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
import {
  asc,
  eq,
  and,
  isNull,
  notInArray,
  inArray,
  ilike,
  or,
  sql,
} from 'drizzle-orm';
import { FilesystemsRepository } from '../../database/repositories/filesystems.repository';
import { FilesystemTemplatesRepository } from '../../database/repositories/filesystem-templates.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import {
  organizations,
  filesystems,
  filesystemTemplatePipelines,
  filesystemTemplatePipelineSteps,
  documentPipelines,
  documentPipelineSteps,
  jobs,
  type FilesystemKind,
} from '../../database/schema';
import { SetupFilesystemDto } from './dto/setup-filesystem.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReplaceCategoriesDto } from './dto/replace-categories.dto';
import { GenerateCategoryDescriptionDto } from './dto/generate-category-description.dto';
import type { ArtifactExportSettings, ArtifactExportScope, UpdateArtifactExportSettingsDto } from './artifact-export.types';
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

  /** Company filesystem (deprecated alias for getCompanyFilesystem). */
  async getFilesystem() {
    return this.getCompanyFilesystem();
  }

  async getCompanyFilesystem() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.getCompanyFilesystem tenantId=${tenantId}`);

    const filesystem = await this.filesystemsRepo.findCompanyByTenant(tenantId);
    if (!filesystem) return null;

    const categories = await this.filesystemsRepo.getCategoryTree(filesystem.id);
    return { ...filesystem, categories };
  }

  async getJobFilesystem(jobId: string, options?: { ensure?: boolean }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.getJobFilesystem jobId=${jobId} tenantId=${tenantId}`);

    await this.assertJobBelongsToTenant(tenantId, jobId);

    let filesystem = await this.filesystemsRepo.findByJob(tenantId, jobId);
    if (!filesystem && options?.ensure !== false) {
      filesystem = await this.ensureProjectFilesystemForJob(tenantId, jobId);
    }
    if (!filesystem) {
      throw new NotFoundException('Project filesystem not found for job');
    }

    const categories = await this.filesystemsRepo.getCategoryTree(filesystem.id);
    return { ...filesystem, categories };
  }

  async searchCategories(query: string) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.searchCategories tenantId=${tenantId} query="${query}"`);
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return { matches: [], ancestors: [], filesystems: [], projects: [] };
    }

    const pattern = `%${trimmedQuery}%`;
    const [result, matchingJobs, tenantFilesystems] = await Promise.all([
      this.filesystemsRepo.searchCategories(tenantId, trimmedQuery),
      this.db
        .select({
          id: jobs.id,
          name: jobs.name,
          externalJobId: jobs.externalJobId,
          externalReference: jobs.externalReference,
        })
        .from(jobs)
        .where(
          and(
            eq(jobs.tenantId, tenantId),
            isNull(jobs.deletedAt),
            or(
              ilike(jobs.name, pattern),
              ilike(jobs.externalJobId, pattern),
              ilike(jobs.externalReference, pattern),
            ),
          ),
        ),
      this.db
        .select({
          id: filesystems.id,
          kind: filesystems.kind,
          jobId: filesystems.jobId,
          name: filesystems.name,
          tenantId: filesystems.tenantId,
          sourceTemplateId: filesystems.sourceTemplateId,
          copiedAt: filesystems.copiedAt,
          archivedAt: filesystems.archivedAt,
          createdAt: filesystems.createdAt,
          updatedAt: filesystems.updatedAt,
        })
        .from(filesystems)
        .where(
          and(
            eq(filesystems.tenantId, tenantId),
            isNull(filesystems.archivedAt),
          ),
        ),
    ]);

    const jobLabel = (job: (typeof matchingJobs)[number]) =>
      job.name?.trim() ||
      job.externalJobId?.trim() ||
      job.externalReference?.trim() ||
      `Job ${job.id.slice(0, 8)}`;

    const filesystemByJobId = new Map(
      tenantFilesystems
        .filter((filesystem) => filesystem.jobId)
        .map((filesystem) => [filesystem.jobId!, filesystem]),
    );
    const categoryFilesystemIds = new Set(result.filesystemIds);
    const categoryFilesystems = tenantFilesystems.filter((filesystem) =>
      categoryFilesystemIds.has(filesystem.id),
    );
    const categoryJobIds = categoryFilesystems
      .map((filesystem) => filesystem.jobId)
      .filter(Boolean) as string[];
    const matchingJobById = new Map(matchingJobs.map((job) => [job.id, job]));
    const missingCategoryJobIds = categoryJobIds.filter(
      (jobId) => !matchingJobById.has(jobId),
    );

    if (missingCategoryJobIds.length > 0) {
      const categoryJobs = await this.db
        .select({
          id: jobs.id,
          name: jobs.name,
          externalJobId: jobs.externalJobId,
          externalReference: jobs.externalReference,
        })
        .from(jobs)
        .where(inArray(jobs.id, missingCategoryJobIds));
      for (const job of categoryJobs) matchingJobById.set(job.id, job);
    }

    const filesystemMeta: Array<{
      id: string;
      kind: string;
      jobId: string | null;
      jobLabel: string | null;
    }> = categoryFilesystems.map((filesystem) => ({
      id: filesystem.id,
      kind: filesystem.kind,
      jobId: filesystem.jobId,
      jobLabel: filesystem.jobId
        ? jobLabel(matchingJobById.get(filesystem.jobId)!)
        : null,
    }));

    const projects = matchingJobs.map((job) => {
      const filesystem = filesystemByJobId.get(job.id);
      return {
        jobId: job.id,
        jobLabel: jobLabel(job),
        filesystem: filesystem ? { ...filesystem, categories: [] } : null,
      };
    });

    return {
      matches: result.matches,
      ancestors: result.ancestors,
      filesystems: filesystemMeta,
      projects,
    };
  }

  async getOverview() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.getOverview tenantId=${tenantId}`);

    const company = await this.getCompanyFilesystem();

    // Job nodes are preloaded; category trees are fetched on expand (avoids N+1).
    const jobRows = await this.db
      .select({
        id: jobs.id,
        name: jobs.name,
        externalJobId: jobs.externalJobId,
        externalReference: jobs.externalReference,
      })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)));

    const projectRows = await this.filesystemsRepo.listProjectFilesystems(tenantId);
    const fsByJobId = new Map<string, (typeof projectRows)[number]>();
    for (const fs of projectRows) {
      if (fs.jobId) fsByJobId.set(fs.jobId, fs);
    }

    type EmptyCategories = Awaited<ReturnType<FilesystemsRepository['getCategoryTree']>>;
    const projects = jobRows.map((j) => {
      const fs = fsByJobId.get(j.id);
      // Match frontend jobDisplayName: name → externalJobId → externalReference → short id
      // (externalReference is often the upstream UUID; externalJobId is the human job number.)
      return {
        jobId: j.id,
        jobLabel:
          j.name?.trim() ||
          j.externalJobId?.trim() ||
          j.externalReference?.trim() ||
          `Job ${j.id.slice(0, 8)}`,
        filesystem: fs
          ? { ...fs, categories: [] as EmptyCategories }
          : null,
      };
    });

    projects.sort((a, b) => a.jobLabel.localeCompare(b.jobLabel));

    this.logger.debug(
      `${LOG}.getOverview projects=${projects.length} withFilesystem=${fsByJobId.size}`,
    );

    return { company, projects };
  }

  async setupFromTemplate(dto: SetupFilesystemDto) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.setupFromTemplate templateId=${dto.templateId} tenantId=${tenantId}`);

    return this.instantiateFromTemplate({
      tenantId,
      templateId: dto.templateId,
      kind: 'company',
    });
  }

  async setupFromDefault() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.setupFromDefault tenantId=${tenantId}`);

    const template = await this.templatesRepo.findPlatformDefaultByKind('company');
    if (!template) {
      throw new NotFoundException('Platform default company filesystem template not found');
    }

    return this.instantiateFromTemplate({
      tenantId,
      templateId: template.id,
      kind: 'company',
    });
  }

  async setupJobFilesystem(jobId: string, templateId?: string) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `${LOG}.setupJobFilesystem jobId=${jobId} templateId=${templateId ?? 'default'} tenantId=${tenantId}`,
    );

    await this.assertJobBelongsToTenant(tenantId, jobId);

    const existing = await this.filesystemsRepo.findByJob(tenantId, jobId);
    if (existing) {
      const categories = await this.filesystemsRepo.getCategoryTree(existing.id);
      return { ...existing, categories };
    }

    const resolvedTemplateId =
      templateId ?? (await this.resolveDefaultProjectTemplateId(tenantId));

    return this.instantiateFromTemplate({
      tenantId,
      templateId: resolvedTemplateId,
      kind: 'project',
      jobId,
    });
  }

  /**
   * Idempotent project FS create for job create / webhook / lazy Documents open.
   */
  async ensureProjectFilesystemForJob(
    tenantId: string,
    jobId: string,
    templateId?: string,
  ) {
    const existing = await this.filesystemsRepo.findByJob(tenantId, jobId);
    if (existing) return existing;

    try {
      const resolvedTemplateId =
        templateId ?? (await this.resolveDefaultProjectTemplateId(tenantId));
      await this.instantiateFromTemplate({
        tenantId,
        templateId: resolvedTemplateId,
        kind: 'project',
        jobId,
      });
      return (await this.filesystemsRepo.findByJob(tenantId, jobId))!;
    } catch (err) {
      const raced = await this.filesystemsRepo.findByJob(tenantId, jobId);
      if (raced) return raced;
      throw err;
    }
  }

  async backfillMissingProjectFilesystems() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(`${LOG}.backfillMissingProjectFilesystems tenantId=${tenantId}`);

    const existing = await this.filesystemsRepo.listProjectFilesystems(tenantId);
    const haveJobIds = existing
      .map((f) => f.jobId)
      .filter((id): id is string => Boolean(id));

    const missingJobs = await this.db
      .select({ id: jobs.id, name: jobs.name })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          isNull(jobs.deletedAt),
          haveJobIds.length > 0 ? notInArray(jobs.id, haveJobIds) : sql`true`,
        ),
      );

    let created = 0;
    const errors: Array<{ jobId: string; error: string }> = [];

    for (const job of missingJobs) {
      try {
        await this.ensureProjectFilesystemForJob(tenantId, job.id);
        created += 1;
      } catch (err) {
        errors.push({
          jobId: job.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log(
      `${LOG}.backfillMissingProjectFilesystems created=${created} missing=${missingJobs.length} errors=${errors.length}`,
    );
    return { scanned: missingJobs.length, created, errors };
  }

  async getFilesystemDefaults() {
    const tenantId = this.tenantContext.getTenantId();
    const [org] = await this.db
      .select({
        defaultCompanyFilesystemTemplateId: organizations.defaultCompanyFilesystemTemplateId,
        defaultProjectFilesystemTemplateId: organizations.defaultProjectFilesystemTemplateId,
      })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    return {
      defaultCompanyTemplateId: org?.defaultCompanyFilesystemTemplateId ?? null,
      defaultProjectTemplateId: org?.defaultProjectFilesystemTemplateId ?? null,
    };
  }

  async updateFilesystemDefaults(input: {
    defaultCompanyTemplateId?: string | null;
    defaultProjectTemplateId?: string | null;
  }) {
    const tenantId = this.tenantContext.getTenantId();

    if (input.defaultCompanyTemplateId) {
      const t = await this.templatesRepo.findAccessible(input.defaultCompanyTemplateId, tenantId);
      if (!t || t.kind !== 'company') {
        throw new BadRequestException('defaultCompanyTemplateId must be a company template');
      }
    }
    if (input.defaultProjectTemplateId) {
      const t = await this.templatesRepo.findAccessible(input.defaultProjectTemplateId, tenantId);
      if (!t || t.kind !== 'project') {
        throw new BadRequestException('defaultProjectTemplateId must be a project template');
      }
    }

    const patch: Partial<typeof organizations.$inferInsert> = {};
    if (input.defaultCompanyTemplateId !== undefined) {
      patch.defaultCompanyFilesystemTemplateId = input.defaultCompanyTemplateId;
    }
    if (input.defaultProjectTemplateId !== undefined) {
      patch.defaultProjectFilesystemTemplateId = input.defaultProjectTemplateId;
    }

    await this.db.update(organizations).set(patch).where(eq(organizations.id, tenantId));
    return this.getFilesystemDefaults();
  }

  /**
   * Used by provisioning: set org defaults and instantiate company FS.
   */
  async provisionCompanyFilesystem(params: {
    companyTemplateId?: string;
    defaultProjectTemplateId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `${LOG}.provisionCompanyFilesystem tenantId=${tenantId} company=${params.companyTemplateId ?? 'default'} projectDefault=${params.defaultProjectTemplateId ?? 'default'}`,
    );

    const companyTemplate =
      (params.companyTemplateId
        ? await this.templatesRepo.findAccessible(params.companyTemplateId, tenantId)
        : null) ?? (await this.templatesRepo.findPlatformDefaultByKind('company'));

    if (!companyTemplate || companyTemplate.kind !== 'company') {
      throw new NotFoundException('Company filesystem template not found');
    }

    const projectTemplate =
      (params.defaultProjectTemplateId
        ? await this.templatesRepo.findAccessible(params.defaultProjectTemplateId, tenantId)
        : null) ?? (await this.templatesRepo.findPlatformDefaultByKind('project'));

    if (!projectTemplate || projectTemplate.kind !== 'project') {
      throw new NotFoundException('Project filesystem template not found');
    }

    await this.updateFilesystemDefaults({
      defaultCompanyTemplateId: companyTemplate.id,
      defaultProjectTemplateId: projectTemplate.id,
    });

    const existing = await this.filesystemsRepo.findCompanyByTenant(tenantId);
    if (existing) {
      const categories = await this.filesystemsRepo.getCategoryTree(existing.id);
      if (categories.length > 0 || existing.sourceTemplateId) {
        this.logger.log(`${LOG}.provisionCompanyFilesystem already set up — skipping instantiate`);
        return { ...existing, categories };
      }
    }

    return this.instantiateFromTemplate({
      tenantId,
      templateId: companyTemplate.id,
      kind: 'company',
    });
  }

  async instantiateFromTemplate(params: {
    tenantId: string;
    templateId: string;
    kind: FilesystemKind;
    jobId?: string;
    name?: string;
  }) {
    const { tenantId, templateId, kind, jobId, name } = params;

    const template = await this.templatesRepo.findAccessible(templateId, tenantId);
    if (!template) throw new NotFoundException('Template not found');
    if (template.kind !== kind) {
      throw new BadRequestException(
        `Template kind "${template.kind}" does not match requested kind "${kind}"`,
      );
    }

    if (kind === 'project') {
      if (!jobId) throw new BadRequestException('jobId is required for project filesystems');
      await this.assertJobBelongsToTenant(tenantId, jobId);
      const existingProject = await this.filesystemsRepo.findByJob(tenantId, jobId);
      if (existingProject) {
        throw new BadRequestException('Project filesystem already exists for this job');
      }
    }

    let filesystem =
      kind === 'company'
        ? await this.filesystemsRepo.findCompanyByTenant(tenantId)
        : null;

    if (kind === 'company' && filesystem) {
      const existingCategories = await this.filesystemsRepo.getCategoryTree(filesystem.id);
      if (existingCategories.length > 0 || filesystem.sourceTemplateId) {
        throw new BadRequestException(
          'Filesystem is already set up; clear categories before re-applying a template',
        );
      }
    } else {
      filesystem = await this.filesystemsRepo.createTyped({
        tenantId,
        kind,
        jobId: jobId ?? null,
        name:
          name ??
          (kind === 'company' ? 'Company Documents' : 'Project Documents'),
      });
    }

    const templateCategories = await this.templatesRepo.getCategories(templateId);

    const idMap = new Map<string, string>();
    for (const cat of templateCategories) {
      idMap.set(cat.id, crypto.randomUUID());
    }

    const categoryInserts = templateCategories.map((cat) => ({
      id: idMap.get(cat.id)!,
      filesystemId: filesystem!.id,
      parentCategoryId: cat.parentCategoryId
        ? (idMap.get(cat.parentCategoryId) ?? null)
        : null,
      displayName: cat.displayName,
      description: cat.description ?? null,
      slug: cat.slug,
      config: cat.config ?? {},
      sortOrder: cat.sortOrder,
    }));

    await this.filesystemsRepo.replaceCategories(filesystem.id, categoryInserts);

    const templatePipelines = await this.db
      .select()
      .from(filesystemTemplatePipelines)
      .where(eq(filesystemTemplatePipelines.templateId, templateId));

    const pipelineIdMap = new Map<string, string>();
    for (const tp of templatePipelines) {
      const targetCategoryId = tp.templateCategoryId
        ? (idMap.get(tp.templateCategoryId) ?? null)
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
      `${LOG}.instantiateFromTemplate fs=${filesystem.id} kind=${kind} jobId=${jobId ?? 'n/a'} cats=${templateCategories.length} pipelines=${templatePipelines.length}`,
    );

    const categories = await this.filesystemsRepo.getCategoryTree(filesystem.id);
    const updated =
      kind === 'company'
        ? await this.filesystemsRepo.findCompanyByTenant(tenantId)
        : await this.filesystemsRepo.findByJob(tenantId, jobId!);

    return { ...updated!, categories };
  }

  async updateFilesystem(id: string, data: { name?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const filesystem = await this.filesystemsRepo.findById(tenantId, id);
    if (!filesystem) throw new NotFoundException('Filesystem not found');

    return this.filesystemsRepo.update(id, {
      ...(data.name !== undefined && { name: data.name }),
    });
  }

  async replaceCategories(filesystemId: string, dto: ReplaceCategoriesDto) {
    const tenantId = this.tenantContext.getTenantId();
    const filesystem = await this.filesystemsRepo.findById(tenantId, filesystemId);
    if (!filesystem) throw new NotFoundException('Filesystem not found');

    this.logger.debug(
      `${LOG}.replaceCategories filesystemId=${filesystemId} count=${dto.categories.length}`,
    );

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
    const filesystem = await this.filesystemsRepo.findById(tenantId, filesystemId);
    if (!filesystem) throw new NotFoundException('Filesystem not found');

    this.logger.debug(
      `${LOG}.addCategory filesystemId=${filesystemId} displayName="${dto.displayName}"`,
    );

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
    const filesystem = await this.filesystemsRepo.findById(tenantId, filesystemId);
    if (!filesystem) throw new NotFoundException('Filesystem not found');

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
    const filesystem = await this.filesystemsRepo.findById(tenantId, filesystemId);
    if (!filesystem) throw new NotFoundException('Filesystem not found');

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

  async getArtifactExportSettings(
    scope: ArtifactExportScope = 'company',
  ): Promise<ArtifactExportSettings> {
    const tenantId = this.tenantContext.getTenantId();
    const [row] = await this.db
      .select({ config: organizations.config })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    const config = (row?.config ?? {}) as Record<string, unknown>;
    const filesystem = (config.filesystem ?? {}) as Record<string, unknown>;
    const key = scope === 'project' ? 'projectArtifactExport' : 'artifactExport';
    return (filesystem[key] ?? {}) as ArtifactExportSettings;
  }

  async updateArtifactExportSettings(
    input: UpdateArtifactExportSettingsDto,
  ): Promise<ArtifactExportSettings> {
    const tenantId = this.tenantContext.getTenantId();
    const scope: ArtifactExportScope = input.scope ?? 'company';
    const settings: ArtifactExportSettings = {
      defaultCategoryId: input.defaultCategoryId,
      categoryByContentType: input.categoryByContentType,
      fileNameTemplate: input.fileNameTemplate,
    };

    if (scope === 'company') {
      const fs = await this.filesystemsRepo.findCompanyByTenant(tenantId);
      if (!fs) {
        throw new ConflictException(`${LOG}.updateArtifactExportSettings: no company filesystem`);
      }

      if (settings.defaultCategoryId) {
        await this.assertActiveCategory(fs.id, settings.defaultCategoryId);
      }
      for (const categoryId of Object.values(settings.categoryByContentType ?? {})) {
        if (categoryId) await this.assertActiveCategory(fs.id, categoryId);
      }
    } else {
      const templateId =
        input.templateId ?? (await this.resolveDefaultProjectTemplateId(tenantId));
      const template = await this.templatesRepo.findAccessible(templateId, tenantId);
      if (!template || template.kind !== 'project') {
        throw new BadRequestException(
          `${LOG}.updateArtifactExportSettings: project template not found`,
        );
      }
      const categories = await this.templatesRepo.getCategories(template.id);
      const slugs = new Set(categories.map((c) => c.slug));
      if (settings.defaultCategoryId && !slugs.has(settings.defaultCategoryId)) {
        throw new BadRequestException(
          `Invalid project category slug: ${settings.defaultCategoryId}`,
        );
      }
      for (const slug of Object.values(settings.categoryByContentType ?? {})) {
        if (slug && !slugs.has(slug)) {
          throw new BadRequestException(`Invalid project category slug: ${slug}`);
        }
      }
    }

    const [row] = await this.db
      .select({ config: organizations.config })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    const config = (row?.config ?? {}) as Record<string, unknown>;
    const filesystem = (config.filesystem ?? {}) as Record<string, unknown>;
    const key = scope === 'project' ? 'projectArtifactExport' : 'artifactExport';
    const nextConfig = {
      ...config,
      filesystem: {
        ...filesystem,
        [key]: settings,
      },
    };

    await this.db
      .update(organizations)
      .set({ config: nextConfig })
      .where(eq(organizations.id, tenantId));

    this.logger.log(
      `${LOG}.updateArtifactExportSettings scope=${scope} tenantId=${tenantId}`,
    );
    return settings;
  }

  private async assertActiveCategory(filesystemId: string, categoryId: string) {
    const cat = await this.filesystemsRepo.findCategory(categoryId, filesystemId);
    if (!cat || cat.archivedAt) {
      throw new BadRequestException(`Invalid category id: ${categoryId}`);
    }
  }

  private async assertJobBelongsToTenant(tenantId: string, jobId: string) {
    const [row] = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('Job not found');
  }

  private async resolveDefaultProjectTemplateId(tenantId: string): Promise<string> {
    const [org] = await this.db
      .select({
        defaultProjectFilesystemTemplateId: organizations.defaultProjectFilesystemTemplateId,
      })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    if (org?.defaultProjectFilesystemTemplateId) {
      const t = await this.templatesRepo.findAccessible(
        org.defaultProjectFilesystemTemplateId,
        tenantId,
      );
      if (t?.kind === 'project') return t.id;
    }

    const platform = await this.templatesRepo.findPlatformDefaultByKind('project');
    if (!platform) {
      throw new NotFoundException('Platform default project filesystem template not found');
    }
    return platform.id;
  }
}
