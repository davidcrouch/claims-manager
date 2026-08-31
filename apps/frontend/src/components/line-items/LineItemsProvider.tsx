'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ApiGroup,
  BulkSelection,
  DeleteItemRequest,
  EditableFieldKey,
  GroupDimensions,
  LineItemLabels,
  LineItemsConfig,
  LineItemsMode,
  LineItemsPaging,
  LineItemSelection,
  LineNoteEditRequest,
  SaveState,
} from './lib/types';
import { DEFAULT_LINE_ITEM_LABELS } from './lib/types';
import { normalizeLineItemGroups } from './lib/reorder';
import { useLineItemEdit, type EditInputs, type EditState } from './hooks/use-line-item-edit';
import { useKeyboardNav } from './hooks/use-keyboard-nav';
import { useLineItemPaging } from './hooks/use-line-item-paging';
import { useGrandTotals, type GrandTotals } from './hooks/use-line-item-money';
import type { CatalogDragPayload, GroupLabelDragPayload } from '@/components/catalog/catalog-drag';
import {
  type HeaderVisibilityEntry,
  type ResolvedHeaderVisibility,
  resolveHeaderVisibility,
} from './lib/header-visibility';
import type { CatalogUpdateMode } from './lib/catalog-update';

// --- Actions (callbacks the consumer provides) ---

export interface LineItemsActions {
  onSave?: (edits: Record<string, Record<EditableFieldKey, string>>) => void;
  onCatalogDrop?: (payload: CatalogDragPayload, groupId?: string, quoteComboId?: string) => void;
  onGroupLabelDrop?: (payload: GroupLabelDragPayload) => void;
  onEditGroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onUpdateGroupDimensions?: (groupId: string, dimensions: GroupDimensions) => void;
  onDeleteItem?: (request: DeleteItemRequest) => void;
  onDeleteCombo?: (comboId: string) => void;
  onDeleteScope?: (scopeId: string) => void;
  onMoveGroupUp?: (groupId: string) => void;
  onMoveGroupDown?: (groupId: string) => void;
  onOpenCatalogDrawer?: () => void;
  onReorderLineItems?: (params: {
    groupId: string;
    parentComboId?: string;
    items?: Array<{ id: string; sortIndex: number }>;
    combos?: Array<{ id: string; sortIndex: number }>;
    scopes?: Array<{ id: string; sortIndex: number }>;
  }) => void;
  onMoveLineItem?: (params: {
    itemId?: string;
    comboId?: string;
    targetGroupId: string;
    targetComboId?: string;
    insertAtIndex?: number;
  }) => void;
  onDuplicateLineItem?: (params: {
    itemId?: string;
    comboId?: string;
    targetGroupId: string;
    targetComboId?: string;
    insertAtIndex?: number;
  }) => void;
  onEditLineNote?: (request: LineNoteEditRequest) => void;
  onDirtyChange?: (dirty: boolean, edits: Record<string, Record<EditableFieldKey, string>>) => void;
  onSaveStateChange?: (state: SaveState, error?: string) => void;
}

// --- Context shape ---

export interface LineItemsContextValue {
  // Data
  groups: ApiGroup[];
  pagedGroups: ApiGroup[];
  totalUnits: number;
  grandTotals: GrandTotals;

  // Config
  config: LineItemsConfig;
  isReadOnly: boolean;
  showUnselected: boolean;
  hideUnselected: boolean;

  // Edit state
  editState: EditState | null;
  editInputs: EditInputs;
  selectedRows: Set<string>;
  isDirty: boolean;
  dirtyEdits: Record<string, Record<EditableFieldKey, string>>;
  dirtyRowKeys: Set<string>;
  structurallyDirty: boolean;

  // Collapse state
  collapsed: Set<string>;
  collapsedCombos: Set<string>;
  collapsedScopes: Set<string>;

  // Paging
  currentPage: number;
  searchTerm: string;
  hiddenGroupIds: Set<string>;

  // Selection
  selection?: LineItemSelection;
  bulkSelection?: BulkSelection;
  bulkSelectedIds: Set<string>;

