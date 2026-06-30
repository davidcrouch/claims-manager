import { Injectable } from '@nestjs/common';
import { CatalogItemsRepository } from '../../../database/repositories';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Maps internal catalogue UUIDs to provider external_reference values
 * when building outbound Crunchwork quote/PO payloads.
 */
@Injectable()
export class CatalogOutboundService {
  constructor(private readonly itemsRepo: CatalogItemsRepository) {}

  async enrichPayload(params: {
    tenantId: string;
    body: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const body = structuredClone(params.body);
    const groups = body.groups as Record<string, unknown>[] | undefined;
    if (!Array.isArray(groups)) return body;

    for (const group of groups) {
      const items = group.items as Record<string, unknown>[] | undefined;
      if (Array.isArray(items)) {
        for (const item of items) {
          await this.mapItemRef({ tenantId: params.tenantId, item });
        }
      }

      const combos = group.combos as Record<string, unknown>[] | undefined;
      if (Array.isArray(combos)) {
        for (const combo of combos) {
          await this.mapComboRef({ tenantId: params.tenantId, combo });
          const comboItems = combo.items as Record<string, unknown>[] | undefined;
          if (Array.isArray(comboItems)) {
            for (const item of comboItems) {
              await this.mapItemRef({ tenantId: params.tenantId, item });
            }
          }
        }
      }
    }

    return body;
  }

  private async mapItemRef(params: {
    tenantId: string;
    item: Record<string, unknown>;
  }): Promise<void> {
    const ref = params.item.catalogItemId;
    if (typeof ref !== 'string' || !UUID_RE.test(ref)) return;

    const catalogItem = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: ref,
    });
    if (catalogItem?.externalReference) {
      params.item.catalogItemId = catalogItem.externalReference;
    }
    if (catalogItem?.catalogId) {
      params.item.catalogId = catalogItem.catalogId;
    }
  }

  private async mapComboRef(params: {
    tenantId: string;
    combo: Record<string, unknown>;
  }): Promise<void> {
    const ref = params.combo.catalogComboId;
    if (typeof ref !== 'string' || !UUID_RE.test(ref)) return;

    const catalogItem = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: ref,
    });
    if (catalogItem?.externalReference) {
      params.combo.catalogComboId = catalogItem.externalReference;
    }
    if (catalogItem?.catalogId) {
      params.combo.catalogId = catalogItem.catalogId;
    }
  }
}
