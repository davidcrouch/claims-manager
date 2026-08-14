import { Injectable, Logger } from '@nestjs/common';
import { CatalogItemsRepository } from '../../../database/repositories';

/** Crunchwork Insurance REST API: catalogItemId / catalogComboId are format UUID. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Maps internal catalogue UUIDs to Crunchwork catalog item UUIDs
 * (`catalog_items.external_reference`) when building outbound quote/PO payloads.
 *
 * Non-UUID external references (e.g. seeded SKU codes) are omitted — CW rejects them
 * with `invalid input syntax for type uuid`.
 */
@Injectable()
export class CatalogOutboundService {
  private readonly logger = new Logger(CatalogOutboundService.name);

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
    const resolved = await this.resolveCwCatalogUuid({
      tenantId: params.tenantId,
      field: 'catalogItemId',
      value: params.item.catalogItemId,
    });
    if (resolved === undefined) {
      delete params.item.catalogItemId;
    } else {
      params.item.catalogItemId = resolved;
    }
    // Local catalogue id is not a CW CreateQuote field — never send it.
    delete params.item.catalogId;
  }

  private async mapComboRef(params: {
    tenantId: string;
    combo: Record<string, unknown>;
  }): Promise<void> {
    const resolved = await this.resolveCwCatalogUuid({
      tenantId: params.tenantId,
      field: 'catalogComboId',
      value: params.combo.catalogComboId,
    });
    if (resolved === undefined) {
      delete params.combo.catalogComboId;
    } else {
      params.combo.catalogComboId = resolved;
    }
    delete params.combo.catalogId;
  }

  /**
   * @returns CW catalog UUID to send, or `undefined` to omit the field.
   */
  private async resolveCwCatalogUuid(params: {
    tenantId: string;
    field: 'catalogItemId' | 'catalogComboId';
    value: unknown;
  }): Promise<string | undefined> {
    if (typeof params.value !== 'string' || !params.value) return undefined;

    if (!UUID_RE.test(params.value)) {
      this.logger.warn(
        `CatalogOutboundService.resolveCwCatalogUuid — omitting ${params.field}=${params.value} ` +
          `(not a UUID; Crunchwork catalog ids must be UUIDs)`,
      );
      return undefined;
    }

    const catalogItem = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: params.value,
    });
    if (!catalogItem) {
      // Already a provider UUID (or unknown UUID) — pass through.
      return params.value;
    }

    const extRef = catalogItem.externalReference;
    if (extRef && UUID_RE.test(extRef)) {
      return extRef;
    }

    if (extRef) {
      this.logger.warn(
        `CatalogOutboundService.resolveCwCatalogUuid — omitting ${params.field} for local ` +
          `catalog item ${catalogItem.id} (code=${catalogItem.code}): external_reference=${extRef} ` +
          `is not a Crunchwork catalog UUID`,
      );
    }
    return undefined;
  }
}
