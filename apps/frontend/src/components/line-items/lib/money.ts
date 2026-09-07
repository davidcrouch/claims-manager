import type { ApiItem, EditableFieldKey } from './types';
import {
  DEFAULT_LINE_SCOPE_STATUS,
  resolveLineScopeStatusValue,
} from './line-scope-status';
import {
  resolveMarkupAmount,
  resolveTaxRate,
  storedMarkupToUi,
  storedTaxToUi,
} from '@/lib/rates';

export interface ItemMoney {
  /** qty × unitCost (sell extended). */
  extended: number;
  /** qty × buyCost (purchase extended cost). */
  buyExtended: number;
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
  const bc = inputs ? parseFloat(inputs.buyCost) || 0 : (item.buyCost ?? 0);
  const extended = qty * uc;
  const buyExtended = qty * bc;

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

  return { extended, buyExtended, markupAmt, gstAmt, total };
}

/**
 * Full commercial line total (extended + markup + GST), matching the work order
 * Total column. Prefer client-side rates over stored `totals.total`, which is
 * currently qty×unitCost+tax and omits markup.
 */
export function lineTotalFromItem(
  item: ApiItem & { totals?: Record<string, unknown> },
): number {
  const computed = computeItemMoney(item, undefined, true, true).total;
  if (computed > 0) return computed;

  if (typeof item.total === 'number' && Number.isFinite(item.total) && item.total > 0) {
    return item.total;
  }
  const nestedTotal = item.totals?.total;
  if (typeof nestedTotal === 'number' && Number.isFinite(nestedTotal) && nestedTotal > 0) {
    return nestedTotal;
  }
  if (
    typeof item.subTotal === 'number' &&
    Number.isFinite(item.subTotal) &&
    typeof item.totalTax === 'number' &&
    Number.isFinite(item.totalTax)
  ) {
    return item.subTotal + item.totalTax;
  }
  return computed;
}

/** Current invoiced amount for a line (edit input wins over stamped value). */
export function resolveInvoicedAmount(
  item: ApiItem,
  inputs?: Record<string, string> | null,
): number {
  if (inputs?.invoiced != null && inputs.invoiced !== '') {
    const parsed = Number(inputs.invoiced);
    if (Number.isFinite(parsed)) return parsed;
  }
  return typeof item.invoiced === 'number' && Number.isFinite(item.invoiced)
    ? item.invoiced
    : 0;
}

/** Prior invoices amount stamped on a line item. */
export function resolvePreviouslyInvoicedAmount(item: ApiItem): number {
  return typeof item.previouslyInvoiced === 'number' &&
    Number.isFinite(item.previouslyInvoiced)
    ? item.previouslyInvoiced
    : 0;
}

/** Initialise edit inputs from an ApiItem for the inline edit form. */
export function initItemInputs(item: ApiItem): Record<EditableFieldKey, string> {
  return {
    name: item.name ?? '',
    component: item.component ?? '',
    description: item.description ?? '',
    quantity: String(item.quantity ?? 0),
    unitType: item.unitType?.externalReference ?? '',
    buyCost: String(item.buyCost ?? 0),
    unitCost: String(item.unitCost ?? 0),
    markupValue: String(storedMarkupToUi(item.markupType, item.markupValue)),
    tax: String(storedTaxToUi(typeof item.tax === 'number' ? item.tax : 0)),
    lineScopeStatus: resolveLineScopeStatusValue(item.lineScopeStatus),
    invoiced: String(item.invoiced ?? 0),
  };
}

/** Initialise edit inputs from an ApiCombo. */
export function initComboInputs(combo: {
  name?: string;
  component?: string;
  description?: string;
  quantity?: number;
  lineScopeStatus?: { name?: string; externalReference?: string };
}): Record<EditableFieldKey, string> {
  return {
    name: combo.name ?? '',
    component: combo.component ?? '',
    description: combo.description ?? '',
    quantity: String(combo.quantity ?? 0),
    unitType: '',
    buyCost: '0',
    unitCost: '0',
    markupValue: '0',
    tax: '0',
    lineScopeStatus: resolveLineScopeStatusValue(combo.lineScopeStatus),
    invoiced: '0',
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
    buyCost: '0',
    unitCost: '0',
    markupValue: '0',
    tax: '0',
    lineScopeStatus: DEFAULT_LINE_SCOPE_STATUS,
    invoiced: '0',
  };
}

/** Which fields are editable for items given the current column visibility. */
export function getEditableFields(
  showMarkup: boolean,
  showGst: boolean,
  showQuantities = true,
  showPricing = true,
  hideComponent = false,
  invoiceProgressEditable = false,
  showBuyCost = false,
  showUnitCost = true,
): EditableFieldKey[] {
  if (invoiceProgressEditable) return ['invoiced'];
  const fields: EditableFieldKey[] = hideComponent ? ['name', 'description'] : ['name', 'component', 'description'];
  if (showQuantities) fields.push('quantity', 'unitType');
  if (showPricing) {
    if (showBuyCost) fields.push('buyCost');
    if (showUnitCost) fields.push('unitCost');
    if (showMarkup) fields.push('markupValue');
    if (showGst) fields.push('tax');
  }
  return fields;
}

export const NAME_COL_FIELDS: EditableFieldKey[] = ['name', 'component', 'description'];
export const ASSEMBLY_EDITABLE_FIELDS: EditableFieldKey[] = ['name', 'component', 'description', 'quantity'];
export const SCOPE_EDITABLE_FIELDS: EditableFieldKey[] = ['name', 'component', 'description', 'quantity'];

export function getNameColFields(hideComponent = false): EditableFieldKey[] {
  return hideComponent ? ['name', 'description'] : NAME_COL_FIELDS;
}

export function getAssemblyEditableFields(hideComponent = false): EditableFieldKey[] {
  return hideComponent
    ? ['name', 'description', 'quantity']
    : ASSEMBLY_EDITABLE_FIELDS;
}

export function getScopeEditableFields(hideComponent = false): EditableFieldKey[] {
  return hideComponent
    ? ['name', 'description', 'quantity']
    : SCOPE_EDITABLE_FIELDS;
}

/** Find the nearest editable field when a non-editable column is clicked. */
export function nearestEditableField(
  clicked: string,
  showMarkup: boolean,
  showGst: boolean,
  showQuantities = true,
  showPricing = true,
  hideComponent = false,
  invoiceProgressEditable = false,
  showBuyCost = false,
  showUnitCost = true,
): EditableFieldKey {
  const editableFields = getEditableFields(
    showMarkup,
    showGst,
    showQuantities,
    showPricing,
    hideComponent,
    invoiceProgressEditable,
    showBuyCost,
    showUnitCost,
  );
  if ((editableFields as string[]).includes(clicked)) return clicked as EditableFieldKey;
  if (invoiceProgressEditable) return 'invoiced';

  const allCols: string[] = ['name', 'category', 'type'];
  if (showQuantities) allCols.push('quantity', 'unitType');
  if (showPricing) {
    if (showBuyCost) allCols.push('buyCost');
    if (showUnitCost) allCols.push('unitCost');
    allCols.push('extended');
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
export function groupLabel(group: { name?: string; groupLabel?: { name?: string; externalReference?: string }; description?: string }, index: number, fallbackPrefix = 'Group'): string {
  return (
    group.groupLabel?.name ??
    group.groupLabel?.externalReference ??
    group.name ??
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
