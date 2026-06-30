import { Injectable, Logger, Inject } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { catalogItems, catalogs, externalReferenceResolutionLog } from '../../../database/schema';
import { CatalogItemsRepository } from '../../../database/repositories';
import { TenantContext } from '../../../tenant/tenant-context';

export const CATALOG_ITEM_DOMAIN = 'catalog_item';

@Injectable()
export class CatalogResolutionService {
  private readonly logger = new Logger('CatalogResolutionService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * Resolve an external provider catalogue id to a local catalog_items row.
   *
   * The same external reference can exist across multiple catalogues of the
   * same type (e.g. two Crunchwork catalogues imported months apart). Each
   * newer catalogue is treated as a revision — the item from the most
   * recently created catalogue wins.
   */
  async resolveExternalCatalogId(params: {
    tenantId: string;
    externalReference: string;
    sourceEntity?: string;
    sourceEntityId?: string;
  }): Promise<string | null> {
    if (!params.externalReference?.trim()) return null;

    const matches = await this.db
      .select({
        id: catalogItems.id,
        catalogCreatedAt: catalogs.createdAt,
      })
      .from(catalogItems)
      .leftJoin(catalogs, eq(catalogItems.catalogId, catalogs.id))
      .where(
        and(
          eq(catalogItems.tenantId, params.tenantId),
          eq(catalogItems.externalReference, params.externalReference),
          isNull(catalogItems.deletedAt),
        ),
      )
      .orderBy(desc(catalogs.createdAt));

    if (matches.length > 0) {
      return matches[0].id;
    }

    await this.logUnknown({
      tenantId: params.tenantId,
      externalReference: params.externalReference,
      sourceEntity: params.sourceEntity,
      sourceEntityId: params.sourceEntityId,
    });

    return null;
  }

  async logUnknown(params: {
    tenantId: string;
    externalReference: string;
    sourceEntity?: string;
    sourceEntityId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    this.logger.warn(
      `CatalogResolutionService.logUnknown — unknown catalogue id=${params.externalReference} source=${params.sourceEntity ?? 'unknown'}`,
    );

    await this.db.insert(externalReferenceResolutionLog).values({
      tenantId: params.tenantId,
      domain: CATALOG_ITEM_DOMAIN,
      externalReference: params.externalReference,
      sourceEntity: params.sourceEntity,
      sourceEntityId: params.sourceEntityId,
      resolutionAction: 'unknown_catalog_id',
      details: params.details ?? {},
    });
  }

  async listUnresolved(params: { limit?: number }) {
    const tenantId = this.tenantContext.getTenantId();
    const limit = Math.min(params.limit ?? 50, 200);
    return this.db
      .select()
      .from(externalReferenceResolutionLog)
      .where(
        and(
          eq(externalReferenceResolutionLog.tenantId, tenantId),
          eq(externalReferenceResolutionLog.domain, CATALOG_ITEM_DOMAIN),
          eq(externalReferenceResolutionLog.resolutionAction, 'unknown_catalog_id'),
        ),
      )
      .orderBy(desc(externalReferenceResolutionLog.createdAt))
      .limit(limit);
  }
}
