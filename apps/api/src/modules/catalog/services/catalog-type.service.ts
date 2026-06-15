import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogItemTypesRepository } from '../../../database/repositories';
import { TenantContext } from '../../../tenant/tenant-context';
import { CatalogBootstrapService } from './catalog-bootstrap.service';

@Injectable()
export class CatalogTypeService {
  constructor(
    private readonly typesRepo: CatalogItemTypesRepository,
    private readonly bootstrapService: CatalogBootstrapService,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async findAll() {
    const tenantId = this.getTenantId();
    await this.bootstrapService.ensureDefaults({ tenantId });
    return this.typesRepo.findAll({ tenantId });
  }

  async create(params: { code: string; name: string; sortIndex?: number }) {
    const tenantId = this.getTenantId();
    return this.typesRepo.create({
      tenantId,
      data: {
        code: params.code,
        name: params.name,
        sortIndex: params.sortIndex ?? 0,
        isActive: true,
      },
    });
  }

  async update(params: {
    id: string;
    name?: string;
    sortIndex?: number;
    isActive?: boolean;
  }) {
    const tenantId = this.getTenantId();
    const row = await this.typesRepo.update({
      tenantId,
      id: params.id,
      data: {
        name: params.name,
        sortIndex: params.sortIndex,
        isActive: params.isActive,
      },
    });
    if (!row) throw new NotFoundException('Catalog type not found');
    return row;
  }
}
