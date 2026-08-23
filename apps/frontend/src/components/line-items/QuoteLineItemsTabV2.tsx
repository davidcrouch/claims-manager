'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Ref,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Quote, CatalogType } from '@/types/api';
import { CatalogPickerDrawer } from '@/components/catalog/CatalogPickerDrawer';
import type { CatalogDragPayload, GroupLabelDragPayload } from '@/components/catalog/catalog-drag';
import { uiMarkupToStored, uiTaxToStored } from '@/lib/rates';
import {
  addCatalogAssemblyToQuoteAction,
  addCatalogItemToQuoteAction,
  createQuoteGroupAction,
  updateQuoteGroupAction,
  deleteQuoteGroupAction,
  deleteQuoteItemAction,
  deleteQuoteComboAction,
  reorderQuoteGroupsAction,
  getQuoteLineItemsAction,
  saveQuoteLineItemsAction,
  reorderQuoteLineItemsAction,
  moveQuoteLineItemAction,
  duplicateQuoteLineItemAction,
} from '@/app/(app)/quotes/actions';

import {
  LineItemsProvider,
  LineItemsTable,
  buildLineItemOriginals,
  type LineItemsActions,
  type EditableFieldKey,
  type ApiGroup,
  type GroupDimensions,
  type DeleteItemRequest,
  LINE_ITEMS_PAGE_SIZE,
} from '@/components/line-items';
import { swapGroups, applyReorderParams } from './lib/reorder';

const PREFIX = 'frontend:QuoteLineItemsTabV2';

export type LineItemEdits = Record<string, Record<string, string>>;

export interface QuoteLineItemsTabHandle {
  save: (edits?: LineItemEdits) => void;
  resetEdits: () => void;
}

