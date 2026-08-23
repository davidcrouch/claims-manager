import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderGroups,
  purchaseOrderCombos,
  purchaseOrderItems,
  organizations,
} from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate, displayRecordNumber, internalNumberField } from './base.mapper';
import { buildTemplateGroups, fetchGroupLabelNameMap } from './line-items.helper';
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

    const combos = await this.db
      .select()
      .from(purchaseOrderCombos)
      .where(
        and(
          eq(purchaseOrderCombos.tenantId, params.tenantId),
          isNull(purchaseOrderCombos.deletedAt),
        ),
      )
      .orderBy(asc(purchaseOrderCombos.sortIndex));

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

    const groupLabelNames = await fetchGroupLabelNameMap(this.db, groups);
    const groupData = buildTemplateGroups({
      groups,
      combos: combos.map((c) => ({ ...c, groupId: c.purchaseOrderGroupId })),
      items: items.map((i) => ({
        ...i,
        groupId: i.purchaseOrderGroupId,
        comboId: i.purchaseOrderComboId,
      })),
      groupLabelNames,
    });

    return {
      company_name: org?.name ?? '',
      po_number: displayRecordNumber(po.internalNumber, po.purchaseOrderNumber),
      internal_number: internalNumberField(po.internalNumber),
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
