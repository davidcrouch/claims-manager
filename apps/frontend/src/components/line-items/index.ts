// Public API for the line-items component system
export { LineItemsProvider, useLineItems } from './LineItemsProvider';
export type { LineItemsProviderProps, LineItemsActions, LineItemsContextValue } from './LineItemsProvider';

export { LineItemsTable } from './LineItemsTable';
export { LineItemsToolbar } from './LineItemsToolbar';
export { GroupCard } from './GroupCard';
export { ScopeCard } from './ScopeCard';
export { AssemblyRow } from './AssemblyRow';
export { ItemRow } from './ItemRow';
export { LineItemDragOverlay } from './DragOverlay';

// Hooks
export { useLineItemEdit, buildLineItemOriginals } from './hooks/use-line-item-edit';
export type { EditInputs, EditState } from './hooks/use-line-item-edit';
export { useLineItemDrag } from './hooks/use-line-item-drag';
export { useKeyboardNav } from './hooks/use-keyboard-nav';
export { useGrandTotals } from './hooks/use-line-item-money';
export { useLineItemPaging, LINE_ITEMS_PAGE_SIZE } from './hooks/use-line-item-paging';

// Lib (pure functions)
export {
  computeItemMoney,
  initItemInputs,
  initComboInputs,
  initScopeInputs,
  getEditableFields,
  nearestEditableField,
  groupLabel,
  UNIT_TYPE_OPTIONS,
  NAME_COL_FIELDS,
  ASSEMBLY_EDITABLE_FIELDS,
  SCOPE_EDITABLE_FIELDS,
} from './lib/money';

export {
  parseRowKey,
  getTargetContext,
  getParentContext,
  canDropInTarget,
  buildRowIndex,
  collectGroupSelectableIds,
  itemRowKey,
  comboRowKey,
  scopeRowKey,
  comboItemRowKey,
  scopeItemRowKey,
  scopeComboRowKey,
  scopeComboItemRowKey,
  groupDropKey,
  parseGroupDropKey,
} from './lib/row-keys';

export {
  reorderGroupItems,
  reorderContainerItems,
  reorderGroupCombos,
  reorderGroupScopes,
  reorderGroups,
  applyReorderParams,
  moveItem,
  moveCombo,
  swapGroups,
  normalizeLineItemGroups,
} from './lib/reorder';

export {
  groupsFromDocumentPayload,
  collectSelectableLineItemIds,
  flattenLineItems,
  uniqueFilterOptions,
} from './lib/parse';

export type { CatalogUpdateMode } from './lib/catalog-update';
export {
  CATALOG_UPDATE_MODE_STORAGE_KEY,
  parseCatalogUpdateMode,
  collectCatalogSourceUpdates,
} from './lib/catalog-update';
export type { CatalogSourcePushItem } from './lib/catalog-update';

export type {
  ApiLookup,
  ApiItem,
  ApiCombo,
  ApiScope,
  ApiGroup,
  GroupDimensions,
  EditableFieldKey,
  ColumnKey,
  LineItemsMode,
  LineNoteEditRequest,
  LineNoteTargetType,
  DeleteItemRequest,
  LineItemSelection,
  BulkSelection,
  LineItemsPaging,
  DragState,
  DropIndicator,
  RowEntry,
  LineItemsConfig,
  SaveState,
  PublishStatus,
  FlatLineItemRow,
} from './lib/types';
