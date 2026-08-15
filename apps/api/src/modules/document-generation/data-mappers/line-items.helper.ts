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
  items: TemplateGroupItem[];
  combos: TemplateCombo[];
  scopes: TemplateScope[];
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
      group_name: group.description ?? '',
      group_note: group.note ?? '',
      group_subtotal: subtotalFromTotals(group.totals),
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
