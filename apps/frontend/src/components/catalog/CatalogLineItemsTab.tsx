'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreateSubmitOverlay } from '@/components/forms/CreateSubmitOverlay';
import { EditGroupDialog } from '@/components/quotes/EditGroupDialog';
import { DeleteGroupDialog } from '@/components/quotes/DeleteGroupDialog';
import { DeleteItemDialog } from '@/components/quotes/DeleteItemDialog';
import {
  LineItemsProvider,
  LineItemsTable,
  type ApiGroup,
  type DeleteItemRequest,
  type EditableFieldKey,
  type LineItemsActions,
  LINE_ITEMS_PAGE_SIZE,
} from '@/components/line-items';
import { uiMarkupToStored, uiTaxToStored } from '@/lib/rates';
import {
  getCatalogGroupedItemsAction,
  saveCatalogLineItemsAction,
  deleteCatalogItemAction,
} from '@/app/(app)/admin/catalog/actions';

const PREFIX = 'frontend:CatalogLineItemsTab';

function findCatalogItemMarkupType(groups: ApiGroup[], catalogItemId: string): string | undefined {
  for (const g of groups) {
    for (const item of g.items ?? []) {
      if (item.catalogItemId === catalogItemId || item.id === catalogItemId) return item.markupType;
    }
    for (const combo of g.combos ?? []) {
      if (combo.catalogComboId === catalogItemId || combo.id === catalogItemId) return undefined;
      for (const item of combo.items ?? []) {
        if (item.catalogItemId === catalogItemId || item.id === catalogItemId) return item.markupType;
      }
    }
    for (const scope of g.scopes ?? []) {
      for (const item of scope.items ?? []) {
        if (item.catalogItemId === catalogItemId || item.id === catalogItemId) return item.markupType;
      }
      for (const combo of scope.combos ?? []) {
        for (const item of combo.items ?? []) {
          if (item.catalogItemId === catalogItemId || item.id === catalogItemId) return item.markupType;
        }
      }
    }
  }
  return undefined;
}

function mapCatalogGroupsToApiGroups(
  groups: Awaited<ReturnType<typeof getCatalogGroupedItemsAction>>['groups'],
): ApiGroup[] {
  if (!groups) return [];
  return groups.map((g) => ({
    id: g.id,
    groupLabel: g.groupLabel,
    description: g.description,
    items: g.items?.map((item) => ({
      id: item.id,
      name: item.name,
      component: item.component,
      description: item.description,
      type: item.type || undefined,
      category: item.category || undefined,
      subCategory: item.subCategory,
      quantity: item.quantity,
      unitCost: item.unitCost,
      buyCost: item.buyCost,
      markupType: item.markupType || undefined,
      markupValue: item.markupValue,
      tax: item.tax,
      unitType: item.unitType ?? undefined,
      catalogItemId: item.catalogItemId,
    })),
    combos: g.combos?.map((combo) => ({
      id: combo.id,
      name: combo.name,
      component: combo.component,
      description: combo.description,
      category: combo.category || undefined,
      subCategory: combo.subCategory,
      quantity: combo.quantity,
      catalogComboId: combo.catalogComboId,
      items: combo.items?.map((item) => ({
        id: item.id,
        name: item.name,
        component: item.component,
        description: item.description,
        type: item.type || undefined,
        category: item.category || undefined,
        subCategory: item.subCategory,
        quantity: item.quantity,
        unitCost: item.unitCost,
        buyCost: item.buyCost,
        markupType: item.markupType || undefined,
        markupValue: item.markupValue,
        tax: item.tax,
        unitType: item.unitType ?? undefined,
        catalogItemId: item.catalogItemId,
      })),
    })),
    scopes: g.scopes?.map((scope) => ({
      id: scope.id,
      name: scope.name,
      component: scope.component,
      description: scope.description,
      category: scope.category || undefined,
      subCategory: scope.subCategory,
      quantity: scope.quantity,
      catalogScopeId: scope.catalogScopeId,
      items: scope.items?.map((item) => ({
        id: item.id,
        name: item.name,
        component: item.component,
        description: item.description,
        type: item.type || undefined,
        category: item.category || undefined,
        subCategory: item.subCategory,
        quantity: item.quantity,
        unitCost: item.unitCost,
        buyCost: item.buyCost,
        markupType: item.markupType || undefined,
        markupValue: item.markupValue,
        tax: item.tax,
        unitType: item.unitType ?? undefined,
        catalogItemId: item.catalogItemId,
      })),
      combos: scope.combos?.map((combo) => ({
        id: combo.id,
        name: combo.name,
        component: combo.component,
        description: combo.description,
        category: combo.category || undefined,
        subCategory: combo.subCategory,
        quantity: combo.quantity,
        catalogComboId: combo.catalogComboId,
        items: combo.items?.map((item) => ({
          id: item.id,
          name: item.name,
          component: item.component,
          description: item.description,
          type: item.type || undefined,
          category: item.category || undefined,
          subCategory: item.subCategory,
          quantity: item.quantity,
          unitCost: item.unitCost,
          buyCost: item.buyCost,
          markupType: item.markupType || undefined,
          markupValue: item.markupValue,
          tax: item.tax,
          unitType: item.unitType ?? undefined,
          catalogItemId: item.catalogItemId,
        })),
      })),
    })),
  }));
}

