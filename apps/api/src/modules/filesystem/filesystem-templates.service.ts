import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FilesystemTemplatesRepository } from '../../database/repositories/filesystem-templates.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { CreateFilesystemTemplateDto } from './dto/create-filesystem-template.dto';
import { UpdateFilesystemTemplateDto } from './dto/update-filesystem-template.dto';
import { ReplaceCategoriesDto } from './dto/replace-categories.dto';

@Injectable()
export class FilesystemTemplatesService {
  private readonly logger = new Logger(FilesystemTemplatesService.name);

  constructor(
    private readonly templatesRepo: FilesystemTemplatesRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[FilesystemTemplatesService.findAll] tenantId=${tenantId}`);
    const data = await this.templatesRepo.findAll(tenantId);
    return { data };
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    const template = await this.templatesRepo.findAccessible(id, tenantId);
    if (!template) throw new NotFoundException('Filesystem template not found');
    const categories = await this.templatesRepo.getCategories(template.id);
    return { ...template, categories };
  }

  async create(dto: CreateFilesystemTemplateDto) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[FilesystemTemplatesService.create] name="${dto.name}" tenantId=${tenantId}`);
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

    this.logger.debug(`[FilesystemTemplatesService.replaceCategories] templateId=${templateId} count=${dto.categories.length}`);

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
}
