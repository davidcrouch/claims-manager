import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  workOrders,
  workOrderGroups,
  workOrderItems,
  organizations,
} from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate, formatQuantity } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class WorkOrderMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [wo] = await this.db
      .select()
      .from(workOrders)
      .where(
        and(eq(workOrders.id, params.entityId), eq(workOrders.tenantId, params.tenantId)),
      );
    if (!wo) throw new NotFoundException('Work order not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const groups = await this.db
      .select()
      .from(workOrderGroups)
      .where(
        and(
          eq(workOrderGroups.workOrderId, params.entityId),
          eq(workOrderGroups.tenantId, params.tenantId),
          isNull(workOrderGroups.deletedAt),
        ),
      )
      .orderBy(asc(workOrderGroups.sortIndex));

    const items = await this.db
      .select()
      .from(workOrderItems)
      .where(
        and(eq(workOrderItems.tenantId, params.tenantId), isNull(workOrderItems.deletedAt)),
      )
      .orderBy(asc(workOrderItems.sortIndex));

    const woTo = wo.woTo as Record<string, unknown>;
    const woFrom = wo.woFrom as Record<string, unknown>;
    const woFor = wo.woFor as Record<string, unknown>;

    const groupData = groups.map((g) => {
      const groupItems = items
        .filter((i) => i.workOrderGroupId === g.id)
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
      wo_number: wo.workOrderNumber ?? '',
      wo_name: wo.name ?? '',
      start_date: formatDate(wo.startDate),
      end_date: formatDate(wo.endDate),
      note: wo.note ?? '',
      scope_of_work: wo.scopeOfWork ?? '',
      wo_to_name: (woTo?.name as string) ?? '',
      wo_to_email: wo.woToEmail ?? (woTo?.email as string) ?? '',
      wo_to_address: (woTo?.address as string) ?? '',
      wo_for_name: wo.woForName ?? (woFor?.name as string) ?? '',
      wo_from_name: (woFrom?.name as string) ?? '',
      wo_from_address: (woFrom?.address as string) ?? '',
      total_amount: formatCurrency(wo.totalAmount),
      adjusted_total: formatCurrency(wo.adjustedTotal),
      groups: groupData,
    };
  }
}
