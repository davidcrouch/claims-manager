import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { invoices, purchaseOrders, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate, displayRecordNumber, internalNumberField } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class InvoiceMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [invoice] = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, params.entityId), eq(invoices.tenantId, params.tenantId)));
    if (!invoice) throw new NotFoundException('Invoice not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    let po: Record<string, unknown> | null = null;
    if (invoice.purchaseOrderId) {
      const [poRow] = await this.db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, invoice.purchaseOrderId));
      po = poRow as unknown as Record<string, unknown>;
    }

    return {
      company_name: org?.name ?? '',
      invoice_number: displayRecordNumber(invoice.internalNumber, invoice.invoiceNumber),
      internal_number: internalNumberField(invoice.internalNumber),
      issue_date: formatDate(invoice.issueDate),
      received_date: formatDate(invoice.receivedDate),
      comments: invoice.comments ?? '',
      sub_total: formatCurrency(invoice.subTotal),
      total_tax: formatCurrency(invoice.totalTax),
      total_amount: formatCurrency(invoice.totalAmount),
      excess_amount: formatCurrency(invoice.excessAmount),
      po_number: displayRecordNumber(
        po?.internalNumber as string | null | undefined,
        po?.purchaseOrderNumber as string | null | undefined,
      ),
      po_internal_number: internalNumberField(po?.internalNumber as string | null | undefined),
      po_name: (po?.name as string) ?? '',
    };
  }
}
