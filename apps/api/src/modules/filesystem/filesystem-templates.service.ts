import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { FilesystemTemplatesRepository } from '../../database/repositories/filesystem-templates.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { organizations } from '../../database/schema';
import { CreateFilesystemTemplateDto } from './dto/create-filesystem-template.dto';
import { UpdateFilesystemTemplateDto } from './dto/update-filesystem-template.dto';
import { ReplaceCategoriesDto } from './dto/replace-categories.dto';

const LOG = '[FilesystemTemplatesService]';
const MAX_PIPELINE_STEPS = 10;

@Injectable()
export class FilesystemTemplatesService {
  private readonly logger = new Logger(FilesystemTemplatesService.name);

  constructor(
    private readonly templatesRepo: FilesystemTemplatesRepository,
    private readonly tenantContext: TenantContext,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async findAll(kind?: 'company' | 'project') {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `${LOG}.findAll tenantId=${tenantId} kind=${kind ?? 'all'}`,
    );
    const data = kind
      ? await this.templatesRepo.findAllByKind(tenantId, kind)
      : await this.templatesRepo.findAll(tenantId);
    return { data };
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    const template = await this.templatesRepo.findAccessible(id, tenantId);
    if (!template) throw new NotFoundException('Filesystem template not found');
    const [categories, pipelines] = await Promise.all([
      this.templatesRepo.getCategories(template.id),
      this.templatesRepo.listPipelinesWithSteps(template.id),
    ]);
    return { ...template, categories, pipelines };
  }

