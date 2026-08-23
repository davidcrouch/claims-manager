import type { ApiItem, EditableFieldKey } from './types';
import {
  resolveMarkupAmount,
  resolveTaxRate,
  storedMarkupToUi,
  storedTaxToUi,
} from '@/lib/rates';

export interface ItemMoney {
  extended: number;
  markupAmt: number;
  gstAmt: number;
  total: number;
}

/**
 * Compute line totals from an item and optional edit overrides.
 * Pure function — safe to call from useMemo or outside React.
 */
export function computeItemMoney(
  item: ApiItem,
  inputs: Record<string, string> | undefined,
  showMarkup: boolean,
  showGst: boolean,
): ItemMoney {
  const qty = inputs ? parseFloat(inputs.quantity) || 0 : (item.quantity ?? 0);
  const uc = inputs ? parseFloat(inputs.unitCost) || 0 : (item.unitCost ?? 0);
  const extended = qty * uc;

  const markupAmt = resolveMarkupAmount({
    markupType: item.markupType,
    storedMarkupValue: item.markupValue,
    editUiValue: inputs?.markupValue,
    quantity: qty,
    extended,
  });

  const taxRate = resolveTaxRate({
    storedTax: item.tax,
    editUiValue: inputs?.tax,
  });

  const gstAmt = (extended + markupAmt) * taxRate;
  const total = extended + (showMarkup ? markupAmt : 0) + (showGst ? gstAmt : 0);

  return { extended, markupAmt, gstAmt, total };
}

/** Initialise edit inputs from an ApiItem for the inline edit form. */
export function initItemInputs(item: ApiItem): Record<EditableFieldKey, string> {
  return {
    name: item.name ?? '',
    component: item.component ?? '',
    description: item.description ?? '',
    quantity: String(item.quantity ?? 0),
    unitType: item.unitType?.externalReference ?? '',
    unitCost: String(item.unitCost ?? 0),
    markupValue: String(storedMarkupToUi(item.markupType, item.markupValue)),
    tax: String(storedTaxToUi(typeof item.tax === 'number' ? item.tax : 0)),
  };
}

/** Initialise edit inputs from an ApiCombo. */
export function initComboInputs(combo: { name?: string; component?: string; description?: string; quantity?: number }): Record<EditableFieldKey, string> {
  return {
    name: combo.name ?? '',
    component: combo.component ?? '',
    description: combo.description ?? '',
    quantity: String(combo.quantity ?? 0),
    unitType: '',
    unitCost: '0',
    markupValue: '0',
    tax: '0',
  };
}

/** Initialise edit inputs from an ApiScope. */
export function initScopeInputs(scope: { name?: string; component?: string; description?: string; quantity?: number }): Record<EditableFieldKey, string> {
  return {
    name: scope.name ?? '',
    component: scope.component ?? '',
    description: scope.description ?? '',
    quantity: String(scope.quantity ?? 0),
    unitType: '',
    unitCost: '0',
    markupValue: '0',
    tax: '0',
  };
}

/** Which fields are editable for items given the current column visibility. */
export function getEditableFields(
  showMarkup: boolean,
  showGst: boolean,
  showQuantities = true,
  showPricing = true,
): EditableFieldKey[] {
  const fields: EditableFieldKey[] = ['name', 'component', 'description'];
  if (showQuantities) fields.push('quantity', 'unitType');
  if (showPricing) {
    fields.push('unitCost');
    if (showMarkup) fields.push('markupValue');
    if (showGst) fields.push('tax');
  }
  return fields;
}

export const NAME_COL_FIELDS: EditableFieldKey[] = ['name', 'component', 'description'];
export const ASSEMBLY_EDITABLE_FIELDS: EditableFieldKey[] = ['name', 'component', 'description', 'quantity'];
export const SCOPE_EDITABLE_FIELDS: EditableFieldKey[] = ['name', 'component', 'description', 'quantity'];

/** Find the nearest editable field when a non-editable column is clicked. */
export function nearestEditableField(
  clicked: string,
  showMarkup: boolean,
  showGst: boolean,
  showQuantities = true,
  showPricing = true,
): EditableFieldKey {
  const editableFields = getEditableFields(showMarkup, showGst, showQuantities, showPricing);
  if ((editableFields as string[]).includes(clicked)) return clicked as EditableFieldKey;

  const allCols: string[] = ['name', 'type', 'category'];
  if (showQuantities) allCols.push('quantity', 'unitType');
  if (showPricing) {
    allCols.push('unitCost', 'extended');
    if (showMarkup) allCols.push('markupValue');
    if (showGst) allCols.push('tax');
    allCols.push('total');
  }

  const idx = allCols.indexOf(clicked);
  for (let dist = 1; dist < allCols.length; dist++) {
    const left = idx - dist;
    if (left >= 0 && (editableFields as string[]).includes(allCols[left])) {
      return allCols[left] as EditableFieldKey;
    }
    const right = idx + dist;
    if (right < allCols.length && (editableFields as string[]).includes(allCols[right])) {
      return allCols[right] as EditableFieldKey;
    }
  }
  return editableFields[0];
}

/** Group label display — falls back to description or indexed label. */
export function groupLabel(group: { groupLabel?: { name?: string; externalReference?: string }; description?: string }, index: number, fallbackPrefix = 'Group'): string {
  return (
    group.groupLabel?.name ??
    group.groupLabel?.externalReference ??
    group.description ??
    `${fallbackPrefix} ${index + 1}`
  );
}

export const UNIT_TYPE_OPTIONS = [
  { value: 'EA', label: 'EA' },
  { value: 'HR', label: 'HR' },
  { value: 'ITEM', label: 'Item' },
  { value: 'KM', label: 'KM' },
  { value: 'LM', label: 'LM' },
  { value: 'LOT', label: 'Lot' },
  { value: 'M2', label: 'M²' },
] as const;
