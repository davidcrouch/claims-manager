import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CatalogAssemblyComponentsRepository,
  CatalogItemsRepository,
  type CatalogItemRow,
} from '../../../database/repositories';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  applyMarkup,
  formatDecimal,
  parseDecimal,
  type ResolvedCatalogPrice,
} from '../catalog.utils';

@Injectable()
export class CatalogPricingService {
  constructor(
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly bomRepo: CatalogAssemblyComponentsRepository,
  ) {}

  async resolveUnitCost(params: {
    tenantId: string;
    itemId: string;
    asOf?: Date;
    tx?: DrizzleDbOrTx;
    visited?: Set<string>;
  }): Promise<ResolvedCatalogPrice> {
    const item = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: params.itemId,
    });
    if (!item) throw new NotFoundException(`Catalog item not found: ${params.itemId}`);

    this.assertEffective(item, params.asOf);

    if (item.kind === 'primitive') {
      return {
        unitCost: item.unitCost ?? '0',
        buyCost: item.buyCost,
      };
    }

    return this.resolveAssemblyUnitCost({
      tenantId: params.tenantId,
      item,
      tx: params.tx,
      visited: params.visited ?? new Set<string>(),
    });
  }

  async refreshComputedCost(params: {
    tenantId: string;
    assemblyId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{ computedUnitCost: string }> {
    const resolved = await this.resolveUnitCost({
      tenantId: params.tenantId,
      itemId: params.assemblyId,
      tx: params.tx,
    });

    await this.itemsRepo.update({
      tenantId: params.tenantId,
      id: params.assemblyId,
      data: {
        computedUnitCost: resolved.unitCost,
        computedCostAt: new Date(),
      },
      tx: params.tx,
    });

    return { computedUnitCost: resolved.unitCost };
  }

  private async resolveAssemblyUnitCost(params: {
    tenantId: string;
    item: CatalogItemRow;
    tx?: DrizzleDbOrTx;
    visited: Set<string>;
  }): Promise<ResolvedCatalogPrice> {
    if (params.visited.has(params.item.id)) {
      return { unitCost: '0', buyCost: null };
    }
    params.visited.add(params.item.id);

    const mode = params.item.pricingMode ?? 'computed';

    if (mode === 'fixed') {
      return {
        unitCost: params.item.fixedUnitCost ?? params.item.computedUnitCost ?? '0',
        buyCost: params.item.buyCost,
      };
    }

    const bomLines = await this.bomRepo.findByAssemblyId({
      tenantId: params.tenantId,
      assemblyId: params.item.id,
      tx: params.tx,
    });

    let rolledUp = 0;
    let rolledUpBuy = 0;

    for (const line of bomLines) {
      const componentPrice = await this.resolveUnitCost({
        tenantId: params.tenantId,
        itemId: line.componentId,
        tx: params.tx,
        visited: params.visited,
      });
      const qty = parseDecimal(line.quantity) * parseDecimal(line.wasteFactor);
      rolledUp += qty * parseDecimal(componentPrice.unitCost);
      rolledUpBuy += qty * parseDecimal(componentPrice.buyCost);
    }

    let unitCost = rolledUp;
    if (mode === 'cost_plus') {
      unitCost = applyMarkup({
        baseCost: rolledUp,
        markupType: params.item.markupType,
        markupValue: params.item.markupValue,
      });
    }

    return {
      unitCost: formatDecimal(unitCost),
      buyCost: rolledUpBuy > 0 ? formatDecimal(rolledUpBuy) : params.item.buyCost,
    };
  }

  private assertEffective(item: CatalogItemRow, asOf?: Date): void {
    const date = asOf ?? new Date();
    const day = date.toISOString().slice(0, 10);
    if (item.effectiveFrom && day < item.effectiveFrom) {
      throw new NotFoundException(`Catalog item ${item.code} is not yet effective`);
    }
    if (item.effectiveTo && day > item.effectiveTo) {
      throw new NotFoundException(`Catalog item ${item.code} is no longer effective`);
    }
  }
}
