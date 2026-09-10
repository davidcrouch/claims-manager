export interface ApiLookup {
  id?: string;
  name?: string;
  externalReference?: string;
}

export type PublishStatus = 'sent' | 'excluded' | 'rejected' | null;

export interface ApiItem {
  id?: string;
  name?: string;
  component?: string;
  description?: string;
  type?: string;
  category?: string;
  subCategory?: string | null;
  index?: number;
  quantity?: number;
  tax?: number;
  unitCost?: number;
  buyCost?: number;
  markupType?: string;
  markupValue?: number;
  unitType?: ApiLookup;
  pcps?: string | null;
  note?: string | null;
  catalogItemId?: string;
  catalogMissing?: boolean;
  internal?: boolean;
  publishStatus?: PublishStatus;
  mismatches?: Array<{ property?: string; catalogValue?: string }>;
  tags?: string[];
  lineScopeStatus?: ApiLookup;
  subTotal?: number;
  totalTax?: number;
  total?: number;
  allocatedCost?: number;
  committedCost?: number;
  /** Bill progress: amount claimed on the current bill for this line. */
  invoiced?: number;
  /** Bill progress: sum claimed on earlier bills for this line. */
  previouslyInvoiced?: number;
  /** Invoice/bill payload flag — line excluded from claim when false. */
  completed?: boolean;
  /** Work-order line this PO item was copied from. */
  sourceWorkOrderItemId?: string;
  /** Proposal line this PO item was copied from. */
  sourceProposalItemId?: string;
  /** Source (work order / proposal) quantity — PO qty cannot exceed this. */
  maxQuantity?: number;
}

export interface ApiCombo {
  id?: string;
  kind?: 'assembly' | 'scope';
  name?: string;
  component?: string;
  description?: string;
  note?: string | null;
  category?: string;
  subCategory?: string | null;
  index?: number;
  quantity?: number;
  catalogComboId?: string;
  parentComboId?: string;
  comboPayload?: Record<string, unknown>;
  publishStatus?: PublishStatus;
  lineScopeStatus?: ApiLookup;
  items?: ApiItem[];
  subTotal?: number;
  totalTax?: number;
  total?: number;
  allocatedCost?: number;
  committedCost?: number;
}

export interface ApiScope {
  id?: string;
  name?: string;
  component?: string;
  description?: string;
  note?: string | null;
  category?: string;
  subCategory?: string | null;
  index?: number;
  quantity?: number;
  catalogScopeId?: string;
  lineScopeStatus?: ApiLookup;
  items?: ApiItem[];
  combos?: ApiCombo[];
  subTotal?: number;
  totalTax?: number;
  total?: number;
  allocatedCost?: number;
  committedCost?: number;
}

export interface ApiGroup {
  id?: string;
  groupLabel?: ApiLookup;
  description?: string;
  component?: string;
  note?: string | null;
  length?: number;
  width?: number;
  height?: number;
  perimeter?: number;
  index?: number;
  subTotal?: number;
  totalTax?: number;
  total?: number;
  items?: ApiItem[];
  combos?: ApiCombo[];
  scopes?: ApiScope[];
}

export type GroupDimensions = {
  length?: number;
  width?: number;
  height?: number;
  perimeter?: number;
};

export type EditableFieldKey =
  | 'name'
  | 'component'
  | 'description'
  | 'quantity'
  | 'unitType'
  | 'buyCost'
  | 'unitCost'
  | 'markupValue'
  | 'tax'
  | 'lineScopeStatus'
  | 'invoiced';

export type ColumnKey =
  | 'name'
  | 'type'
  | 'category'
  | 'quantity'
  | 'unitType'
  | 'buyCost'
  | 'unitCost'
  | 'extended'
  | 'markupValue'
  | 'tax'
  | 'total'
  | 'invoiced'
  | 'previouslyInvoiced';

export type LineItemsMode = 'edit' | 'catalog' | 'selection' | 'readonly';

export type LineNoteTargetType = 'group' | 'combo' | 'item';

export interface LineNoteEditRequest {
  targetType: LineNoteTargetType;
  targetId: string;
  label: string;
  note?: string | null;
}

export interface DeleteItemRequest {
  itemId: string;
  itemName?: string;
  isAssemblyChild: boolean;
}

export interface LineItemSelection {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export interface BulkSelection {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export interface LineItemsPaging {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  groupSummaries?: Array<{ id: string; label: string }>;
  hiddenGroupIds?: Set<string>;
  onHiddenGroupIdsChange?: (ids: Set<string>) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  serverFiltered?: boolean;
}

export interface DragState {
  rowKey: string;
  type: 'item' | 'assembly' | 'scope';
  id: string;
  parentGroupId: string;
  parentComboId?: string;
}

export interface DropIndicator {
  targetKey: string;
  position: 'before' | 'after';
  valid: boolean;
  isCopy: boolean;
}

export type RowEntry =
  | { kind: 'item'; key: string; item: ApiItem }
  | { kind: 'assembly'; key: string; combo: ApiCombo }
  | { kind: 'scope'; key: string; scope: ApiScope };

export interface LineItemLabels {
  lineSingular: string;
  linePlural: string;
  groupSingularCap: string;
  groupPlural: string;
  editGroup: string;
  deleteGroup: string;
  emptyState: string;
  emptyDrop: string;
  addToDrop: (label: string) => string;
  dragHint: string;
}

export const DEFAULT_LINE_ITEM_LABELS: LineItemLabels = {
  lineSingular: 'line',
  linePlural: 'lines',
  groupSingularCap: 'Group',
  groupPlural: 'groups',
  editGroup: 'Edit group',
  deleteGroup: 'Delete group',
  emptyState: 'No groups yet. Add a group or drag a group label here.',
  emptyDrop: 'Drop here to create a new group',
  addToDrop: (label) => `Drop to add to ${label}`,
  dragHint: 'Drag catalogue items or line items here to add lines',
};

/**
 * `full` — Unit Price, Extended, Markup, GST, Total (optional Buy Cost in catalogue).
 * `total-only` — Total only (e.g. invoice progress).
 * `cost` — Qty/Units + Buy Cost, Extended Cost (qty×buy), Sale Price (WO commercial total).
 */
export type PricingDetail = 'full' | 'total-only' | 'cost';

export interface LineItemsConfig {
  mode: LineItemsMode;
  showMarkup: boolean;
  showGst: boolean;
  showQuantities: boolean;
  showPricing: boolean;
  /** Column layout for money fields — see PricingDetail. */
  pricingDetail: PricingDetail;
  /** Show wholesale Buy Cost (catalogue master, or PO cost mode). */
  showBuyCost: boolean;
  /** Show Invoiced + Previously Invoiced columns (bill progress). */
  showInvoiceProgress: boolean;
  /** Show Previously Invoiced column (default true when invoice progress is on). */
  showPreviouslyInvoiced: boolean;
  /** Show the item Type column (catalog line type). */
  showItemTypeColumn: boolean;
  /** Allow inline edit of Invoiced only (bill progress). */
  invoiceProgressEditable: boolean;
  /** Allow inline edit of quantity and Buy Cost when the table is otherwise read-only (sourced PO). Units and sale price stay locked. */
  buyCostEditable: boolean;
  showCategory: boolean;
  hideComponent: boolean;
  enableLineNotes: boolean;
  showLineScopeStatusColumn: boolean;
  compact: boolean;
  labels: LineItemLabels;
  showColumnVisibilityToggles: boolean;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface FlatLineItemRow {
  rowKey: string;
  groupId?: string;
  groupLabel: string;
  assemblyName: string | null;
  item: ApiItem;
}
