import { inArray } from 'drizzle-orm';
import type { DrizzleDB } from '../../../database/drizzle.module';
import { lookupValues } from '../../../database/schema';
import {
  isScopeComboPayload,
  parentComboIdFromPayload,
} from '../../catalog/catalog.utils';
import { formatCurrency, formatQuantity } from './base.mapper';

export interface LineItemLike {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  quantity?: string | null;
  unitCost?: string | null;
  tax?: string | null;
  note?: string | null;
}

export interface ComboLike {
  id: string;
  groupId: string;
  name?: string | null;
  description?: string | null;
  quantity?: string | null;
  note?: string | null;
  totals?: unknown;
  comboPayload?: unknown;
}

export interface GroupLike {
  id: string;
  description?: string | null;
  note?: string | null;
  totals?: unknown;
  dimensions?: unknown;
  groupLabelLookupId?: string | null;
  groupPayload?: unknown;
}

export interface TemplateGroupItem {
  item_name: string;
  item_description: string;
  item_category: string;
  item_quantity: string;
  item_unit_cost: string;
  item_tax: string;
  item_total: string;
  item_note: string;
}

export interface TemplateCombo {
  combo_name: string;
  combo_description: string;
  combo_quantity: string;
  combo_subtotal: string;
  combo_note: string;
  items: TemplateGroupItem[];
}

export interface TemplateScope {
  scope_name: string;
  scope_description: string;
  scope_quantity: string;
  scope_subtotal: string;
  scope_note: string;
  items: TemplateGroupItem[];
  combos: TemplateCombo[];
}

export interface TemplateGroup {
  group_name: string;
  group_note: string;
  group_subtotal: string;
  group_length: string;
  group_width: string;
  group_height: string;
  group_perimeter: string;
  items: TemplateGroupItem[];
  combos: TemplateCombo[];
  scopes: TemplateScope[];
}

function formatDimension(value: unknown): string {
  if (value == null || value === '') return '';
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? String(parsed) : '';
}

function dimensionFields(
  dimensions: unknown,
): Pick<TemplateGroup, 'group_length' | 'group_width' | 'group_height' | 'group_perimeter'> {
  const record = (dimensions as Record<string, unknown> | null) ?? {};
  return {
    group_length: formatDimension(record.length),
    group_width: formatDimension(record.width),
    group_height: formatDimension(record.height),
    group_perimeter: formatDimension(record.perimeter),
  };
}

export function resolveGroupDisplayName(
  group: GroupLike,
  groupLabelNames?: Map<string, string>,
): string {
  if (group.groupLabelLookupId && groupLabelNames?.has(group.groupLabelLookupId)) {
    const labelName = groupLabelNames.get(group.groupLabelLookupId)?.trim();
    if (labelName) return labelName;
  }

  const payload = (group.groupPayload as Record<string, unknown> | null) ?? {};
  const groupLabel = payload.groupLabel as Record<string, unknown> | undefined;
  const fromPayload =
    (typeof payload.groupLabelName === 'string' && payload.groupLabelName.trim()) ||
    (typeof groupLabel?.name === 'string' && groupLabel.name.trim()) ||
    '';

  if (fromPayload) return fromPayload;
  return group.description?.trim() ?? '';
}

