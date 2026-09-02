import type { ApiGroup, ApiItem } from '@/components/line-items/lib/types';
import { computeItemMoney } from '@/components/line-items/lib/money';
import { groupsFromDocumentPayload } from '@/components/line-items/lib/parse';
import type { Bill } from '@/types/api';

const PREFIX = 'frontend:bill-line-progress';

export type ProgressMaps = {
  invoicedByKey: Map<string, number>;
  previouslyByKey: Map<string, number>;
};

const REJECTED_STATUSES = new Set(['rejected', 'declined']);

/** Stable match keys for a line item (first hit wins when looking up). */
export function itemMatchKeys(item: ApiItem): string[] {
  const keys: string[] = [];
  if (item.id) keys.push(`id:${item.id}`);
  if (item.catalogItemId) keys.push(`catalog:${item.catalogItemId}`);
  const name = (item.name ?? '').trim().toLowerCase();
  if (name) {
    const index = item.index ?? 0;
    keys.push(`name:${name}:${index}`);
  }
  return keys;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Dollar amount claimed for a payload / mapped line item. */
export function lineAmountFromItem(item: ApiItem & { totals?: Record<string, unknown> }): number | null {
  if (item.completed === false) return null;

  const direct = asNumber(item.total);
  if (direct != null) return direct;

  const nested = asNumber(item.totals?.total);
  if (nested != null) return nested;

  const money = computeItemMoney(item, undefined, true, true);
  return money.total;
}

function collectItemAmounts(groups: ApiGroup[]): Map<string, number> {
  const amounts = new Map<string, number>();

  const visit = (item: ApiItem) => {
    const amount = lineAmountFromItem(item);
    if (amount == null) return;
    for (const key of itemMatchKeys(item)) {
      // Same amount under every match key so PO lines can resolve via id / catalog / name.
      amounts.set(key, (amounts.get(key) ?? 0) + amount);
    }
  };

  for (const group of groups) {
    for (const item of group.items ?? []) visit(item);
    for (const combo of group.combos ?? []) {
      for (const item of combo.items ?? []) visit(item);
    }
    for (const scope of group.scopes ?? []) {
      for (const item of scope.items ?? []) visit(item);
      for (const combo of scope.combos ?? []) {
        for (const item of combo.items ?? []) visit(item);
      }
    }
  }

  return amounts;
}

function billTimestamp(bill: Bill): number {
  const raw = bill.issueDate ?? bill.receivedDate ?? bill.createdAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function isRejectedBill(bill: Bill): boolean {
  const name = (bill.status?.name ?? '').trim().toLowerCase();
  const ext = (bill.status?.externalReference ?? '').trim().toLowerCase();
  return REJECTED_STATUSES.has(name) || REJECTED_STATUSES.has(ext);
}

function lookupAmount(map: Map<string, number>, item: ApiItem): number {
  for (const key of itemMatchKeys(item)) {
    const value = map.get(key);
    if (value != null) return value;
  }
  return 0;
}

function readInvoicedAmountOverrides(payload: Record<string, unknown> | null | undefined): Map<string, number> {
  const raw = payload?.invoicedAmounts;
  const map = new Map<string, number>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = asNumber(value);
    if (n != null) map.set(key, n);
  }
  return map;
}

function mergeAmountMaps(base: Map<string, number>, overlay: Map<string, number>): Map<string, number> {
  if (overlay.size === 0) return base;
  const next = new Map(base);
  for (const [key, value] of overlay) {
    next.set(key, value);
  }
  return next;
}

function collectBillInvoicedAmounts(bill: Bill): Map<string, number> {
  const payload = (bill.billPayload ?? {}) as Record<string, unknown>;
  const fromGroups = collectItemAmounts(groupsFromDocumentPayload(payload));
  return mergeAmountMaps(fromGroups, readInvoicedAmountOverrides(payload));
}

/**
 * Build invoiced (this bill) and previously-invoiced (earlier sibling bills) maps
 * keyed by item match keys from each bill's payload groups (+ invoicedAmounts overrides).
 */
export function buildProgressMaps(params: {
  currentBill: Bill;
  siblingBills: Bill[];
}): ProgressMaps {
  const invoicedByKey = collectBillInvoicedAmounts(params.currentBill);

  const currentTs = billTimestamp(params.currentBill);
  const previouslyByKey = new Map<string, number>();

  const earlier = params.siblingBills
    .filter((b) => b.id !== params.currentBill.id && !isRejectedBill(b))
    .filter((b) => billTimestamp(b) < currentTs || (billTimestamp(b) === currentTs && b.id < params.currentBill.id))
    .sort((a, b) => billTimestamp(a) - billTimestamp(b) || a.id.localeCompare(b.id));

  for (const bill of earlier) {
    const amounts = collectBillInvoicedAmounts(bill);
    for (const [key, amount] of amounts) {
      previouslyByKey.set(key, (previouslyByKey.get(key) ?? 0) + amount);
    }
  }

  return { invoicedByKey, previouslyByKey };
}

/** Primary storage key for an item's invoiced amount override. */
export function primaryInvoicedKey(item: ApiItem): string | null {
  return itemMatchKeys(item)[0] ?? null;
}

/** Merge edited invoiced amounts into billPayload.invoicedAmounts (all match keys). */
export function mergeInvoicedAmountsIntoPayload(params: {
  billPayload: Record<string, unknown> | null | undefined;
  amountsByItem: Array<{ item: ApiItem; amount: number }>;
}): Record<string, unknown> {
  const base = { ...(params.billPayload ?? {}) };
  const existing =
    base.invoicedAmounts && typeof base.invoicedAmounts === 'object' && !Array.isArray(base.invoicedAmounts)
      ? { ...(base.invoicedAmounts as Record<string, number>) }
      : {};

  for (const { item, amount } of params.amountsByItem) {
    const keys = itemMatchKeys(item);
    if (keys.length === 0) continue;
    for (const key of keys) {
      existing[key] = amount;
    }
  }

  base.invoicedAmounts = existing;
  return base;
}

function applyToItem(item: ApiItem, maps: ProgressMaps, noPoFallback: boolean): ApiItem {
  if (noPoFallback) {
    const amount = lineAmountFromItem(item) ?? 0;
    return { ...item, invoiced: amount, previouslyInvoiced: 0 };
  }
  return {
    ...item,
    invoiced: lookupAmount(maps.invoicedByKey, item),
    previouslyInvoiced: lookupAmount(maps.previouslyByKey, item),
  };
}

/** Attach invoiced / previouslyInvoiced onto every item in the group tree. */
export function applyProgressToGroups(
  groups: ApiGroup[],
  maps: ProgressMaps,
  options?: { noPoFallback?: boolean },
): ApiGroup[] {
  const noPoFallback = options?.noPoFallback === true;
  try {
    return groups.map((group) => ({
      ...group,
      items: group.items?.map((item) => applyToItem(item, maps, noPoFallback)),
      combos: group.combos?.map((combo) => ({
        ...combo,
        items: combo.items?.map((item) => applyToItem(item, maps, noPoFallback)),
      })),
      scopes: group.scopes?.map((scope) => ({
        ...scope,
        items: scope.items?.map((item) => applyToItem(item, maps, noPoFallback)),
        combos: scope.combos?.map((combo) => ({
          ...combo,
          items: combo.items?.map((item) => applyToItem(item, maps, noPoFallback)),
        })),
      })),
    }));
  } catch (err) {
    console.error(`${PREFIX}.applyProgressToGroups`, err);
    return groups;
  }
}
