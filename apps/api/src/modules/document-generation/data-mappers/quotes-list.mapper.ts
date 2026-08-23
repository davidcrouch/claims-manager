import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { quotes, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate, formatCurrency, displayRecordNumber, internalNumberField } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class QuotesListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.tenantId, params.tenantId)))
      .orderBy(desc(quotes.createdAt))
      .limit(500);

    const items = rows.map((q) => ({
      quote_number: displayRecordNumber(q.internalNumber, q.quoteNumber),
      internal_number: internalNumberField(q.internalNumber),
      name: q.name ?? '',
      date: formatDate(q.quoteDate),
      total_amount: formatCurrency(q.totalAmount),
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Estimates Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