export function CatalogLineItemsTab({
  catalogId,
  search,
  onDirtyChange,
  reloadToken = 0,
}: {
  catalogId: string;
  search?: string;
  onDirtyChange?: (dirty: boolean, save: () => void) => void;
  reloadToken?: number;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [groupSummaries, setGroupSummaries] = useState<Array<{ id: string; label: string }>>([]);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(true);
  const [pending, startTransition] = useTransition();
  const [structurallyDirty, setStructurallyDirty] = useState(false);
  const latestEditsRef = useRef<Record<string, Record<string, string>>>({});
  const saveRef = useRef<((edits: Record<string, Record<string, string>>) => void) | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<DeleteItemRequest | null>(null);

  const visibleCategoryIds = useMemo(() => {
    if (hiddenGroupIds.size === 0 || groupSummaries.length === 0) return undefined;
    const visible = groupSummaries.map((g) => g.id).filter((id) => !hiddenGroupIds.has(id));
    return visible;
  }, [hiddenGroupIds, groupSummaries]);

  const loadGroupedItems = useCallback(async () => {
    try {
      const result = await getCatalogGroupedItemsAction({
        catalogId,
        search: search || undefined,
        categoryIds: visibleCategoryIds,
        page,
        limit: LINE_ITEMS_PAGE_SIZE,
      });
      if (result.success && result.groups) {
        setGroups(mapCatalogGroupsToApiGroups(result.groups));
        setTotal(result.total ?? 0);
        if (result.groupSummaries) {
          setGroupSummaries(result.groupSummaries.map((g) => ({ id: g.id, label: g.label })));
        }
      } else if (!result.success) {
        console.error(`${PREFIX}.loadGroupedItems — ${result.error}`);
        toast.error(result.error ?? 'Failed to load catalogue items');
      }
    } finally {
      setInitialLoad(false);
    }
  }, [catalogId, search, visibleCategoryIds, page]);

  useEffect(() => {
    setPage(1);
  }, [search, hiddenGroupIds]);

  useEffect(() => {
    void loadGroupedItems();
  }, [loadGroupedItems, reloadToken]);

  function handleDeleteItem(request: DeleteItemRequest) {
    setDeletingItem(request);
  }

  function confirmDeleteItem(_removeFromCatalogAssembly: boolean) {
    if (!deletingItem) return;
    const { itemId } = deletingItem;
    setDeletingItem(null);
    startTransition(async () => {
      const result = await deleteCatalogItemAction(itemId);
      if (!result.success) {
        console.error(`${PREFIX}.confirmDeleteItem — ${result.error}`);
        toast.error(result.error ?? 'Failed to delete item');
        return;
      }
      toast.success('Item deleted');
      setStructurallyDirty(true);
      await loadGroupedItems();
      router.refresh();
    });
  }

  function handleDeleteCombo(comboId: string) {
    startTransition(async () => {
      const result = await deleteCatalogItemAction(comboId);
      if (!result.success) {
        console.error(`${PREFIX}.handleDeleteCombo — ${result.error}`);
        toast.error(result.error ?? 'Failed to delete assembly');
        return;
      }
      toast.success('Assembly deleted');
      setStructurallyDirty(true);
      await loadGroupedItems();
      router.refresh();
    });
  }

  function handleDeleteScope(scopeId: string) {
    startTransition(async () => {
      const result = await deleteCatalogItemAction(scopeId);
      if (!result.success) {
        console.error(`${PREFIX}.handleDeleteScope — ${result.error}`);
        toast.error(result.error ?? 'Failed to delete scope');
        return;
      }
      toast.success('Scope deleted');
      setStructurallyDirty(true);
      await loadGroupedItems();
      router.refresh();
    });
  }

  function handleSaveLineItems(edits: Record<string, Record<string, string>>) {
    startTransition(async () => {
      const items: Array<{
        id: string;
        name?: string;
        description?: string;
        unitType?: string;
        unitCost?: string;
        markupValue?: string;
        tax?: string;
      }> = [];

      const bomUpdates: Array<{
        assemblyId: string;
        lineId: string;
        componentId: string;
        quantity: string;
      }> = [];

      const bomItemIdMap = new Map<string, string>();
      for (const group of groups) {
        for (const combo of group.combos ?? []) {
          for (const item of combo.items ?? []) {
            if (item.id && item.catalogItemId) {
              bomItemIdMap.set(item.id, item.catalogItemId);
            }
          }
        }
        for (const scope of group.scopes ?? []) {
          for (const item of scope.items ?? []) {
            if (item.id && item.catalogItemId) {
              bomItemIdMap.set(item.id, item.catalogItemId);
            }
          }
          for (const combo of scope.combos ?? []) {
            for (const item of combo.items ?? []) {
              if (item.id && item.catalogItemId) {
                bomItemIdMap.set(item.id, item.catalogItemId);
              }
            }
          }
        }
      }

      for (const [rowKey, fields] of Object.entries(edits)) {
        const isScope = rowKey.includes('-scope-') && !rowKey.includes('-combo-') && !rowKey.includes('-item-');
        const isCombo = rowKey.includes('-combo-') && !rowKey.includes('-item-');
        const bomMatch = rowKey.match(/-combo-([0-9a-f-]{36})-item-([0-9a-f-]{36})$/);

        if (isScope) {
          const scopeId = rowKey.match(/-scope-([0-9a-f-]{36})$/)?.[1];
          if (scopeId) {
            items.push({
              id: scopeId,
              name: fields.name,
              description: fields.description,
            });
          }
        } else if (isCombo) {
          const comboId = rowKey.match(/-combo-([0-9a-f-]{36}|__[a-z]+__)$/)?.[1];
          if (comboId && !comboId.startsWith('__')) {
            items.push({
              id: comboId,
              name: fields.name,
              description: fields.description,
            });
          }
        } else if (bomMatch) {
          const [, assemblyId, lineId] = bomMatch;
          const catalogItemId = bomItemIdMap.get(lineId);
          if (catalogItemId) {
            const markupType = findCatalogItemMarkupType(groups, catalogItemId);
            items.push({
              id: catalogItemId,
              name: fields.name,
              description: fields.description,
              unitType: fields.unitType,
              unitCost: fields.unitCost,
              markupValue:
                fields.markupValue !== undefined
                  ? uiMarkupToStored(markupType, fields.markupValue)
                  : undefined,
              tax: fields.tax !== undefined ? uiTaxToStored(fields.tax) : undefined,
            });
          }
          if (fields.quantity !== undefined && catalogItemId) {
            bomUpdates.push({
              assemblyId,
              lineId,
              componentId: catalogItemId,
              quantity: fields.quantity,
            });
          }
        } else {
          const itemId = rowKey.match(/-item-([0-9a-f-]{36})$/)?.[1];
          if (itemId) {
            const catalogItemId = bomItemIdMap.get(itemId) ?? itemId;
            const markupType = findCatalogItemMarkupType(groups, catalogItemId);
            items.push({
              id: catalogItemId,
              name: fields.name,
              description: fields.description,
              unitType: fields.unitType,
              unitCost: fields.unitCost,
              markupValue:
                fields.markupValue !== undefined
                  ? uiMarkupToStored(markupType, fields.markupValue)
                  : undefined,
              tax: fields.tax !== undefined ? uiTaxToStored(fields.tax) : undefined,
            });
            const scopeBomMatch = rowKey.match(/-scope-([0-9a-f-]{36})-item-([0-9a-f-]{36})$/);
            if (scopeBomMatch && fields.quantity !== undefined) {
              const [, scopeId, lineId] = scopeBomMatch;
              bomUpdates.push({
                assemblyId: scopeId,
                lineId,
                componentId: catalogItemId,
                quantity: fields.quantity,
              });
            }
          }
        }
      }

      if (items.length === 0 && bomUpdates.length === 0) {
        setStructurallyDirty(false);
        toast.success('Changes saved');
        return;
      }

      const result = await saveCatalogLineItemsAction({ items, bomUpdates });
      if (!result.success) {
        console.error(`${PREFIX}.handleSaveLineItems — ${result.error}`);
        toast.error(result.error ?? 'Failed to save catalogue items');
        return;
      }

      toast.success(`Saved ${result.updated} item${result.updated !== 1 ? 's' : ''}`);
      setStructurallyDirty(false);
      await loadGroupedItems();
      router.refresh();
    });
  }

  saveRef.current = handleSaveLineItems;

  const handleTableDirtyChange = useCallback(
    (dirty: boolean, edits: Record<string, Record<string, string>>) => {
      latestEditsRef.current = edits;
      onDirtyChange?.(dirty, () => saveRef.current?.(edits));
    },
    [onDirtyChange],
  );

  function handleMoveGroup(groupId: string, direction: 'up' | 'down') {
    const currentIds = groups.map((g) => g.id).filter(Boolean) as string[];
    const idx = currentIds.indexOf(groupId);
    if (idx < 0) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= currentIds.length) return;

    const newOrder = [...groups];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setGroups(newOrder);
  }

  const editingGroup = editingGroupId ? groups.find((g) => g.id === editingGroupId) : null;
  const deletingGroup = deletingGroupId ? groups.find((g) => g.id === deletingGroupId) : null;

  const catalogActions: LineItemsActions = useMemo(() => ({
    onSave: handleSaveLineItems,
    onEditGroup: (id: string) => setEditingGroupId(id),
    onDeleteGroup: (id: string) => setDeletingGroupId(id),
    onDeleteItem: handleDeleteItem,
    onDeleteCombo: handleDeleteCombo,
    onDeleteScope: handleDeleteScope,
    onMoveGroupUp: (id: string) => handleMoveGroup(id, 'up'),
    onMoveGroupDown: (id: string) => handleMoveGroup(id, 'down'),
  }), [handleDeleteCombo, handleDeleteScope, loadGroupedItems]);

  return (
    <div className="space-y-4">
      <CreateSubmitOverlay phase={initialLoad ? 'loading' : 'idle'} entityLabel="catalogue" />
      <LineItemsProvider
        groups={groups}
        mode="catalog"
        paging={{
          page,
          pageSize: LINE_ITEMS_PAGE_SIZE,
          total,
          onPageChange: setPage,
          groupSummaries,
          hiddenGroupIds,
          onHiddenGroupIdsChange: setHiddenGroupIds,
          serverFiltered: true,
        }}
        actions={catalogActions}
        structurallyDirty={structurallyDirty}
      >
        <LineItemsTable />
      </LineItemsProvider>

      {editingGroup && (
        <EditGroupDialog
          open={!!editingGroupId}
          onOpenChange={(open) => { if (!open) setEditingGroupId(null); }}
          group={editingGroup}
          onSave={() => setEditingGroupId(null)}
          pending={pending}
        />
      )}

      {deletingGroup && (
        <DeleteGroupDialog
          open={!!deletingGroupId}
          onOpenChange={(open) => { if (!open) setDeletingGroupId(null); }}
          group={deletingGroup}
          onConfirm={() => setDeletingGroupId(null)}
          pending={pending}
        />
      )}

      {deletingItem && (
        <DeleteItemDialog
          open={!!deletingItem}
          onOpenChange={(open) => { if (!open) setDeletingItem(null); }}
          itemName={deletingItem.itemName}
          isAssemblyChild={deletingItem.isAssemblyChild}
          onConfirm={confirmDeleteItem}
          pending={pending}
        />
      )}
    </div>
  );
}
