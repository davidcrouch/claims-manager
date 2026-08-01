import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderGroups,
  purchaseOrderItems,
  organizations,
} from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate, formatQuantity } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class PurchaseOrderMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(
        and(eq(purchaseOrders.id, params.entityId), eq(purchaseOrders.tenantId, params.tenantId)),
      );
    if (!po) throw new NotFoundException('Purchase order not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const groups = await this.db
      .select()
      .from(purchaseOrderGroups)
      .where(
        and(
          eq(purchaseOrderGroups.purchaseOrderId, params.entityId),
          eq(purchaseOrderGroups.tenantId, params.tenantId),
          isNull(purchaseOrderGroups.deletedAt),
        ),
      )
      .orderBy(asc(purchaseOrderGroups.sortIndex));

    const items = await this.db
      .select()
      .from(purchaseOrderItems)
      .where(
        and(eq(purchaseOrderItems.tenantId, params.tenantId), isNull(purchaseOrderItems.deletedAt)),
      )
      .orderBy(asc(purchaseOrderItems.sortIndex));

    const poTo = po.poTo as Record<string, unknown>;
    const poFrom = po.poFrom as Record<string, unknown>;
    const poFor = po.poFor as Record<string, unknown>;

    const groupData = groups.map((g) => {
      const groupItems = items
        .filter((i) => i.purchaseOrderGroupId === g.id)
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
      po_number: po.purchaseOrderNumber ?? '',
      po_name: po.name ?? '',
      start_date: formatDate(po.startDate),
      end_date: formatDate(po.endDate),
      note: po.note ?? '',
      po_to_name: (poTo?.name as string) ?? '',
      po_to_email: po.poToEmail ?? (poTo?.email as string) ?? '',
      po_to_address: (poTo?.address as string) ?? '',
      po_for_name: po.poForName ?? (poFor?.name as string) ?? '',
      po_from_name: (poFrom?.name as string) ?? '',
      po_from_address: (poFrom?.address as string) ?? '',
      total_amount: formatCurrency(po.totalAmount),
      adjusted_total: formatCurrency(po.adjustedTotal),
      groups: groupData,
    };
  }
}
