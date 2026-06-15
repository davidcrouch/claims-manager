import { Injectable, Logger } from '@nestjs/common';
import {
  CatalogCategoriesRepository,
  CatalogItemTypesRepository,
} from '../../../database/repositories';
import { DEFAULT_CATALOG_CATEGORIES, DEFAULT_CATALOG_TYPES } from '../catalog.utils';

@Injectable()
export class CatalogBootstrapService {
  private readonly logger = new Logger('CatalogBootstrapService');

  constructor(
    private readonly typesRepo: CatalogItemTypesRepository,
    private readonly categoriesRepo: CatalogCategoriesRepository,
  ) {}

  async ensureDefaults(params: { tenantId: string }): Promise<void> {
    await this.ensureTypes(params.tenantId);
    await this.ensureCategories(params.tenantId);
  }

  private async ensureTypes(tenantId: string): Promise<void> {
    const existing = await this.typesRepo.findAll({ tenantId, activeOnly: false });
    if (existing.length > 0) return;

    for (const type of DEFAULT_CATALOG_TYPES) {
      await this.typesRepo.create({
        tenantId,
        data: {
          code: type.code,
          name: type.name,
          sortIndex: type.sortIndex,
          isActive: true,
        },
      });
    }
    this.logger.log(`CatalogBootstrapService.ensureTypes — seeded defaults for tenant=${tenantId}`);
  }

  private async ensureCategories(tenantId: string): Promise<void> {
    const existing = await this.categoriesRepo.findAll({ tenantId, activeOnly: false });
    if (existing.length > 0) return;

    for (const root of DEFAULT_CATALOG_CATEGORIES) {
      const createdRoot = await this.categoriesRepo.create({
        tenantId,
        data: {
          code: root.code,
          name: root.name,
          sortIndex: root.sortIndex,
          isActive: true,
          parentCategoryId: null,
        },
      });

      for (const child of root.children) {
        await this.categoriesRepo.create({
          tenantId,
          data: {
            code: child.code,
            name: child.name,
            sortIndex: child.sortIndex,
            isActive: true,
            parentCategoryId: createdRoot.id,
          },
        });
      }
    }
    this.logger.log(
      `CatalogBootstrapService.ensureCategories — seeded defaults for tenant=${tenantId}`,
    );
  }
}
