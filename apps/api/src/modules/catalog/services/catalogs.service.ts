import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogsRepository,
  CatalogItemsRepository,
} from '../../../database/repositories';
import { TenantContext } from '../../../tenant/tenant-context';

export type CatalogType = 'crunchwork' | 'internal';

const VALID_CATALOG_TYPES: CatalogType[] = ['crunchwork', 'internal'];

@Injectable()
export class CatalogsService {
  private readonly logger = new Logger('CatalogsService');

  constructor(
    private readonly catalogsRepo: CatalogsRepository,
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async findAll(params?: { type?: string }) {
    const tenantId = this.getTenantId();
    const catalogs = await this.catalogsRepo.findAll({
      tenantId,
      type: params?.type,
    });

    const enriched = await Promise.all(
      catalogs.map(async (c) => ({
        ...c,
        itemCount: await this.catalogsRepo.countItems({
          tenantId,
          catalogId: c.id,
        }),
      })),
    );

    return enriched;
  }

  async findOne(params: { id: string }) {
    const tenantId = this.getTenantId();
    const catalog = await this.catalogsRepo.findById({
      tenantId,
      id: params.id,
    });
    if (!catalog) throw new NotFoundException('Catalogue not found');

    const itemCount = await this.catalogsRepo.countItems({
      tenantId,
      catalogId: catalog.id,
    });

    return { ...catalog, itemCount };
  }

  async create(params: {
    name: string;
    description?: string;
    type: CatalogType;
  }) {
    const tenantId = this.getTenantId();

    if (!VALID_CATALOG_TYPES.includes(params.type)) {
      throw new BadRequestException(
        `Invalid catalogue type: ${params.type}. Must be one of: ${VALID_CATALOG_TYPES.join(', ')}`,
      );
    }

    const existing = await this.catalogsRepo.findByName({
      tenantId,
      name: params.name,
    });
    if (existing) {
      throw new BadRequestException(
        `A catalogue with name "${params.name}" already exists`,
      );
    }

    const catalog = await this.catalogsRepo.create({
      tenantId,
      data: {
        name: params.name,
        description: params.description,
        type: params.type,
        isActive: true,
      },
    });

    this.logger.log(
      `CatalogsService.create — created catalogue id=${catalog.id} name="${catalog.name}" type=${catalog.type}`,
    );

    return { ...catalog, itemCount: 0 };
  }

  async update(params: {
    id: string;
    name?: string;
    description?: string;
    isActive?: boolean;
  }) {
    const tenantId = this.getTenantId();
    const existing = await this.catalogsRepo.findById({
      tenantId,
      id: params.id,
    });
    if (!existing) throw new NotFoundException('Catalogue not found');

    if (params.name && params.name !== existing.name) {
      const dup = await this.catalogsRepo.findByName({
        tenantId,
        name: params.name,
      });
      if (dup) {
        throw new BadRequestException(
          `A catalogue with name "${params.name}" already exists`,
        );
      }
    }

    const updated = await this.catalogsRepo.update({
      tenantId,
      id: params.id,
      data: {
        name: params.name,
        description: params.description,
        isActive: params.isActive,
      },
    });

    return updated;
  }

  async deactivate(params: { id: string }) {
    const tenantId = this.getTenantId();
    const catalog = await this.catalogsRepo.findById({
      tenantId,
      id: params.id,
    });
    if (!catalog) throw new NotFoundException('Catalogue not found');

    return this.catalogsRepo.deactivate({ tenantId, id: params.id });
  }
}