export const QuoteLineItemsTabV2 = forwardRef(function QuoteLineItemsTabV2(
  {
    quote,
    drawerOpen,
    onDrawerOpenChange,
    catalogType,
    readOnly = false,
    onDirtyChange,
    hideToolbarActions = false,
    onUndoCapture,
    onSaveStateChange,
  }: {
    quote: Quote;
    drawerOpen: boolean;
    onDrawerOpenChange: (open: boolean) => void;
    catalogType?: CatalogType;
    readOnly?: boolean;
    onDirtyChange?: (dirty: boolean, save: () => void) => void;
    hideToolbarActions?: boolean;
    onUndoCapture?: (restoreEdits: LineItemEdits) => void;
    onSaveStateChange?: (state: 'saving' | 'saved' | 'error', error?: string) => void;
  },
  ref: Ref<QuoteLineItemsTabHandle>,
) {
  const router = useRouter();
  const [dbGroups, setDbGroups] = useState<ApiGroup[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [groupSummaries, setGroupSummaries] = useState<Array<{ id: string; label: string }>>([]);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState('1');
  const [pending, startTransition] = useTransition();
  const [structurallyDirty, setStructurallyDirty] = useState(false);
  const [resetEditsKey, setResetEditsKey] = useState(0);
  const skipUndoRef = useRef(false);
  const onUndoCaptureRef = useRef(onUndoCapture);
  const onSaveStateChangeRef = useRef(onSaveStateChange);
  onUndoCaptureRef.current = onUndoCapture;
  onSaveStateChangeRef.current = onSaveStateChange;

  const visibleGroupIds = useMemo(() => {
    if (hiddenGroupIds.size === 0 || groupSummaries.length === 0) return undefined;
    return groupSummaries.map((g) => g.id).filter((id) => !hiddenGroupIds.has(id));
  }, [hiddenGroupIds, groupSummaries]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, hiddenGroupIds]);

  const loadLineItems = useCallback(async () => {
    if (visibleGroupIds && visibleGroupIds.length === 0) {
      setDbGroups([]);
      setTotal(0);
      return;
    }
    const result = await getQuoteLineItemsAction(quote.id, {
      search: debouncedSearch || undefined,
      groupIds: visibleGroupIds,
      page,
      limit: LINE_ITEMS_PAGE_SIZE,
    });
    if (result.success && result.groups) {
      setDbGroups(result.groups as ApiGroup[]);
      setTotal(result.total ?? 0);
      if (result.groupSummaries) setGroupSummaries(result.groupSummaries);
    } else if (!result.success) {
      console.error(`${PREFIX}.loadLineItems — ${result.error}`);
      toast.error(result.error ?? 'Failed to load line items');
    }
  }, [quote.id, debouncedSearch, visibleGroupIds, page]);

  useEffect(() => { void loadLineItems(); }, [loadLineItems]);

  // --- Actions wired to backend ---

  const handleCatalogDrop = useCallback((payload: CatalogDragPayload, groupId?: string, quoteComboId?: string) => {
    startTransition(async () => {
      const qty = quantity.trim() || '1';
      const result =
        payload.kind === 'assembly' || payload.kind === 'scope'
          ? await addCatalogAssemblyToQuoteAction({ quoteId: quote.id, catalogAssemblyId: payload.id, quantity: qty, groupId, quoteComboId })
          : await addCatalogItemToQuoteAction({ quoteId: quote.id, catalogItemId: payload.id, quantity: qty, groupId, quoteComboId });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to add catalogue item');
        return;
      }
      toast.success(`Added ${payload.code} to estimate`);
      setStructurallyDirty(true);
      await loadLineItems();
      router.refresh();
    });
  }, [quote.id, quantity, loadLineItems, router]);

  const handleGroupLabelDrop = useCallback((payload: GroupLabelDragPayload) => {
    startTransition(async () => {
      const result = await createQuoteGroupAction({ quoteId: quote.id, groupLabelLookupId: payload.id });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to create group');
        return;
      }
      toast.success(`Created group "${payload.name}"`);
      await loadLineItems();
      router.refresh();
    });
  }, [quote.id, loadLineItems, router]);

  const handleMoveGroupUp = useCallback((groupId: string) => {
    // Optimistic
    setDbGroups((prev) => swapGroups(prev, groupId, 'up'));
    startTransition(async () => {
      const currentIds = (groupSummaries.length > 0 ? groupSummaries.map((g) => g.id) : dbGroups.map((g) => g.id)).filter(Boolean) as string[];
      const idx = currentIds.indexOf(groupId);
      if (idx <= 0) return;
      const newOrder = [...currentIds];
      [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
      const result = await reorderQuoteGroupsAction({ quoteId: quote.id, groupIds: newOrder });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to reorder groups');
        await loadLineItems();
      }
    });
  }, [quote.id, groupSummaries, dbGroups, loadLineItems]);

  const handleMoveGroupDown = useCallback((groupId: string) => {
    setDbGroups((prev) => swapGroups(prev, groupId, 'down'));
    startTransition(async () => {
      const currentIds = (groupSummaries.length > 0 ? groupSummaries.map((g) => g.id) : dbGroups.map((g) => g.id)).filter(Boolean) as string[];
      const idx = currentIds.indexOf(groupId);
      if (idx < 0 || idx >= currentIds.length - 1) return;
      const newOrder = [...currentIds];
      [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
      const result = await reorderQuoteGroupsAction({ quoteId: quote.id, groupIds: newOrder });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to reorder groups');
        await loadLineItems();
      }
    });
  }, [quote.id, groupSummaries, dbGroups, loadLineItems]);

  const handleReorderLineItems = useCallback((params: { groupId: string; parentComboId?: string; items?: Array<{ id: string; sortIndex: number }>; combos?: Array<{ id: string; sortIndex: number }>; scopes?: Array<{ id: string; sortIndex: number }> }) => {
    setDbGroups((prev) => applyReorderParams(prev, params));
    startTransition(async () => {
      const result = await reorderQuoteLineItemsAction({ quoteId: quote.id, ...params });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to reorder');
        await loadLineItems();
      }
    });
  }, [quote.id, loadLineItems]);

  const handleMoveLineItem = useCallback((params: { itemId?: string; comboId?: string; targetGroupId: string; targetComboId?: string; insertAtIndex?: number }) => {
    startTransition(async () => {
      const result = await moveQuoteLineItemAction({ quoteId: quote.id, ...params });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to move item');
        return;
      }
      toast.success('Item moved');
      setStructurallyDirty(true);
      await loadLineItems();
    });
  }, [quote.id, loadLineItems]);

  const handleDuplicateLineItem = useCallback((params: { itemId?: string; comboId?: string; targetGroupId: string; targetComboId?: string; insertAtIndex?: number }) => {
    startTransition(async () => {
      const result = await duplicateQuoteLineItemAction({ quoteId: quote.id, ...params });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to duplicate item');
        return;
      }
      toast.success('Item duplicated');
      setStructurallyDirty(true);
      await loadLineItems();
    });
  }, [quote.id, loadLineItems]);

  const handleDeleteItem = useCallback((request: DeleteItemRequest) => {
    startTransition(async () => {
      const result = await deleteQuoteItemAction({ quoteId: quote.id, itemId: request.itemId, removeFromCatalogAssembly: false });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to delete item');
        return;
      }
      toast.success('Item deleted');
      setStructurallyDirty(true);
      await loadLineItems();
    });
  }, [quote.id, loadLineItems]);

  const handleDeleteCombo = useCallback((comboId: string) => {
    startTransition(async () => {
      const result = await deleteQuoteComboAction({ quoteId: quote.id, comboId });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to delete assembly');
        return;
      }
      toast.success('Assembly deleted');
      setStructurallyDirty(true);
      await loadLineItems();
    });
  }, [quote.id, loadLineItems]);

  const handleDeleteScope = useCallback((scopeId: string) => {
    startTransition(async () => {
      const result = await deleteQuoteComboAction({ quoteId: quote.id, comboId: scopeId });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to delete scope');
        return;
      }
      toast.success('Scope deleted');
      setStructurallyDirty(true);
      await loadLineItems();
    });
  }, [quote.id, loadLineItems]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    startTransition(async () => {
      const result = await deleteQuoteGroupAction({ quoteId: quote.id, groupId });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to delete group');
        return;
      }
      toast.success('Group deleted');
      await loadLineItems();
    });
  }, [quote.id, loadLineItems]);

  const handleUpdateGroupDimensions = useCallback((groupId: string, dimensions: GroupDimensions) => {
    // Optimistic local update
    setDbGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, length: dimensions.length, width: dimensions.width, height: dimensions.height, perimeter: dimensions.perimeter }
          : g,
      ),
    );
    startTransition(async () => {
      const result = await updateQuoteGroupAction({ quoteId: quote.id, groupId, dimensions });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to update dimensions');
        await loadLineItems();
      }
    });
  }, [quote.id, loadLineItems]);

  // --- Save ---

  function findItemMarkupType(groups: ApiGroup[], itemId: string): string | undefined {
    for (const g of groups) {
      for (const item of g.items ?? []) {
        if (item.id === itemId) return item.markupType;
      }
      for (const combo of g.combos ?? []) {
        for (const item of combo.items ?? []) {
          if (item.id === itemId) return item.markupType;
        }
      }
      for (const scope of g.scopes ?? []) {
        for (const item of scope.items ?? []) {
          if (item.id === itemId) return item.markupType;
        }
        for (const combo of scope.combos ?? []) {
          for (const item of combo.items ?? []) {
            if (item.id === itemId) return item.markupType;
          }
        }
      }
    }
    return undefined;
  }

  const handleSave = useCallback((edits: Record<string, Record<EditableFieldKey, string>>) => {
    startTransition(async () => {
      const items: Array<{ id: string; name?: string; component?: string; description?: string; quantity?: string; unitCost?: string; markupValue?: string; tax?: string; unitType?: string }> = [];
      const combos: Array<{ id: string; name?: string; component?: string; description?: string; quantity?: string }> = [];

      for (const [rowKey, fields] of Object.entries(edits)) {
        const isScope = rowKey.includes('-scope-') && !rowKey.includes('-combo-') && !rowKey.includes('-item-');
        const isCombo = rowKey.includes('-combo-') && !rowKey.includes('-item-');

        if (isScope) {
          const scopeId = rowKey.match(/-scope-([0-9a-f-]{36})$/)?.[1];
          if (scopeId) combos.push({ id: scopeId, name: fields.name, component: fields.component, description: fields.description, quantity: fields.quantity });
        } else if (isCombo) {
          const comboId = rowKey.match(/-combo-([0-9a-f-]{36})$/)?.[1];
          if (comboId) combos.push({ id: comboId, name: fields.name, component: fields.component, description: fields.description, quantity: fields.quantity });
        } else {
          const itemId = rowKey.match(/-item-([0-9a-f-]{36})$/)?.[1];
          if (itemId) {
            const markupType = findItemMarkupType(dbGroups, itemId);
            items.push({
              id: itemId,
              name: fields.name,
              component: fields.component,
              description: fields.description,
              quantity: fields.quantity,
              unitCost: fields.unitCost,
              markupValue: fields.markupValue !== undefined ? uiMarkupToStored(markupType, fields.markupValue) : undefined,
              tax: fields.tax !== undefined ? uiTaxToStored(fields.tax) : undefined,
              unitType: fields.unitType,
            });
          }
        }
      }

      if (items.length === 0 && combos.length === 0) {
        setStructurallyDirty(false);
        onSaveStateChangeRef.current?.('saved');
        return;
      }

      const originals = buildLineItemOriginals(dbGroups, edits);
      const skipUndo = skipUndoRef.current;
      skipUndoRef.current = false;
      onSaveStateChangeRef.current?.('saving');

      const result = await saveQuoteLineItemsAction({ quoteId: quote.id, items, combos });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save line items');
        onSaveStateChangeRef.current?.('error', result.error ?? 'Failed to save');
        return;
      }

      if (!skipUndo && Object.keys(originals).length > 0) {
        onUndoCaptureRef.current?.(originals);
      }
      setStructurallyDirty(false);
      onSaveStateChangeRef.current?.('saved');
      await loadLineItems();
    });
  }, [quote.id, dbGroups, loadLineItems]);

  // --- Imperative handle ---

  useImperativeHandle(ref, () => ({
    save: (edits) => {
      if (edits) skipUndoRef.current = true;
      handleSave(edits ?? {});
    },
    resetEdits: () => {
      setResetEditsKey((k) => k + 1);
      setStructurallyDirty(false);
    },
  }), [handleSave]);

  // --- Actions object ---

  const lineItemsActions: LineItemsActions = useMemo(() => ({
    onSave: readOnly ? undefined : handleSave,
    onCatalogDrop: readOnly ? undefined : handleCatalogDrop,
    onGroupLabelDrop: readOnly ? undefined : handleGroupLabelDrop,
    onDeleteGroup: readOnly ? undefined : handleDeleteGroup,
    onUpdateGroupDimensions: readOnly ? undefined : handleUpdateGroupDimensions,
    onDeleteItem: readOnly ? undefined : handleDeleteItem,
    onDeleteCombo: readOnly ? undefined : handleDeleteCombo,
    onDeleteScope: readOnly ? undefined : handleDeleteScope,
    onMoveGroupUp: readOnly ? undefined : handleMoveGroupUp,
    onMoveGroupDown: readOnly ? undefined : handleMoveGroupDown,
    onOpenCatalogDrawer: readOnly ? undefined : () => onDrawerOpenChange(true),
    onReorderLineItems: readOnly ? undefined : handleReorderLineItems,
    onMoveLineItem: readOnly ? undefined : handleMoveLineItem,
    onDuplicateLineItem: readOnly ? undefined : handleDuplicateLineItem,
  }), [
    readOnly,
    handleSave,
    handleCatalogDrop,
    handleGroupLabelDrop,
    handleDeleteGroup,
    handleUpdateGroupDimensions,
    handleDeleteItem,
    handleDeleteCombo,
    handleDeleteScope,
    handleMoveGroupUp,
    handleMoveGroupDown,
    handleReorderLineItems,
    handleMoveLineItem,
    handleDuplicateLineItem,
    onDrawerOpenChange,
  ]);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <CatalogPickerDrawer open={drawerOpen} onOpenChange={onDrawerOpenChange} catalogType={catalogType} />
      )}

      <LineItemsProvider
        groups={dbGroups}
        mode={readOnly ? 'readonly' : 'edit'}
        paging={{
          page,
          pageSize: LINE_ITEMS_PAGE_SIZE,
          total,
          onPageChange: setPage,
          groupSummaries,
          hiddenGroupIds,
          onHiddenGroupIdsChange: setHiddenGroupIds,
          search,
          onSearchChange: setSearch,
          serverFiltered: true,
        }}
        actions={lineItemsActions}
        resetEditsKey={resetEditsKey}
        structurallyDirty={structurallyDirty}
      >
        <LineItemsTable hideToolbarActions={hideToolbarActions} />
      </LineItemsProvider>
    </div>
  );
});
