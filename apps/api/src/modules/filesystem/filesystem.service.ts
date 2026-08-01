import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { FilesystemsRepository } from '../../database/repositories/filesystems.repository';
import { FilesystemTemplatesRepository } from '../../database/repositories/filesystem-templates.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { SetupFilesystemDto } from './dto/setup-filesystem.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReplaceCategoriesDto } from './dto/replace-categories.dto';

@Injectable()
export class FilesystemService {
  private readonly logger = new Logger(FilesystemService.name);

  constructor(
    private readonly filesystemsRepo: FilesystemsRepository,
    private readonly templatesRepo: FilesystemTemplatesRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async getOrCreateFilesystem() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[FilesystemService.getOrCreateFilesystem] tenantId=${tenantId}`);

    let filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem) {
      filesystem = await this.filesystemsRepo.create({ tenantId });
      this.logger.debug(`[FilesystemService.getOrCreateFilesystem] created new filesystem id=${filesystem.id}`);
    }

    const categories = await this.filesystemsRepo.getCategoryTree(filesystem.id);
    return { ...filesystem, categories };
  }

  async setupFromTemplate(dto: SetupFilesystemDto) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[FilesystemService.setupFromTemplate] templateId=${dto.templateId} tenantId=${tenantId}`);

    const template = await this.templatesRepo.findOne(dto.templateId, tenantId);
    if (!template) throw new NotFoundException('Template not found');

    let filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem) {
      filesystem = await this.filesystemsRepo.create({ tenantId });
    }

    const templateCategories = await this.templatesRepo.getCategories(dto.templateId);

    const idMap = new Map<string, string>();
    const categoryInserts = templateCategories.map((cat) => {
      const newId = crypto.randomUUID();
      idMap.set(cat.id, newId);
      return {
        id: newId,
        filesystemId: filesystem.id,
        parentCategoryId: cat.parentCategoryId ? idMap.get(cat.parentCategoryId) ?? null : null,
        displayName: cat.displayName,
        slug: cat.slug,
        config: cat.config ?? {},
        sortOrder: cat.sortOrder,
      };
    });

    await this.filesystemsRepo.replaceCategories(filesystem.id, categoryInserts);

    await this.filesystemsRepo.update(filesystem.id, {
      sourceTemplateId: dto.templateId,
      copiedAt: new Date(),
    });

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

    this.logger.debug(`[FilesystemService.replaceCategories] filesystemId=${filesystemId} count=${dto.categories.length}`);

    const categoryInserts = dto.categories.map((cat) => ({
      id: cat.id,
      filesystemId,
      parentCategoryId: cat.parentCategoryId ?? null,
      displayName: cat.displayName,
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

    this.logger.debug(`[FilesystemService.addCategory] filesystemId=${filesystemId} displayName="${dto.displayName}"`);

    return this.filesystemsRepo.addCategory({
      filesystemId,
      parentCategoryId: dto.parentCategoryId ?? null,
      displayName: dto.displayName,
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
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.config !== undefined && { config: dto.config }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    });
    if (!updated) throw new NotFoundException('Category not found');
    return updated;
  }

  async archiveCategory(filesystemId: string, categoryId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const filesystem = await this.filesystemsRepo.findByTenant(tenantId);
    if (!filesystem || filesystem.id !== filesystemId) throw new NotFoundException('Filesystem not found');

    await this.filesystemsRepo.archiveCategory(categoryId);
    return { archived: true };
  }
}
