import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  catalogItems,
  quoteCombos,
  quoteGroups,
  quoteItems,
  quotes,
} from '../../../database/schema';
import { CatalogPricingService } from './catalog-pricing.service';
import { TenantContext } from '../../../tenant/tenant-context';
import { parseDecimal } from '../catalog.utils';

export interface CatalogMismatchEntry {
  quoteItemId: string;
  catalogItemId: string;
  catalogCode: string | null;
  catalogName: string | null;
  property: string;
  snapshotValue: string;
  catalogValue: string;
}

@Injectable()
export class CatalogMismatchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly pricingService: CatalogPricingService,
    private readonly tenantContext: TenantContext,
  ) {}

  async scanQuote(params: {
    quoteId: string;
    apply?: boolean;
  }): Promise<{ mismatches: CatalogMismatchEntry[]; updatedCount: number }> {
    const tenantId = this.tenantContext.getTenantId();

    const [quote] = await this.db
      .select({ id: quotes.id })
      .from(quotes)
      .where(
        and(eq(quotes.id, params.quoteId), eq(quotes.tenantId, tenantId), isNull(quotes.deletedAt)),
      )
      .limit(1);
    if (!quote) throw new NotFoundException('Quote not found');

    const quoteLines = await this.db
      .select({
        line: quoteItems,
        code: catalogItems.code,
        name: catalogItems.name,
      })
      .from(quoteItems)
      .leftJoin(catalogItems, eq(quoteItems.catalogItemId, catalogItems.id))
      .where(
        and(
          eq(quoteItems.tenantId, tenantId),
          isNotNull(quoteItems.catalogItemId),
          isNull(quoteItems.deletedAt),
        ),
      );

    const mismatches: CatalogMismatchEntry[] = [];
    let updatedCount = 0;

    for (const row of quoteLines) {
      const line = row.line;
      const belongs = await this.lineBelongsToQuote({
        quoteId: params.quoteId,
        lineId: line.id,
        tenantId,
      });
      if (!belongs) continue;

      let currentUnitCost: string;
      try {
        const resolved = await this.pricingService.resolveUnitCost({
          tenantId,
          itemId: line.catalogItemId!,
        });
        currentUnitCost = resolved.unitCost;
      } catch {
        continue;
      }

      const snapshotCost = line.unitCost ?? '0';
      if (parseDecimal(snapshotCost) === parseDecimal(currentUnitCost)) {
        if (params.apply && Array.isArray(line.mismatches) && line.mismatches.length > 0) {
          await this.db.update(quoteItems).set({ mismatches: [] }).where(eq(quoteItems.id, line.id));
          updatedCount++;
        }
        continue;
      }

      mismatches.push({
        quoteItemId: line.id,
        catalogItemId: line.catalogItemId!,
        catalogCode: row.code,
        catalogName: row.name,
        property: 'unitCost',
        snapshotValue: snapshotCost,
        catalogValue: currentUnitCost,
      });

      if (params.apply) {
        await this.db
          .update(quoteItems)
          .set({
            mismatches: [
              {
                property: 'unitCost',
                catalogValue: currentUnitCost,
                snapshotValue: snapshotCost,
              },
            ],
          })
          .where(eq(quoteItems.id, line.id));
        updatedCount++;
      }
    }

    return { mismatches, updatedCount };
  }

  private async lineBelongsToQuote(params: {
    quoteId: string;
    lineId: string;
    tenantId: string;
  }): Promise<boolean> {
    const [direct] = await this.db
      .select({ id: quoteItems.id })
      .from(quoteItems)
      .innerJoin(quoteGroups, eq(quoteItems.quoteGroupId, quoteGroups.id))
      .where(
        and(
          eq(quoteItems.id, params.lineId),
          eq(quoteGroups.quoteId, params.quoteId),
          eq(quoteItems.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    if (direct) return true;

    const [viaCombo] = await this.db
      .select({ id: quoteItems.id })
      .from(quoteItems)
      .innerJoin(quoteCombos, eq(quoteItems.quoteComboId, quoteCombos.id))
      .innerJoin(quoteGroups, eq(quoteCombos.quoteGroupId, quoteGroups.id))
      .where(
        and(
          eq(quoteItems.id, params.lineId),
          eq(quoteGroups.quoteId, params.quoteId),
          eq(quoteItems.tenantId, params.tenantId),
        ),
      )
      .limit(1);

    return !!viaCombo;
  }
}