export async function fetchGroupLabelNameMap(
  db: DrizzleDB,
  groups: Array<{ groupLabelLookupId?: string | null }>,
): Promise<Map<string, string>> {
  const lookupIds = [
    ...new Set(
      groups
        .map((group) => group.groupLabelLookupId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];
  if (lookupIds.length === 0) return new Map();

  const rows = await db
    .select({ id: lookupValues.id, name: lookupValues.name })
    .from(lookupValues)
    .where(inArray(lookupValues.id, lookupIds));

  return new Map(
    rows.map((row) => [row.id, row.name?.trim() ? row.name.trim() : '']),
  );
}

function mapItem(i: LineItemLike): TemplateGroupItem {
  return {
    item_name: i.name ?? '',
    item_description: i.description ?? '',
    item_category: i.category ?? '',
    item_quantity: formatQuantity(i.quantity),
    item_unit_cost: formatCurrency(i.unitCost),
    item_tax: formatCurrency(i.tax),
    item_total: formatCurrency(
      i.unitCost && i.quantity ? parseFloat(i.unitCost) * parseFloat(i.quantity) : 0,
    ),
    item_note: i.note ?? '',
  };
}

function subtotalFromTotals(totals: unknown): string {
  return formatCurrency(
    ((totals as Record<string, unknown> | null)?.subTotal as string) ?? '0',
  );
}

export interface StoredTotals {
  subtotal: number;
  tax: number;
  total: number;
}

export function parseStoredTotals(totals: unknown): StoredTotals {
  const record = (totals as Record<string, unknown> | null) ?? {};
  const subtotal = parseFloat(String(record.subTotal ?? '0')) || 0;
  const tax = parseFloat(String(record.totalTax ?? '0')) || 0;
  const total = parseFloat(String(record.total ?? '0')) || 0;
  return { subtotal, tax, total };
}

export function sumStoredTotals(
  records: Array<{ totals?: unknown }>,
): StoredTotals {
  return records.reduce(
    (acc, record) => {
      const parsed = parseStoredTotals(record.totals);
      acc.subtotal += parsed.subtotal;
      acc.tax += parsed.tax;
      acc.total += parsed.total;
      return acc;
    },
    { subtotal: 0, tax: 0, total: 0 },
  );
}

/**
 * Prefer persisted group totals; when those are empty (common on RFQs copied from
 * quotes), fall back to combo totals, then leaf line-item totals.
 */
export function rollupDocumentTotals(params: {
  groups: Array<{ totals?: unknown }>;
  combos: Array<{ totals?: unknown }>;
  items: Array<{ totals?: unknown }>;
}): StoredTotals {
  const fromGroups = sumStoredTotals(params.groups);
  if (fromGroups.subtotal !== 0 || fromGroups.tax !== 0 || fromGroups.total !== 0) {
    return fromGroups;
  }

  const fromCombos = sumStoredTotals(params.combos);
  if (fromCombos.subtotal !== 0 || fromCombos.tax !== 0 || fromCombos.total !== 0) {
    return fromCombos;
  }

  const fromItems = sumStoredTotals(params.items);
  return {
    subtotal: fromItems.subtotal,
    tax: fromItems.tax,
    total:
      fromItems.total !== 0 ? fromItems.total : fromItems.subtotal + fromItems.tax,
  };
}

function mapCombo(combo: ComboLike, items: LineItemLike[]): TemplateCombo {
  return {
    combo_name: combo.name ?? '',
    combo_description: combo.description ?? '',
    combo_quantity: formatQuantity(combo.quantity),
    combo_subtotal: subtotalFromTotals(combo.totals),
    combo_note: combo.note ?? '',
    items: items.map(mapItem),
  };
}

/**
 * Nest group → direct items / top-level assemblies / scopes (with nested assemblies).
 * Combos with `combo_payload.kind === 'scope'` become scopes; assemblies under a
 * scope are identified via `combo_payload.parentComboId`.
 */
export function buildTemplateGroups(params: {
  groups: GroupLike[];
  combos: ComboLike[];
  items: Array<
    LineItemLike & {
      groupId: string | null;
      comboId: string | null;
    }
  >;
  groupLabelNames?: Map<string, string>;
}): TemplateGroup[] {
  const itemsByComboId = new Map<string, LineItemLike[]>();
  for (const item of params.items) {
    if (!item.comboId) continue;
    const list = itemsByComboId.get(item.comboId) ?? [];
    list.push(item);
    itemsByComboId.set(item.comboId, list);
  }

  return params.groups.map((group) => {
    const combosForGroup = params.combos.filter((c) => c.groupId === group.id);
    const scopes = combosForGroup.filter((c) => isScopeComboPayload(c.comboPayload));
    const assemblies = combosForGroup.filter((c) => !isScopeComboPayload(c.comboPayload));
    const topLevelAssemblies = assemblies.filter(
      (c) => !parentComboIdFromPayload(c.comboPayload),
    );

    return {
      group_name: resolveGroupDisplayName(group, params.groupLabelNames),
      group_note: group.note ?? '',
      group_subtotal: subtotalFromTotals(group.totals),
      ...dimensionFields(group.dimensions),
      items: params.items
        .filter((i) => i.groupId === group.id && !i.comboId)
        .map(mapItem),
      combos: topLevelAssemblies.map((c) =>
        mapCombo(c, itemsByComboId.get(c.id) ?? []),
      ),
      scopes: scopes.map((scope) => ({
        scope_name: scope.name ?? '',
        scope_description: scope.description ?? '',
        scope_quantity: formatQuantity(scope.quantity),
        scope_subtotal: subtotalFromTotals(scope.totals),
        scope_note: scope.note ?? '',
        items: (itemsByComboId.get(scope.id) ?? []).map(mapItem),
        combos: assemblies
          .filter((c) => parentComboIdFromPayload(c.comboPayload) === scope.id)
          .map((c) => mapCombo(c, itemsByComboId.get(c.id) ?? [])),
      })),
    };
  });
}
