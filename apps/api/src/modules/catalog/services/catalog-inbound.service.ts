import { Injectable } from '@nestjs/common';
import { CatalogResolutionService } from './catalog-resolution.service';

@Injectable()
export class CatalogInboundService {
  constructor(private readonly resolutionService: CatalogResolutionService) {}

  /** Process catalogItemId / catalogComboId fields from an inbound provider payload. */
  async processLineItemPayload(params: {
    tenantId: string;
    sourceEntity: string;
    sourceEntityId: string;
    payload: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const payload = { ...params.payload };
    const itemRef = payload.catalogItemId;
    if (typeof itemRef === 'string' && itemRef && !isUuid(itemRef)) {
      const localId = await this.resolutionService.resolveExternalCatalogId({
        tenantId: params.tenantId,
        externalReference: itemRef,
        sourceEntity: params.sourceEntity,
        sourceEntityId: params.sourceEntityId,
      });
      if (localId) payload.catalogItemId = localId;
    }

    const comboRef = payload.catalogComboId;
    if (typeof comboRef === 'string' && comboRef && !isUuid(comboRef)) {
      const localId = await this.resolutionService.resolveExternalCatalogId({
        tenantId: params.tenantId,
        externalReference: comboRef,
        sourceEntity: params.sourceEntity,
        sourceEntityId: params.sourceEntityId,
      });
      if (localId) payload.catalogComboId = localId;
    }

    return payload;
  }

  async processQuotePayload(params: {
    tenantId: string;
    quoteId: string;
    payload: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const payload = { ...params.payload };
    const groups = payload.groups as Record<string, unknown>[] | undefined;
    if (!Array.isArray(groups)) return payload;

    for (const group of groups) {
      const items = group.items as Record<string, unknown>[] | undefined;
      if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          items[i] = await this.processLineItemPayload({
            tenantId: params.tenantId,
            sourceEntity: 'quote',
            sourceEntityId: params.quoteId,
            payload: items[i],
          });
        }
      }

      const combos = group.combos as Record<string, unknown>[] | undefined;
      if (Array.isArray(combos)) {
        for (const combo of combos) {
          const comboItems = combo.items as Record<string, unknown>[] | undefined;
          if (Array.isArray(comboItems)) {
            for (let i = 0; i < comboItems.length; i++) {
              comboItems[i] = await this.processLineItemPayload({
                tenantId: params.tenantId,
                sourceEntity: 'quote_combo',
                sourceEntityId: params.quoteId,
                payload: comboItems[i],
              });
            }
          }
        }
      }
    }

    return payload;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
