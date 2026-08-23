import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { invoices, purchaseOrders, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate, displayRecordNumber, internalNumberField } from './base.mapper';
import { templateGroupsFromPayload } from './line-items.helper';
import { PurchaseOrderMapper } from './purchase-order.mapper';
import { WorkOrderMapper } from './work-order.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class InvoiceMapper implements DataMapper {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly purchaseOrderMapper: PurchaseOrderMapper,
    private readonly workOrderMapper: WorkOrderMapper,
  ) {}

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

    const groups = await this.resolveGroups({
      tenantId: params.tenantId,
      invoice,
    });

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
      groups,
    };
  }

  private async resolveGroups(params: {
    tenantId: string;
    invoice: typeof invoices.$inferSelect;
  }): Promise<TemplateData['groups']> {
    const fromPayload = templateGroupsFromPayload(params.invoice.invoicePayload);
    if (fromPayload) return fromPayload;

    if (params.invoice.purchaseOrderId) {
      const poData = await this.purchaseOrderMapper.aggregate({
        tenantId: params.tenantId,
        entityId: params.invoice.purchaseOrderId,
      });
      if (Array.isArray(poData.groups) && poData.groups.length > 0) {
        return poData.groups;
      }
    }

    if (params.invoice.workOrderId) {
      const woData = await this.workOrderMapper.aggregate({
        tenantId: params.tenantId,
        entityId: params.invoice.workOrderId,
      });
      if (Array.isArray(woData.groups) && woData.groups.length > 0) {
        return woData.groups;
      }
    }

    return [];
  }
}
