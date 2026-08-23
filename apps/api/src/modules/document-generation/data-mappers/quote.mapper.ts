import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  quotes,
  quoteGroups,
  quoteCombos,
  quoteItems,
  organizations,
} from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate, displayRecordNumber, internalNumberField } from './base.mapper';
import { buildTemplateGroups, fetchGroupLabelNameMap } from './line-items.helper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class QuoteMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [quote] = await this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, params.entityId), eq(quotes.tenantId, params.tenantId)));
    if (!quote) throw new NotFoundException('Quote not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const groups = await this.db
      .select()
      .from(quoteGroups)
      .where(and(eq(quoteGroups.quoteId, params.entityId), eq(quoteGroups.tenantId, params.tenantId)))
      .orderBy(asc(quoteGroups.sortIndex));

    const combos = await this.db
      .select()
      .from(quoteCombos)
      .where(and(eq(quoteCombos.tenantId, params.tenantId), isNull(quoteCombos.deletedAt)))
      .orderBy(asc(quoteCombos.sortIndex));

    const items = await this.db
      .select()
      .from(quoteItems)
      .where(and(eq(quoteItems.tenantId, params.tenantId), isNull(quoteItems.deletedAt)))
      .orderBy(asc(quoteItems.sortIndex));

    const quoteTo = quote.quoteTo as Record<string, unknown>;
    const quoteFrom = quote.quoteFrom as Record<string, unknown>;
    const quoteFor = quote.quoteFor as Record<string, unknown>;

    const groupLabelNames = await fetchGroupLabelNameMap(this.db, groups);
    const groupData = buildTemplateGroups({
      groups,
      combos: combos.map((c) => ({ ...c, groupId: c.quoteGroupId })),
      items: items.map((i) => ({
        ...i,
        groupId: i.quoteGroupId,
        comboId: i.quoteComboId,
      })),
      groupLabelNames,
    });

    return {
      company_name: org?.name ?? '',
      quote_number: displayRecordNumber(quote.internalNumber, quote.quoteNumber),
      internal_number: internalNumberField(quote.internalNumber),
      quote_name: quote.name ?? '',
      quote_date: formatDate(quote.quoteDate),
      quote_reference: quote.reference ?? '',
      quote_note: quote.note ?? '',
      expires_in_days: quote.expiresInDays?.toString() ?? '',
      estimated_start_date: formatDate(quote.estimatedStartDate),
      estimated_completion_date: formatDate(quote.estimatedCompletionDate),
      quote_to_name: quote.quoteToName ?? (quoteTo?.name as string) ?? '',
      quote_to_email: quote.quoteToEmail ?? (quoteTo?.email as string) ?? '',
      quote_to_address: (quoteTo?.address as string) ?? '',
      quote_for_name: quote.quoteForName ?? (quoteFor?.name as string) ?? '',
      quote_from_name: (quoteFrom?.name as string) ?? '',
      quote_from_address: (quoteFrom?.address as string) ?? '',
      sub_total: formatCurrency(quote.subTotal),
      total_tax: formatCurrency(quote.totalTax),
      total_amount: formatCurrency(quote.totalAmount),
      groups: groupData,
    };
  }
}
