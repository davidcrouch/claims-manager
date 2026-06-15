import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogCategoriesRepository } from '../../../database/repositories';
import { TenantContext } from '../../../tenant/tenant-context';
import { CatalogBootstrapService } from './catalog-bootstrap.service';
import type { CategoryTreeNode } from '../catalog.utils';

@Injectable()
export class CatalogCategoryService {
  constructor(
    private readonly categoriesRepo: CatalogCategoriesRepository,
    private readonly bootstrapService: CatalogBootstrapService,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async findAll() {
    const tenantId = this.getTenantId();
    await this.bootstrapService.ensureDefaults({ tenantId });
    return this.categoriesRepo.findAll({ tenantId });
  }

  async findTree(): Promise<CategoryTreeNode[]> {
    const flat = await this.findAll();
    const byParent = new Map<string | null, typeof flat>();

    for (const row of flat) {
      const key = row.parentCategoryId ?? null;
      const list = byParent.get(key) ?? [];
      list.push(row);
      byParent.set(key, list);
    }

    const build = (parentId: string | null): CategoryTreeNode[] => {
      const nodes = byParent.get(parentId) ?? [];
      return nodes.map((row) => ({
        id: row.id,
        parentCategoryId: row.parentCategoryId,
        code: row.code,
        name: row.name,
        sortIndex: row.sortIndex,
        isActive: row.isActive,
        children: build(row.id),
      }));
    };

    return build(null);
  }

  async create(params: {
    code: string;
    name: string;
    parentCategoryId?: string | null;
    sortIndex?: number;
  }) {
    const tenantId = this.getTenantId();
    if (params.parentCategoryId) {
      const parent = await this.categoriesRepo.findById({
        tenantId,
        id: params.parentCategoryId,
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    return this.categoriesRepo.create({
      tenantId,
      data: {
        code: params.code,
        name: params.name,
        parentCategoryId: params.parentCategoryId ?? null,
        sortIndex: params.sortIndex ?? 0,
        isActive: true,
      },
    });
  }

  async update(params: {
    id: string;
    code?: string;
    name?: string;
    parentCategoryId?: string | null;
    sortIndex?: number;
    isActive?: boolean;
  }) {
    const tenantId = this.getTenantId();

    if (params.parentCategoryId === params.id) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    if (params.parentCategoryId) {
      const descendants = await this.categoriesRepo.findDescendantIds({
        tenantId,
        categoryId: params.id,
      });
      if (descendants.includes(params.parentCategoryId)) {
        throw new BadRequestException('Category parent would create a cycle');
      }
    }

    const row = await this.categoriesRepo.update({
      tenantId,
      id: params.id,
      data: {
        code: params.code,
        name: params.name,
        parentCategoryId: params.parentCategoryId,
        sortIndex: params.sortIndex,
        isActive: params.isActive,
      },
    });
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }

  async deactivate(params: { id: string }) {
    const tenantId = this.getTenantId();
    const hasChildren = await this.categoriesRepo.hasChildren({
      tenantId,
      categoryId: params.id,
    });
    if (hasChildren) {
      throw new BadRequestException('Cannot deactivate category with child categories');
    }
    const row = await this.categoriesRepo.deactivate({ tenantId, id: params.id });
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }
}
