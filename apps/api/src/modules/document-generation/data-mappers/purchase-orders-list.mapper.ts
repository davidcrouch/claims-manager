import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { purchaseOrders, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate, formatCurrency, displayRecordNumber, internalNumberField } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class PurchaseOrdersListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.tenantId, params.tenantId), isNull(purchaseOrders.deletedAt)))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(500);

    const items = rows.map((p) => ({
      po_number: displayRecordNumber(p.internalNumber, p.purchaseOrderNumber),
      internal_number: internalNumberField(p.internalNumber),
      name: p.name ?? '',
      date: formatDate(p.startDate),
      total_amount: formatCurrency(p.totalAmount),
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Purchase Orders Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