  async create(dto: CreateFilesystemTemplateDto) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`${LOG}.create name="${dto.name}" tenantId=${tenantId}`);
    return this.templatesRepo.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      kind: dto.kind ?? 'company',
    });
  }

  private assertTenantOwned(template: { tenantId: string | null }, action: string): void {
    if (template.tenantId === null) {
      throw new ForbiddenException(`Cannot ${action} a platform filesystem template`);
    }
  }

  async update(id: string, dto: UpdateFilesystemTemplateDto) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.templatesRepo.findAccessible(id, tenantId);
    if (!existing) throw new NotFoundException('Filesystem template not found');
    this.assertTenantOwned(existing, 'update');

    return this.templatesRepo.update(id, tenantId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.kind !== undefined && { kind: dto.kind }),
    });
  }

  async archive(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.templatesRepo.findAccessible(id, tenantId);
    if (!existing) throw new NotFoundException('Filesystem template not found');
    this.assertTenantOwned(existing, 'archive');
    await this.templatesRepo.archive(id, tenantId);
    return { archived: true };
  }

  async replaceCategories(templateId: string, dto: ReplaceCategoriesDto) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.templatesRepo.findAccessible(templateId, tenantId);
    if (!existing) throw new NotFoundException('Filesystem template not found');
    this.assertTenantOwned(existing, 'replace categories on');

    this.logger.debug(
      `${LOG}.replaceCategories templateId=${templateId} count=${dto.categories.length}`,
    );

    const categoryInserts = dto.categories.map((cat) => ({
      id: cat.id ?? crypto.randomUUID(),
      templateId,
      parentCategoryId: cat.parentCategoryId ?? null,
      displayName: cat.displayName,
      description: cat.description ?? null,
      slug: cat.slug,
      config: cat.config ?? {},
      sortOrder: cat.sortOrder ?? 0,
    }));

    return this.templatesRepo.replaceCategories(templateId, categoryInserts);
  }

  /**
   * Clone a platform (or accessible) template into a tenant-owned copy so
   * pipelines/categories can be edited without mutating shared platform seeds.
   */
  async cloneForTenant(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    const source = await this.templatesRepo.findAccessible(id, tenantId);
    if (!source) throw new NotFoundException('Filesystem template not found');

    const [categories, pipelines] = await Promise.all([
      this.templatesRepo.getCategories(source.id),
      this.templatesRepo.listPipelinesWithSteps(source.id),
    ]);

    const cloned = await this.templatesRepo.create({
      tenantId,
      name: `${source.name} (Custom)`,
      description: source.description,
      kind: source.kind,
      isDefault: false,
    });

    const idMap = new Map<string, string>();
    const categoryInserts = categories.map((cat) => {
      const newId = crypto.randomUUID();
      idMap.set(cat.id, newId);
      return {
        id: newId,
        templateId: cloned.id,
        parentCategoryId: null as string | null,
        displayName: cat.displayName,
        description: cat.description,
        slug: cat.slug,
        config: cat.config ?? {},
        sortOrder: cat.sortOrder,
      };
    });
    for (const cat of categories) {
      const row = categoryInserts.find((c) => c.id === idMap.get(cat.id));
      if (row && cat.parentCategoryId) {
        row.parentCategoryId = idMap.get(cat.parentCategoryId) ?? null;
      }
    }
    if (categoryInserts.length > 0) {
      await this.templatesRepo.replaceCategories(cloned.id, categoryInserts);
    }

    for (const p of pipelines) {
      const pipeline = await this.templatesRepo.createPipeline({
        templateId: cloned.id,
        templateCategoryId: p.templateCategoryId
          ? (idMap.get(p.templateCategoryId) ?? null)
          : null,
        name: p.name,
        description: p.description,
        isActive: p.isActive,
        triggerOn: p.triggerOn,
        sortOrder: p.sortOrder,
      });
      if (p.steps.length > 0) {
        await this.templatesRepo.replacePipelineSteps(
          pipeline.id,
          p.steps.map((s) => ({
            agentId: s.agentId,
            stepOrder: s.stepOrder,
            config: (s.config as Record<string, unknown>) ?? {},
          })),
        );
      }
    }

    // If org default project/company pointed at the source, retarget to the clone.
    const [org] = await this.db
      .select({
        defaultCompanyFilesystemTemplateId: organizations.defaultCompanyFilesystemTemplateId,
        defaultProjectFilesystemTemplateId: organizations.defaultProjectFilesystemTemplateId,
      })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    const patch: Partial<typeof organizations.$inferInsert> = {};
    if (org?.defaultCompanyFilesystemTemplateId === source.id) {
      patch.defaultCompanyFilesystemTemplateId = cloned.id;
    }
    if (org?.defaultProjectFilesystemTemplateId === source.id) {
      patch.defaultProjectFilesystemTemplateId = cloned.id;
    }
    if (Object.keys(patch).length > 0) {
      await this.db.update(organizations).set(patch).where(eq(organizations.id, tenantId));
    }

    this.logger.log(
      `${LOG}.cloneForTenant source=${source.id} clone=${cloned.id} tenantId=${tenantId}`,
    );

    return this.findOne(cloned.id);
  }

  async listPipelines(templateId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const template = await this.templatesRepo.findAccessible(templateId, tenantId);
    if (!template) throw new NotFoundException('Filesystem template not found');
    const pipelines = await this.templatesRepo.listPipelines(templateId);
    return pipelines.map((p) => this.toPipelineResponse(p, tenantId));
  }

  async getPipeline(templateId: string, pipelineId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const template = await this.templatesRepo.findAccessible(templateId, tenantId);
    if (!template) throw new NotFoundException('Filesystem template not found');
    const pipeline = await this.templatesRepo.findPipeline(pipelineId, templateId);
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    const steps = await this.templatesRepo.listPipelineSteps(pipelineId);
    return {
      ...this.toPipelineResponse(pipeline, tenantId),
      steps: steps.map((s) => ({
        id: s.id,
        pipelineId: s.pipelineId,
        agentId: s.agentId,
        stepOrder: s.stepOrder,
        config: (s.config as Record<string, unknown>) ?? {},
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
  }

  async createPipeline(
    templateId: string,
    body: {
      name: string;
      description?: string | null;
      isActive?: boolean;
      triggerOn?: string;
      categoryId?: string | null;
      sortOrder?: number;
    },
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const template = await this.templatesRepo.findAccessible(templateId, tenantId);
    if (!template) throw new NotFoundException('Filesystem template not found');
    this.assertTenantOwned(template, 'create pipelines on');

    const pipeline = await this.templatesRepo.createPipeline({
      templateId,
      templateCategoryId: body.categoryId ?? null,
      name: body.name,
      description: body.description ?? null,
      isActive: body.isActive ?? true,
      triggerOn: body.triggerOn ?? 'upload_complete',
      sortOrder: body.sortOrder ?? 0,
    });
    this.logger.log(`${LOG}.createPipeline id=${pipeline.id} templateId=${templateId}`);
    return this.toPipelineResponse(pipeline, tenantId);
  }

  async updatePipeline(
    templateId: string,
    pipelineId: string,
    body: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      triggerOn?: string;
      categoryId?: string | null;
      sortOrder?: number;
    },
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const template = await this.templatesRepo.findAccessible(templateId, tenantId);
    if (!template) throw new NotFoundException('Filesystem template not found');
    this.assertTenantOwned(template, 'update pipelines on');

    const updated = await this.templatesRepo.updatePipeline(pipelineId, templateId, {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.triggerOn !== undefined && { triggerOn: body.triggerOn }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.categoryId !== undefined && { templateCategoryId: body.categoryId }),
    });
    if (!updated) throw new NotFoundException('Pipeline not found');
    return this.toPipelineResponse(updated, tenantId);
  }

  async deletePipeline(templateId: string, pipelineId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const template = await this.templatesRepo.findAccessible(templateId, tenantId);
    if (!template) throw new NotFoundException('Filesystem template not found');
    this.assertTenantOwned(template, 'delete pipelines on');

    const ok = await this.templatesRepo.deletePipeline(pipelineId, templateId);
    if (!ok) throw new NotFoundException('Pipeline not found');
    return { deleted: true };
  }

  async replacePipelineSteps(
    templateId: string,
    pipelineId: string,
    steps: Array<{ agentId: string; stepOrder: number; config?: Record<string, unknown> }>,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const template = await this.templatesRepo.findAccessible(templateId, tenantId);
    if (!template) throw new NotFoundException('Filesystem template not found');
    this.assertTenantOwned(template, 'update pipeline steps on');

    const pipeline = await this.templatesRepo.findPipeline(pipelineId, templateId);
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    if (steps.length > MAX_PIPELINE_STEPS) {
      throw new BadRequestException(`Max ${MAX_PIPELINE_STEPS} steps allowed`);
    }

    const saved = await this.templatesRepo.replacePipelineSteps(pipelineId, steps);
    return saved.map((s) => ({
      id: s.id,
      pipelineId: s.pipelineId,
      agentId: s.agentId,
      stepOrder: s.stepOrder,
      config: (s.config as Record<string, unknown>) ?? {},
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  private toPipelineResponse(
    p: {
      id: string;
      templateCategoryId: string | null;
      name: string;
      description: string | null;
      isActive: boolean;
      triggerOn: string;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    },
    tenantId: string,
  ) {
    return {
      id: p.id,
      tenantId,
      filesystemId: null as string | null,
      categoryId: p.templateCategoryId,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      triggerOn: p.triggerOn,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
