import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  CatalogAssemblyComponentsRepository,
  CatalogItemsRepository,
} from '../../../database/repositories';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { TenantContext } from '../../../tenant/tenant-context';
import { CatalogPricingService } from './catalog-pricing.service';

@Injectable()
export class CatalogAssemblyService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly bomRepo: CatalogAssemblyComponentsRepository,
    private readonly pricingService: CatalogPricingService,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async findComponents(params: { assemblyId: string }) {
    const tenantId = this.getTenantId();
    const assembly = await this.itemsRepo.findById({ tenantId, id: params.assemblyId });
    if (!assembly || assembly.kind !== 'assembly') {
      throw new NotFoundException('Assembly not found');
    }

    const lines = await this.bomRepo.findByAssemblyId({
      tenantId,
      assemblyId: params.assemblyId,
    });

    const enriched = await Promise.all(
      lines.map(async (line) => {
        const component = await this.itemsRepo.findById({
          tenantId,
          id: line.componentId,
        });
        const price = component
          ? await this.pricingService.resolveUnitCost({
              tenantId,
              itemId: component.id,
            })
          : null;
        return { ...line, component, resolvedUnitCost: price?.unitCost ?? null };
      }),
    );

    return enriched;
  }

  async replaceBom(params: {
    assemblyId: string;
    lines: Array<{
      componentId: string;
      quantity: string;
      wasteFactor?: string;
      sortIndex?: number;
      isOptional?: boolean;
      notes?: string;
    }>;
  }) {
    const tenantId = this.getTenantId();
    const assembly = await this.itemsRepo.findById({ tenantId, id: params.assemblyId });
    if (!assembly || assembly.kind !== 'assembly') {
      throw new NotFoundException('Assembly not found');
    }

    for (const line of params.lines) {
      await this.validateBomLine({
        tenantId,
        assemblyId: params.assemblyId,
        componentId: line.componentId,
      });
    }

    return this.db.transaction(async (tx) => {
      const saved = await this.bomRepo.replaceBom({
        tenantId,
        assemblyId: params.assemblyId,
        lines: params.lines.map((line, index) => ({
          componentId: line.componentId,
          quantity: line.quantity,
          wasteFactor: line.wasteFactor ?? '1',
          sortIndex: line.sortIndex ?? index,
          isOptional: line.isOptional ?? false,
          notes: line.notes,
        })),
        tx,
      });

      await this.pricingService.refreshComputedCost({
        tenantId,
        assemblyId: params.assemblyId,
        tx,
      });

      return saved;
    });
  }

  async addComponent(params: {
    assemblyId: string;
    componentId: string;
    quantity: string;
    wasteFactor?: string;
    sortIndex?: number;
    isOptional?: boolean;
    notes?: string;
  }) {
    const tenantId = this.getTenantId();
    await this.validateBomLine({
      tenantId,
      assemblyId: params.assemblyId,
      componentId: params.componentId,
    });

    return this.db.transaction(async (tx) => {
      const row = await this.bomRepo.create({
        tenantId,
        data: {
          assemblyId: params.assemblyId,
          componentId: params.componentId,
          quantity: params.quantity,
          wasteFactor: params.wasteFactor ?? '1',
          sortIndex: params.sortIndex ?? 0,
          isOptional: params.isOptional ?? false,
          notes: params.notes,
        },
        tx,
      });

      await this.pricingService.refreshComputedCost({
        tenantId,
        assemblyId: params.assemblyId,
        tx,
      });

      return row;
    });
  }

  async updateComponent(params: {
    assemblyId: string;
    lineId: string;
    quantity?: string;
    wasteFactor?: string;
    sortIndex?: number;
    isOptional?: boolean;
    notes?: string;
  }) {
    const tenantId = this.getTenantId();
    const row = await this.bomRepo.update({
      tenantId,
      id: params.lineId,
      data: {
        quantity: params.quantity,
        wasteFactor: params.wasteFactor,
        sortIndex: params.sortIndex,
        isOptional: params.isOptional,
        notes: params.notes,
      },
    });
    if (!row) throw new NotFoundException('BOM line not found');

    await this.pricingService.refreshComputedCost({ tenantId, assemblyId: params.assemblyId });
    return row;
  }

  async removeComponent(params: { assemblyId: string; lineId: string }) {
    const tenantId = this.getTenantId();
    await this.bomRepo.delete({ tenantId, id: params.lineId });
    await this.pricingService.refreshComputedCost({ tenantId, assemblyId: params.assemblyId });
  }

  async refreshParentAssemblyCosts(params: { componentId: string }): Promise<void> {
    const tenantId = this.getTenantId();
    const assemblyIds = await this.findParentAssemblyIds({
      tenantId,
      componentId: params.componentId,
    });

    for (const assemblyId of assemblyIds) {
      await this.pricingService.refreshComputedCost({ tenantId, assemblyId });
    }
  }

  private async findParentAssemblyIds(params: {
    tenantId: string;
    componentId: string;
  }): Promise<string[]> {
    const result = await this.db.execute<{ assembly_id: string }>(sql`
      SELECT DISTINCT assembly_id
      FROM catalog_assembly_components
      WHERE tenant_id = ${params.tenantId}::uuid
        AND component_id = ${params.componentId}::uuid
    `);
    return result.rows.map((r) => r.assembly_id);
  }

  private async validateBomLine(params: {
    tenantId: string;
    assemblyId: string;
    componentId: string;
  }): Promise<void> {
    const assembly = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: params.assemblyId,
    });
    if (!assembly || assembly.kind !== 'assembly') {
      throw new BadRequestException('Target must be an assembly');
    }

    const component = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: params.componentId,
    });
    if (!component) throw new BadRequestException('Component not found');

    const cycle = await this.bomRepo.wouldCreateCycle({
      tenantId: params.tenantId,
      assemblyId: params.assemblyId,
      componentId: params.componentId,
    });
    if (cycle) {
      throw new BadRequestException('BOM change would create a circular reference');
    }
  }
}
