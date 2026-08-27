import type { WorkOrder } from '@/types/api';
import { asString, pick, type Dict } from '@/components/shared/detail';

/**
 * Crunchwork purchase-order number used to create the work order (e.g. 8108).
 * Projected onto `work_orders.work_order_number` from CW `purchaseOrderNumber`.
 */
export function workOrderInsurerPo(
  wo: Pick<WorkOrder, 'workOrderNumber' | 'internalNumber' | 'workOrderPayload'>,
): string | undefined {
  const payload = (wo.workOrderPayload ?? {}) as Dict;
  const fromPayload = asString(pick(payload, 'purchaseOrderNumber'));
  const fromColumn = wo.workOrderNumber?.trim() || undefined;
  const value = fromPayload ?? fromColumn;
  if (!value) return undefined;
  const internal = wo.internalNumber?.trim();
  if (internal && value === internal) return undefined;
  if (/^wo-\d+$/i.test(value)) return undefined;
  return value;
}
