import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { rfqs, rfqGroups, rfqItems, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate, formatQuantity } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class RfqMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [rfq] = await this.db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.id, params.entityId), eq(rfqs.tenantId, params.tenantId)));
    if (!rfq) throw new NotFoundException('RFQ not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const groups = await this.db
      .select()
      .from(rfqGroups)
      .where(
        and(eq(rfqGroups.rfqId, params.entityId), eq(rfqGroups.tenantId, params.tenantId)),
      )
      .orderBy(asc(rfqGroups.sortIndex));

    const items = await this.db
      .select()
      .from(rfqItems)
      .where(eq(rfqItems.tenantId, params.tenantId))
      .orderBy(asc(rfqItems.sortIndex));

    const rfqTo = rfq.rfqTo as Record<string, unknown>;
    const rfqFrom = rfq.rfqFrom as Record<string, unknown>;

    const groupData = groups.map((g) => {
      const groupItems = items
        .filter((i) => i.rfqGroupId === g.id)
        .map((i) => ({
          item_name: i.name ?? '',
          item_description: i.description ?? '',
          item_category: i.category ?? '',
          item_quantity: formatQuantity(i.quantity),
          item_unit_cost: formatCurrency(i.unitCost),
          item_tax: formatCurrency(i.tax),
          item_total: formatCurrency(
            i.unitCost && i.quantity ? parseFloat(i.unitCost) * parseFloat(i.quantity) : 0,
          ),
        }));

      return {
        group_name: g.description ?? '',
        group_subtotal: formatCurrency(
          (g.totals as Record<string, unknown>)?.subTotal as string ?? '0',
        ),
        items: groupItems,
      };
    });

    return {
      company_name: org?.name ?? '',
      rfq_number: rfq.rfqNumber ?? '',
      rfq_name: rfq.name ?? '',
      note: rfq.note ?? '',
      sent_date: formatDate(rfq.sentDate),
      due_date: formatDate(rfq.dueDate),
      received_date: formatDate(rfq.receivedDate),
      include_pricing: rfq.includePricing ? 'Yes' : 'No',
      include_quantities: rfq.includeQuantities ? 'Yes' : 'No',
      rfq_to_name: rfq.rfqToName ?? (rfqTo?.name as string) ?? '',
      rfq_to_email: rfq.rfqToEmail ?? (rfqTo?.email as string) ?? '',
      rfq_from_name: (rfqFrom?.name as string) ?? '',
      groups: groupData,
    };
  }
}
