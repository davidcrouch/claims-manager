import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { bills, purchaseOrders, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class BillMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [bill] = await this.db
      .select()
      .from(bills)
      .where(and(eq(bills.id, params.entityId), eq(bills.tenantId, params.tenantId)));
    if (!bill) throw new NotFoundException('Bill not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    let poNumber = '';
    if (bill.purchaseOrderId) {
      const [po] = await this.db
        .select({ purchaseOrderNumber: purchaseOrders.purchaseOrderNumber })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, bill.purchaseOrderId));
      poNumber = po?.purchaseOrderNumber ?? '';
    }

    return {
      company_name: org?.name ?? '',
      bill_number: bill.billNumber ?? '',
      invoice_number: bill.sourceExternalReference ?? '',
      po_number: poNumber,
      issue_date: formatDate(bill.issueDate),
      received_date: formatDate(bill.receivedDate),
      due_date: formatDate(bill.dueDate),
      payment_date: formatDate(bill.paymentDate),
      comments: bill.comments ?? '',
      sub_total: formatCurrency(bill.subTotal),
      total_tax: formatCurrency(bill.totalTax),
      total_amount: formatCurrency(bill.totalAmount),
    };
  }
}
