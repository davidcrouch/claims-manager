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
import type { PurchaseOrder, CatalogType } from '@/types/api';
import { CatalogPickerDrawer } from '@/components/catalog/CatalogPickerDrawer';
import type { CatalogDragPayload, GroupLabelDragPayload } from '@/components/catalog/catalog-drag';
import { uiMarkupToStored, uiTaxToStored } from '@/lib/rates';
import {
  addCatalogAssemblyToPurchaseOrderAction,
  addCatalogItemToPurchaseOrderAction,
  createPurchaseOrderGroupAction,
  updatePurchaseOrderGroupAction,
  deletePurchaseOrderGroupAction,
  deletePurchaseOrderItemAction,
  deletePurchaseOrderComboAction,
  reorderPurchaseOrderGroupsAction,
  getPurchaseOrderLineItemsAction,
  savePurchaseOrderLineItemsAction,
  reorderPurchaseOrderLineItemsAction,
  movePurchaseOrderLineItemAction,
  duplicatePurchaseOrderLineItemAction,
} from '@/app/(app)/purchase-orders/actions';

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
import { parseRowKey } from './lib/row-keys';

const PREFIX = 'frontend:PurchaseOrderLineItemsTab';

export type PoLineItemEdits = Record<string, Record<string, string>>;

export interface PurchaseOrderLineItemsTabHandle {
  save: (edits?: PoLineItemEdits) => void;
  resetEdits: () => void;
}