  // Catalogue update mode (estimate → source catalogue)
  catalogUpdateMode: CatalogUpdateMode;
  canSetCatalogUpdateMode: boolean;

  // Actions
  actions: LineItemsActions;

  // Dispatch methods
  setEditState: (state: EditState | null) => void;
  setEditInputs: React.Dispatch<React.SetStateAction<EditInputs>>;
  setSelectedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleInputChange: (rowKey: string, field: EditableFieldKey, value: string) => void;
  handleCellKeyDown: (e: React.KeyboardEvent) => void;
  toggleCollapse: (groupId: string) => void;
  toggleCombo: (comboKey: string) => void;
  toggleScope: (scopeKey: string) => void;
  toggleAll: () => void;
  setPage: (page: number) => void;
  setSearchTerm: (term: string) => void;
  setHiddenGroupIds: (ids: Set<string>) => void;
  handleBulkToggle: (ids: string[]) => void;
  setStructurallyDirty: (dirty: boolean) => void;
  resetEdits: () => void;
  setShowMarkup: (v: boolean) => void;
  setShowGst: (v: boolean) => void;
  setShowQuantities: (v: boolean) => void;
  setShowPricing: (v: boolean) => void;
  setShowUnselected: (v: boolean) => void;
  setCatalogUpdateMode: (mode: CatalogUpdateMode) => void;
  resolveHeaderVisibility: (key: string, parentQty: boolean, parentPrice: boolean) => ResolvedHeaderVisibility;
  isHeaderOverridden: (key: string) => boolean;
  toggleHeaderOverride: (key: string, parentQty: boolean, parentPrice: boolean) => void;
  toggleHeaderField: (key: string, field: 'showQuantities' | 'showPricing', current: boolean) => void;
}

const LineItemsContext = createContext<LineItemsContextValue | null>(null);

export function useLineItems(): LineItemsContextValue {
  const ctx = useContext(LineItemsContext);
  if (!ctx) throw new Error('useLineItems must be used within a LineItemsProvider');
  return ctx;
}

// --- Provider props ---

export interface LineItemsProviderProps {
  children: ReactNode;
  groups: ApiGroup[];
  mode?: LineItemsMode;
  paging?: LineItemsPaging;
  selection?: LineItemSelection;
  bulkSelection?: BulkSelection;
  actions?: LineItemsActions;
  compact?: boolean;
  enableLineNotes?: boolean;
  showColumnToggles?: boolean;
  hideToolbarActions?: boolean;
  resetEditsKey?: number;
  structurallyDirty?: boolean;
  quantitiesVisible?: boolean;
  pricingVisible?: boolean;
  labels?: Partial<LineItemLabels>;
  hideComponent?: boolean;
  catalogUpdateMode?: CatalogUpdateMode;
  onCatalogUpdateModeChange?: (mode: CatalogUpdateMode) => void;
  canSetCatalogUpdateMode?: boolean;
}

