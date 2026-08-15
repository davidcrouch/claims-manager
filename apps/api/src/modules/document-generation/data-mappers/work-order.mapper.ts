import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  workOrders,
  workOrderGroups,
  workOrderCombos,
  workOrderItems,
  organizations,
} from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate } from './base.mapper';
import { buildTemplateGroups } from './line-items.helper';
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

    const combos = await this.db
      .select()
      .from(workOrderCombos)
      .where(
        and(eq(workOrderCombos.tenantId, params.tenantId), isNull(workOrderCombos.deletedAt)),
      )
      .orderBy(asc(workOrderCombos.sortIndex));

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

    const groupData = buildTemplateGroups({
      groups,
      combos: combos.map((c) => ({ ...c, groupId: c.workOrderGroupId })),
      items: items.map((i) => ({
        ...i,
        groupId: i.workOrderGroupId,
        comboId: i.workOrderComboId,
      })),
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
