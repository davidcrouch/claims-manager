import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { invoices, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate, formatCurrency } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class InvoicesListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.tenantId, params.tenantId)))
      .orderBy(desc(invoices.createdAt))
      .limit(500);

    const items = rows.map((i) => ({
      invoice_number: i.invoiceNumber ?? '',
      name: '',
      date: formatDate(i.issueDate),
      total_amount: formatCurrency(i.totalAmount),
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Invoices Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