export function LineItemsProvider({
  children,
  groups: rawGroups,
  mode = 'edit',
  paging,
  selection,
  bulkSelection,
  actions = {},
  compact = false,
  enableLineNotes = false,
  showColumnToggles = false,
  resetEditsKey = 0,
  structurallyDirty: externalStructurallyDirty = false,
  quantitiesVisible,
  pricingVisible,
  labels: labelOverrides,
  hideComponent = false,
  catalogUpdateMode = 'none',
  onCatalogUpdateModeChange,
  canSetCatalogUpdateMode = false,
}: LineItemsProviderProps) {
  const groups = useMemo(() => normalizeLineItemGroups(rawGroups), [rawGroups]);
  const isReadOnly = mode === 'readonly' || mode === 'selection';

  // --- Config ---
  const [showMarkup, setShowMarkup] = useState(true);
  const [showGst, setShowGst] = useState(true);
  const [showQuantities, setShowQuantities] = useState(quantitiesVisible ?? true);
  const [showPricing, setShowPricing] = useState(pricingVisible ?? true);
  const [showUnselected, setShowUnselected] = useState(true);
  const [headerVisibility, setHeaderVisibility] = useState<Record<string, HeaderVisibilityEntry>>({});
  const showCategory = mode !== 'catalog';
  const hideUnselected = !!selection && !showUnselected;

  const labels: LineItemLabels = useMemo(
    () => ({ ...DEFAULT_LINE_ITEM_LABELS, ...labelOverrides }),
    [labelOverrides],
  );

  const config: LineItemsConfig = useMemo(
    () => ({
      mode,
      showMarkup,
      showGst,
      showQuantities,
      showPricing,
      showCategory,
      hideComponent,
      enableLineNotes,
      compact,
      labels,
      showColumnVisibilityToggles: showColumnToggles,
    }),
    [mode, showMarkup, showGst, showQuantities, showPricing, showCategory, hideComponent, enableLineNotes, compact, labels, showColumnToggles],
  );

  // --- Structural dirty ---
  const [internalStructurallyDirty, setInternalStructurallyDirty] = useState(false);
  const structurallyDirty = externalStructurallyDirty || internalStructurallyDirty;

  // --- Edit state ---
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editInputs, setEditInputs] = useState<EditInputs>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const edit = useLineItemEdit(groups, structurallyDirty, {
    editState,
    setEditState,
    editInputs,
    setEditInputs,
    selectedRows,
    setSelectedRows,
  });

  // Reset edits when resetEditsKey changes
  const prevResetKey = useRef(resetEditsKey);
  if (resetEditsKey !== prevResetKey.current) {
    prevResetKey.current = resetEditsKey;
    edit.resetEdits();
  }

  // --- Collapse state ---
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedCombos, setCollapsedCombos] = useState<Set<string>>(new Set());
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((groupId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleCombo = useCallback((comboKey: string) => {
    setCollapsedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(comboKey)) next.delete(comboKey);
      else next.add(comboKey);
      return next;
    });
  }, []);

  const toggleScope = useCallback((scopeKey: string) => {
    setCollapsedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scopeKey)) next.delete(scopeKey);
      else next.add(scopeKey);
      return next;
    });
  }, []);

  const resolveVisibility = useCallback(
    (key: string, parentQty: boolean, parentPrice: boolean) =>
      resolveHeaderVisibility(key, parentQty, parentPrice, headerVisibility, showColumnToggles),
    [headerVisibility, showColumnToggles],
  );

  const isHeaderOverridden = useCallback(
    (key: string) => !!headerVisibility[key]?.override,
    [headerVisibility],
  );

  const toggleHeaderOverride = useCallback(
    (key: string, parentQty: boolean, parentPrice: boolean) => {
      setHeaderVisibility((prev) => {
        const cur = prev[key];
        if (cur?.override) {
          return { ...prev, [key]: { override: false } };
        }
        return {
          ...prev,
          [key]: {
            override: true,
            showQuantities: cur?.showQuantities ?? parentQty,
            showPricing: cur?.showPricing ?? parentPrice,
          },
        };
      });
    },
    [],
  );

  const toggleHeaderField = useCallback(
    (key: string, field: 'showQuantities' | 'showPricing', current: boolean) => {
      setHeaderVisibility((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: !current },
      }));
    },
    [],
  );

  const toggleAll = useCallback(() => {
    const allGroupIds = groups.map((g, i) => g.id ?? `group-${i}`);
    setCollapsed((prev) => {
      if (allGroupIds.every((id) => prev.has(id))) return new Set();
      return new Set(allGroupIds);
    });
  }, [groups]);

  // --- Paging ---
  const {
    pagedGroups,
    totalUnits,
    currentPage,
    searchTerm,
    setSearchTerm,
    setPage,
    hiddenGroupIds,
    setHiddenGroupIds,
  } = useLineItemPaging(groups, paging);

  // --- Keyboard ---
  const { handleCellKeyDown } = useKeyboardNav({
    editState,
    setEditState,
    visibleRowIndex: edit.rowIndex,
    showMarkup,
    showGst,
    showQuantities,
    showPricing,
    hideComponent,
    selectedRows,
    setSelectedRows,
    initRow: edit.initRow,
  });

  // --- Totals ---
  const grandTotals = useGrandTotals(
    groups,
    edit.editInputs,
    showMarkup,
    showGst,
    selection?.selectedIds,
    hideUnselected,
  );

  // --- Bulk selection ---
  const [internalBulkIds, setInternalBulkIds] = useState<Set<string>>(new Set());
  const bulkSelectedIds = bulkSelection?.selectedIds ?? internalBulkIds;
  const setBulkSelectedIds = bulkSelection?.onChange ?? setInternalBulkIds;

  const handleBulkToggle = useCallback(
    (ids: string[]) => {
      const next = new Set(bulkSelectedIds);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      setBulkSelectedIds(next);
    },
    [bulkSelectedIds, setBulkSelectedIds],
  );

  const setCatalogUpdateMode = useCallback(
    (mode: CatalogUpdateMode) => {
      if (!canSetCatalogUpdateMode) return;
      onCatalogUpdateModeChange?.(mode);
    },
    [canSetCatalogUpdateMode, onCatalogUpdateModeChange],
  );

  // --- Dirty change notification ---
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    actionsRef.current.onDirtyChange?.(edit.isDirty, edit.dirtyEdits);
  }, [edit.isDirty, edit.dirtyEdits]);

  // --- Context value ---
  const value: LineItemsContextValue = useMemo(
    () => ({
      groups,
      pagedGroups,
      totalUnits,
      grandTotals,
      config,
      isReadOnly,
      showUnselected,
      hideUnselected,
      editState: edit.editState,
      editInputs: edit.editInputs,
      selectedRows: edit.selectedRows,
      isDirty: edit.isDirty,
      dirtyEdits: edit.dirtyEdits,
      dirtyRowKeys: edit.dirtyRowKeys,
      structurallyDirty,
      collapsed,
      collapsedCombos,
      collapsedScopes,
      currentPage,
      searchTerm,
      hiddenGroupIds,
      selection,
      bulkSelection,
      bulkSelectedIds,
      catalogUpdateMode: canSetCatalogUpdateMode ? catalogUpdateMode : 'none',
      canSetCatalogUpdateMode,
      actions,
      setEditState,
      setEditInputs,
      setSelectedRows,
      handleInputChange: edit.handleInputChange,
      handleCellKeyDown,
      toggleCollapse,
      toggleCombo,
      toggleScope,
      toggleAll,
      setPage,
      setSearchTerm,
      setHiddenGroupIds,
      handleBulkToggle,
      setStructurallyDirty: setInternalStructurallyDirty,
      resetEdits: edit.resetEdits,
      setShowMarkup,
      setShowGst,
      setShowQuantities,
      setShowPricing,
      setShowUnselected,
      setCatalogUpdateMode,
      resolveHeaderVisibility: resolveVisibility,
      isHeaderOverridden,
      toggleHeaderOverride,
      toggleHeaderField,
    }),
    [
      groups,
      pagedGroups,
      totalUnits,
      grandTotals,
      config,
      isReadOnly,
      showUnselected,
      hideUnselected,
      edit,
      structurallyDirty,
      collapsed,
      collapsedCombos,
      collapsedScopes,
      currentPage,
      searchTerm,
      hiddenGroupIds,
      selection,
      bulkSelection,
      bulkSelectedIds,
      catalogUpdateMode,
      canSetCatalogUpdateMode,
      actions,
      setEditState,
      setEditInputs,
      setSelectedRows,
      handleCellKeyDown,
      toggleCollapse,
      toggleCombo,
      toggleScope,
      toggleAll,
      setPage,
      setSearchTerm,
      setHiddenGroupIds,
      handleBulkToggle,
      setCatalogUpdateMode,
      resolveVisibility,
      isHeaderOverridden,
      toggleHeaderOverride,
      toggleHeaderField,
    ],
  );

  return (
    <LineItemsContext.Provider value={value}>
      {children}
    </LineItemsContext.Provider>
  );
}
