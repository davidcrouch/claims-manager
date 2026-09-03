import type { ApiGroup, ApiItem } from '@/components/line-items/lib/types';
import { computeItemMoney } from '@/components/line-items/lib/money';
import type { Invoice } from '@/types/api';

const PREFIX = 'frontend:invoice-line-progress';

const REJECTED_STATUSES = new Set(['rejected', 'declined', 'cancelled', 'canceled']);

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

export function lineAmountFromItem(
  item: ApiItem & { totals?: Record<string, unknown> },
): number {
  const direct = asNumber(item.total);
  if (direct != null) return direct;

  const nested = asNumber(item.totals?.total);
  if (nested != null) return nested;

  return computeItemMoney(item, undefined, true, true).total;
}

export function isRejectedInvoice(invoice: Invoice): boolean {
  const name = (invoice.status?.name ?? '').trim().toLowerCase();
  return REJECTED_STATUSES.has(name);
}

/** Header sum of prior invoices on the same work order (excludes rejected). */
export function sumPriorInvoiceTotals(invoices: Invoice[]): number {
  let sum = 0;
  for (const inv of invoices) {
    if (isRejectedInvoice(inv)) continue;
    const n = asNumber(inv.totalAmount);
    if (n != null) sum += n;
  }
  return sum;
}

function readInvoicedAmountOverrides(
  payload: Record<string, unknown> | null | undefined,
): Map<string, number> {
  const raw = payload?.invoicedAmounts;
  const map = new Map<string, number>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = asNumber(value);
    if (n != null) map.set(key, n);
  }
  return map;
}

/** Aggregate previously-invoiced amounts from sibling invoices' payload maps. */
export function buildPreviouslyInvoicedMap(siblingInvoices: Invoice[]): Map<string, number> {
  const previouslyByKey = new Map<string, number>();
  for (const inv of siblingInvoices) {
    if (isRejectedInvoice(inv)) continue;
    const amounts = readInvoicedAmountOverrides(
      (inv.invoicePayload ?? {}) as Record<string, unknown>,
    );
    for (const [key, amount] of amounts) {
      previouslyByKey.set(key, (previouslyByKey.get(key) ?? 0) + amount);
    }
  }
  return previouslyByKey;
}

function lookupAmount(map: Map<string, number>, item: ApiItem): number {
  for (const key of itemMatchKeys(item)) {
    const value = map.get(key);
    if (value != null) return value;
  }
  return 0;
}

function applyToItem(
  item: ApiItem,
  previouslyByKey: Map<string, number>,
  invoicedByKey?: Map<string, number>,
): ApiItem {
  const previously = lookupAmount(previouslyByKey, item);
  const lineTotal = lineAmountFromItem(item);
  const remaining = Math.max(0, lineTotal - previously);
  const invoiced =
    invoicedByKey != null
      ? lookupAmount(invoicedByKey, item)
      : remaining;
  return {
    ...item,
    previouslyInvoiced: previously,
    invoiced,
  };
}

/** Stamp previouslyInvoiced (+ optional this-draft invoiced) onto every item. */
export function applyInvoiceProgressToGroups(
  groups: ApiGroup[],
  previouslyByKey: Map<string, number>,
  invoicedByKey?: Map<string, number>,
): ApiGroup[] {
  try {
    return groups.map((group) => ({
      ...group,
      items: group.items?.map((item) =>
        applyToItem(item, previouslyByKey, invoicedByKey),
      ),
      combos: group.combos?.map((combo) => ({
        ...combo,
        items: combo.items?.map((item) =>
          applyToItem(item, previouslyByKey, invoicedByKey),
        ),
      })),
      scopes: group.scopes?.map((scope) => ({
        ...scope,
        items: scope.items?.map((item) =>
          applyToItem(item, previouslyByKey, invoicedByKey),
        ),
        combos: scope.combos?.map((combo) => ({
          ...combo,
          items: combo.items?.map((item) =>
            applyToItem(item, previouslyByKey, invoicedByKey),
          ),
        })),
      })),
    }));
  } catch (err) {
    console.error(`${PREFIX}.applyInvoiceProgressToGroups`, err);
    return groups;
  }
}

export type FlatLineRef = {
  item: ApiItem;
  groupLabel: string;
  lineTotal: number;
  previouslyInvoiced: number;
  remaining: number;
};

/** Flatten group tree into allocatable line refs. */
export function flattenAllocatableLines(groups: ApiGroup[]): FlatLineRef[] {
  const rows: FlatLineRef[] = [];

  const visit = (item: ApiItem, groupLabel: string) => {
    const lineTotal = lineAmountFromItem(item);
    const previouslyInvoiced = item.previouslyInvoiced ?? 0;
    const remaining = Math.max(0, lineTotal - previouslyInvoiced);
    rows.push({
      item,
      groupLabel,
      lineTotal,
      previouslyInvoiced,
      remaining,
    });
  };

  for (const group of groups) {
    const label =
      group.groupLabel?.name?.trim() ||
      group.groupLabel?.externalReference?.trim() ||
      group.component?.trim() ||
      'Items';
    for (const item of group.items ?? []) visit(item, label);
    for (const combo of group.combos ?? []) {
      for (const item of combo.items ?? []) visit(item, label);
    }
    for (const scope of group.scopes ?? []) {
      for (const item of scope.items ?? []) visit(item, label);
      for (const combo of scope.combos ?? []) {
        for (const item of combo.items ?? []) visit(item, label);
      }
    }
  }

  return rows;
}

/** Remaining dollars per line (after prior invoices). */
export function remainingAmountsByKey(groups: ApiGroup[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of flattenAllocatableLines(groups)) {
    for (const key of itemMatchKeys(row.item)) {
      map.set(key, row.remaining);
    }
  }
  return map;
}

/**
 * Apply a flat percent of each line's remaining amount.
 * Returns a map keyed by all match keys for each item.
 */
export function applyFlatPercentToRemaining(params: {
  groups: ApiGroup[];
  percent: number;
}): Map<string, number> {
  const pct = Math.max(0, Math.min(100, params.percent)) / 100;
  const map = new Map<string, number>();
  for (const row of flattenAllocatableLines(params.groups)) {
    const amount = Math.round(row.remaining * pct * 100) / 100;
    for (const key of itemMatchKeys(row.item)) {
      map.set(key, amount);
    }
  }
  return map;
}

/** Build payload invoicedAmounts object from a key→amount map (dedupe by primary key). */
export function invoicedAmountsRecordFromMap(
  amountsByKey: Map<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, amount] of amountsByKey) {
    out[key] = amount;
  }
  return out;
}

/** Sum unique primary-key amounts (avoid double-counting multi-key entries). */
export function sumUniqueInvoicedAmounts(
  amountsByKey: Map<string, number>,
  groups: ApiGroup[],
): number {
  let sum = 0;
  const seen = new Set<string>();
  for (const row of flattenAllocatableLines(groups)) {
    const keys = itemMatchKeys(row.item);
    const primary = keys[0];
    if (!primary || seen.has(primary)) continue;
    seen.add(primary);
    const amount = lookupAmount(amountsByKey, row.item);
    sum += amount;
  }
  return Math.round(sum * 100) / 100;
}

export function amountsWithinTolerance(
  a: number,
  b: number,
  tolerance = 0.02,
): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Merge edited amounts for items into a key map (all match keys). */
export function setItemAmountInMap(params: {
  map: Map<string, number>;
  item: ApiItem;
  amount: number;
}): Map<string, number> {
  const next = new Map(params.map);
  for (const key of itemMatchKeys(params.item)) {
    next.set(key, params.amount);
  }
  return next;
}