export const PurchaseOrderLineItemsTab = forwardRef(function PurchaseOrderLineItemsTab(
  {
    purchaseOrder,
    drawerOpen,
    onDrawerOpenChange,
    catalogType,
    readOnly = false,
    onDirtyChange,
    hideToolbarActions = false,
    onUndoCapture,
    onSaveStateChange,
  }: {
    purchaseOrder: PurchaseOrder;
    drawerOpen: boolean;
    onDrawerOpenChange: (open: boolean) => void;
    catalogType?: CatalogType;
    readOnly?: boolean;
    onDirtyChange?: (dirty: boolean, save: () => void) => void;
    hideToolbarActions?: boolean;
    onUndoCapture?: (restoreEdits: PoLineItemEdits) => void;
    onSaveStateChange?: (state: 'saving' | 'saved' | 'error', error?: string) => void;
  },
  ref: Ref<PurchaseOrderLineItemsTabHandle>,
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
  const [, startTransition] = useTransition();
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

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, hiddenGroupIds]);

  const loadLineItems = useCallback(async () => {
    if (visibleGroupIds && visibleGroupIds.length === 0) {
      setDbGroups([]);
      setTotal(0);
      return;
    }
    const result = await getPurchaseOrderLineItemsAction(purchaseOrder.id, {
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
  }, [purchaseOrder.id, debouncedSearch, visibleGroupIds, page]);

  useEffect(() => {
    void loadLineItems();
  }, [loadLineItems]);

  const handleCatalogDrop = useCallback(
    (payload: CatalogDragPayload, groupId?: string, purchaseOrderComboId?: string) => {
      startTransition(async () => {
        const qty = quantity.trim() || '1';
        const nestUnderComboId = payload.kind === 'scope' ? undefined : purchaseOrderComboId;
        const result =
          payload.kind === 'assembly' || payload.kind === 'scope'
            ? await addCatalogAssemblyToPurchaseOrderAction({
                purchaseOrderId: purchaseOrder.id,
                catalogAssemblyId: payload.id,
                quantity: qty,
                groupId,
              })
            : await addCatalogItemToPurchaseOrderAction({
                purchaseOrderId: purchaseOrder.id,
                catalogItemId: payload.id,
                quantity: qty,
                groupId,
                purchaseOrderComboId: nestUnderComboId,
              });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to add catalogue item');
          return;
        }
        toast.success(`Added ${payload.code} to purchase order`);
        setStructurallyDirty(true);
        await loadLineItems();
        router.refresh();
      });
    },
    [purchaseOrder.id, quantity, loadLineItems, router],
  );

  const handleGroupLabelDrop = useCallback(
    (payload: GroupLabelDragPayload) => {
      startTransition(async () => {
        const result = await createPurchaseOrderGroupAction({
          purchaseOrderId: purchaseOrder.id,
          groupLabelLookupId: payload.id,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to create group');
          return;
        }
        toast.success(`Created group "${payload.name}"`);
        await loadLineItems();
        router.refresh();
      });
    },
    [purchaseOrder.id, loadLineItems, router],
  );

  const handleMoveGroupUp = useCallback(
    (groupId: string) => {
      setDbGroups((prev) => swapGroups(prev, groupId, 'up'));
      startTransition(async () => {
        const currentIds = (
          groupSummaries.length > 0
            ? groupSummaries.map((g) => g.id)
            : dbGroups.map((g) => g.id)
        ).filter(Boolean) as string[];
        const idx = currentIds.indexOf(groupId);
        if (idx <= 0) return;
        const newOrder = [...currentIds];
        [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
        const result = await reorderPurchaseOrderGroupsAction({
          purchaseOrderId: purchaseOrder.id,
          groupIds: newOrder,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to reorder groups');
          await loadLineItems();
        }
      });
    },
    [purchaseOrder.id, groupSummaries, dbGroups, loadLineItems],
  );

  const handleMoveGroupDown = useCallback(
    (groupId: string) => {
      setDbGroups((prev) => swapGroups(prev, groupId, 'down'));
      startTransition(async () => {
        const currentIds = (
          groupSummaries.length > 0
            ? groupSummaries.map((g) => g.id)
            : dbGroups.map((g) => g.id)
        ).filter(Boolean) as string[];
        const idx = currentIds.indexOf(groupId);
        if (idx < 0 || idx >= currentIds.length - 1) return;
        const newOrder = [...currentIds];
        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
        const result = await reorderPurchaseOrderGroupsAction({
          purchaseOrderId: purchaseOrder.id,
          groupIds: newOrder,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to reorder groups');
          await loadLineItems();
        }
      });
    },
    [purchaseOrder.id, groupSummaries, dbGroups, loadLineItems],
  );

  const handleReorderLineItems = useCallback(
    (params: {
      groupId: string;
      parentComboId?: string;
      items?: Array<{ id: string; sortIndex: number }>;
      combos?: Array<{ id: string; sortIndex: number }>;
      scopes?: Array<{ id: string; sortIndex: number }>;
    }) => {
      setDbGroups((prev) => applyReorderParams(prev, params));
      startTransition(async () => {
        const result = await reorderPurchaseOrderLineItemsAction({
          purchaseOrderId: purchaseOrder.id,
          ...params,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to reorder');
          await loadLineItems();
        }
      });
    },
    [purchaseOrder.id, loadLineItems],
  );

  const handleMoveLineItem = useCallback(
    (params: {
      itemId?: string;
      comboId?: string;
      targetGroupId: string;
      targetComboId?: string;
      insertAtIndex?: number;
    }) => {
      startTransition(async () => {
        const result = await movePurchaseOrderLineItemAction({
          purchaseOrderId: purchaseOrder.id,
          ...params,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to move item');
          return;
        }
        toast.success('Item moved');
        setStructurallyDirty(true);
        await loadLineItems();
      });
    },
    [purchaseOrder.id, loadLineItems],
  );

  const handleDuplicateLineItem = useCallback(
    (params: {
      itemId?: string;
      comboId?: string;
      targetGroupId: string;
      targetComboId?: string;
      insertAtIndex?: number;
    }) => {
      startTransition(async () => {
        const result = await duplicatePurchaseOrderLineItemAction({
          purchaseOrderId: purchaseOrder.id,
          ...params,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to duplicate item');
          return;
        }
        toast.success('Item duplicated');
        setStructurallyDirty(true);
        await loadLineItems();
      });
    },
    [purchaseOrder.id, loadLineItems],
  );

  const handleDeleteItem = useCallback(
    (request: DeleteItemRequest) => {
      startTransition(async () => {
        const result = await deletePurchaseOrderItemAction({
          purchaseOrderId: purchaseOrder.id,
          itemId: request.itemId,
          removeFromCatalogAssembly: false,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to delete item');
          return;
        }
        toast.success('Item deleted');
        setStructurallyDirty(true);
        await loadLineItems();
      });
    },
    [purchaseOrder.id, loadLineItems],
  );

  const handleDeleteCombo = useCallback(
    (comboId: string) => {
      startTransition(async () => {
        const result = await deletePurchaseOrderComboAction({
          purchaseOrderId: purchaseOrder.id,
          comboId,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to delete assembly');
          return;
        }
        toast.success('Assembly deleted');
        setStructurallyDirty(true);
        await loadLineItems();
      });
    },
    [purchaseOrder.id, loadLineItems],
  );

  const handleDeleteScope = useCallback(
    (scopeId: string) => {
      startTransition(async () => {
        const result = await deletePurchaseOrderComboAction({
          purchaseOrderId: purchaseOrder.id,
          comboId: scopeId,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to delete scope');
          return;
        }
        toast.success('Scope deleted');
        setStructurallyDirty(true);
        await loadLineItems();
      });
    },
    [purchaseOrder.id, loadLineItems],
  );

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      startTransition(async () => {
        const result = await deletePurchaseOrderGroupAction({
          purchaseOrderId: purchaseOrder.id,
          groupId,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to delete group');
          return;
        }
        toast.success('Group deleted');
        await loadLineItems();
      });
    },
    [purchaseOrder.id, loadLineItems],
  );

  const handleUpdateGroupDimensions = useCallback(
    (groupId: string, dimensions: GroupDimensions) => {
      setDbGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                length: dimensions.length,
                width: dimensions.width,
                height: dimensions.height,
                perimeter: dimensions.perimeter,
              }
            : g,
        ),
      );
      startTransition(async () => {
        const result = await updatePurchaseOrderGroupAction({
          purchaseOrderId: purchaseOrder.id,
          groupId,
          dimensions,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to update dimensions');
          await loadLineItems();
        }
      });
    },
    [purchaseOrder.id, loadLineItems],
  );

  const handleUpdateGroupComponent = useCallback(
    (groupId: string, component: string) => {
      setDbGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, component } : g)),
      );
      startTransition(async () => {
        const result = await updatePurchaseOrderGroupAction({
          purchaseOrderId: purchaseOrder.id,
          groupId,
          component,
        });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to update component');
          await loadLineItems();
        }
      });
    },
    [purchaseOrder.id, loadLineItems],
  );

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

  const handleSave = useCallback(
    (edits: Record<string, Record<EditableFieldKey, string>>) => {
      startTransition(async () => {
        const items: Array<{
          id: string;
          name?: string;
          component?: string;
          description?: string;
          quantity?: string;
          unitCost?: string;
          markupValue?: string;
          tax?: string;
          unitType?: string;
        }> = [];
        const combos: Array<{
          id: string;
          name?: string;
          component?: string;
          description?: string;
          quantity?: string;
        }> = [];

        for (const [rowKey, fields] of Object.entries(edits)) {
          const parsed = parseRowKey(rowKey);
          if (!parsed) {
            console.warn(`${PREFIX}.handleSave — unparsed row key`, rowKey);
            continue;
          }

          if (parsed.type === 'scope' || parsed.type === 'assembly') {
            combos.push({
              id: parsed.id,
              name: fields.name,
              component: fields.component,
              description: fields.description,
              quantity: fields.quantity,
            });
            continue;
          }

          const markupType = findItemMarkupType(dbGroups, parsed.id);
          items.push({
            id: parsed.id,
            name: fields.name,
            component: fields.component,
            description: fields.description,
            quantity: fields.quantity,
            unitCost: fields.unitCost,
            markupValue:
              fields.markupValue !== undefined
                ? uiMarkupToStored(markupType, fields.markupValue)
                : undefined,
            tax: fields.tax !== undefined ? uiTaxToStored(fields.tax) : undefined,
            unitType: fields.unitType,
          });
        }

        if (items.length === 0 && combos.length === 0) {
          if (Object.keys(edits).length > 0) {
            console.error(
              `${PREFIX}.handleSave — edits present but no items/combos parsed`,
              Object.keys(edits),
            );
            onSaveStateChangeRef.current?.('error', 'Failed to save line items');
            return;
          }
          setStructurallyDirty(false);
          onSaveStateChangeRef.current?.('saved');
          return;
        }

        const originals = buildLineItemOriginals(dbGroups, edits);
        const skipUndo = skipUndoRef.current;
        skipUndoRef.current = false;
        onSaveStateChangeRef.current?.('saving');

        const result = await savePurchaseOrderLineItemsAction({
          purchaseOrderId: purchaseOrder.id,
          items,
          combos,
        });
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
        setResetEditsKey((k) => k + 1);
      });
    },
    [purchaseOrder.id, dbGroups, loadLineItems],
  );

  const latestEditsRef = useRef<Record<string, Record<EditableFieldKey, string>>>({});
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  const handleTableDirtyChange = useCallback(
    (dirty: boolean, edits: Record<string, Record<EditableFieldKey, string>>) => {
      latestEditsRef.current = edits;
      onDirtyChange?.(dirty, () => saveRef.current(latestEditsRef.current));
    },
    [onDirtyChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      save: (edits) => {
        if (edits) skipUndoRef.current = true;
        handleSave(edits ?? {});
      },
      resetEdits: () => {
        setResetEditsKey((k) => k + 1);
        setStructurallyDirty(false);
      },
    }),
    [handleSave],
  );

  const lineItemsActions: LineItemsActions = useMemo(
    () => ({
      onSave: readOnly ? undefined : handleSave,
      onCatalogDrop: readOnly ? undefined : handleCatalogDrop,
      onGroupLabelDrop: readOnly ? undefined : handleGroupLabelDrop,
      onDeleteGroup: readOnly ? undefined : handleDeleteGroup,
      onUpdateGroupDimensions: readOnly ? undefined : handleUpdateGroupDimensions,
      onUpdateGroupComponent: readOnly ? undefined : handleUpdateGroupComponent,
      onDeleteItem: readOnly ? undefined : handleDeleteItem,
      onDeleteCombo: readOnly ? undefined : handleDeleteCombo,
      onDeleteScope: readOnly ? undefined : handleDeleteScope,
      onMoveGroupUp: readOnly ? undefined : handleMoveGroupUp,
      onMoveGroupDown: readOnly ? undefined : handleMoveGroupDown,
      onOpenCatalogDrawer: readOnly ? undefined : () => onDrawerOpenChange(true),
      onReorderLineItems: readOnly ? undefined : handleReorderLineItems,
      onMoveLineItem: readOnly ? undefined : handleMoveLineItem,
      onDuplicateLineItem: readOnly ? undefined : handleDuplicateLineItem,
      onDirtyChange: handleTableDirtyChange,
    }),
    [
      readOnly,
      handleSave,
      handleCatalogDrop,
      handleGroupLabelDrop,
      handleDeleteGroup,
      handleUpdateGroupDimensions,
      handleUpdateGroupComponent,
      handleDeleteItem,
      handleDeleteCombo,
      handleDeleteScope,
      handleMoveGroupUp,
      handleMoveGroupDown,
      handleReorderLineItems,
      handleMoveLineItem,
      handleDuplicateLineItem,
      handleTableDirtyChange,
      onDrawerOpenChange,
    ],
  );

  return (
    <div className="space-y-4">
      {!readOnly && (
        <CatalogPickerDrawer
          open={drawerOpen}
          onOpenChange={onDrawerOpenChange}
          catalogType={catalogType}
        />
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
