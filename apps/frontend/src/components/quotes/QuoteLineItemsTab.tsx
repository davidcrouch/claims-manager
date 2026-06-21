'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Quote } from '@/types/api';
import { CatalogPickerDrawer } from '@/components/catalog/CatalogPickerDrawer';
import { QuoteLineItemsTable, type DeleteItemRequest } from '@/components/quotes/QuoteLineItemsTable';
import { EditGroupDialog } from '@/components/quotes/EditGroupDialog';
import { DeleteGroupDialog } from '@/components/quotes/DeleteGroupDialog';
import { DeleteItemDialog } from '@/components/quotes/DeleteItemDialog';
import type { CatalogDragPayload, GroupLabelDragPayload } from '@/components/catalog/catalog-drag';
import type { ApiGroup } from '@/components/quotes/quote-line-items.types';
import { getPayloadGroups } from '@/components/quotes/quote-line-items.utils';
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
} from '@/app/(app)/quotes/actions';

const PREFIX = 'frontend:QuoteLineItemsTab';

export function QuoteLineItemsTab({
  quote,
  drawerOpen,
  onDrawerOpenChange,
}: {
  quote: Quote;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const payloadGroups = getPayloadGroups(quote);
  const [dbGroups, setDbGroups] = useState<ApiGroup[] | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState<string | null>(null);
  const [activeDropKey, setActiveDropKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<DeleteItemRequest | null>(null);
  const [structurallyDirty, setStructurallyDirty] = useState(false);

  const loadLineItems = useCallback(async () => {
    const result = await getQuoteLineItemsAction(quote.id);
    if (result.success && result.groups) {
      setDbGroups(result.groups as ApiGroup[]);
    } else if (!result.success) {
      console.error(`${PREFIX}.loadLineItems — ${result.error}`);
      setMessage(result.error ?? 'Failed to load line items');
    }
  }, [quote.id]);

  useEffect(() => {
    void loadLineItems();
  }, [loadLineItems]);

  const groups =
    dbGroups && dbGroups.length > 0 ? dbGroups : payloadGroups;

  function handleCatalogDrop(payload: CatalogDragPayload, groupId?: string) {
    setMessage(null);
    startTransition(async () => {
      const qty = quantity.trim() || '1';
      const result =
        payload.kind === 'assembly'
          ? await addCatalogAssemblyToQuoteAction({
              quoteId: quote.id,
              catalogAssemblyId: payload.id,
              quantity: qty,
              groupId,
            })
          : await addCatalogItemToQuoteAction({
              quoteId: quote.id,
              catalogItemId: payload.id,
              quantity: qty,
              groupId,
            });

      if (!result.success) {
        console.error(`${PREFIX}.handleCatalogDrop — ${result.error ?? 'add failed'}`);
        setMessage(result.error ?? 'Failed to add catalogue item');
        return;
      }

      setMessage(`Added ${payload.code} to estimate`);
      setStructurallyDirty(true);
      await loadLineItems();
      router.refresh();
    });
  }

  function handleGroupLabelDrop(payload: GroupLabelDragPayload) {
    setMessage(null);
    startTransition(async () => {
      const result = await createQuoteGroupAction({
        quoteId: quote.id,
        groupLabelLookupId: payload.id,
      });
      if (!result.success) {
        console.error(`${PREFIX}.handleGroupLabelDrop — ${result.error ?? 'create failed'}`);
        setMessage(result.error ?? 'Failed to create group');
        return;
      }
      setMessage(`Created group "${payload.name}"`);
      await loadLineItems();
      router.refresh();
    });
  }


  function handleUpdateGroup(groupId: string, params: { groupLabelLookupId?: string; description?: string }) {
    startTransition(async () => {
      const result = await updateQuoteGroupAction({
        quoteId: quote.id,
        groupId,
        groupLabelLookupId: params.groupLabelLookupId,
        description: params.description,
      });
      if (!result.success) {
        setMessage(result.error ?? 'Failed to update group');
        return;
      }
      setEditingGroupId(null);
      setMessage('Group updated');
      await loadLineItems();
      router.refresh();
    });
  }

  function handleDeleteGroup(groupId: string) {
    startTransition(async () => {
      const result = await deleteQuoteGroupAction({ quoteId: quote.id, groupId });
      if (!result.success) {
        setMessage(result.error ?? 'Failed to delete group');
        return;
      }
      setDeletingGroupId(null);
      setMessage('Group deleted');
      await loadLineItems();
      router.refresh();
    });
  }

  function handleDeleteItem(request: DeleteItemRequest) {
    setDeletingItem(request);
  }

  function confirmDeleteItem(removeFromCatalogAssembly: boolean) {
    if (!deletingItem) return;
    const { itemId } = deletingItem;
    setDeletingItem(null);
    startTransition(async () => {
      const result = await deleteQuoteItemAction({ quoteId: quote.id, itemId, removeFromCatalogAssembly });
      if (!result.success) {
        console.error(`${PREFIX}.confirmDeleteItem — ${result.error}`);
        setMessage(result.error ?? 'Failed to delete item');
        return;
      }
      const extra = result.removedFromCatalog ? ' (also removed from catalogue assembly)' : '';
      setMessage(`Item deleted${extra}`);
      setStructurallyDirty(true);
      await loadLineItems();
      router.refresh();
    });
  }

  function handleDeleteCombo(comboId: string) {
    startTransition(async () => {
      const result = await deleteQuoteComboAction({ quoteId: quote.id, comboId });
      if (!result.success) {
        console.error(`${PREFIX}.handleDeleteCombo — ${result.error}`);
        setMessage(result.error ?? 'Failed to delete assembly');
        return;
      }
      setMessage('Assembly deleted');
      setStructurallyDirty(true);
      await loadLineItems();
      router.refresh();
    });
  }

  function handleSaveLineItems(edits: Record<string, Record<string, string>>) {
    setMessage(null);
    startTransition(async () => {
      const items: Array<{ id: string; name?: string; component?: string; description?: string; quantity?: string; unitCost?: string; markupValue?: string; tax?: string }> = [];
      const combos: Array<{ id: string; name?: string; component?: string; description?: string; quantity?: string }> = [];

      for (const [rowKey, fields] of Object.entries(edits)) {
        const isCombo = rowKey.includes('-combo-') && !rowKey.includes('-item-');
        const idMatch = rowKey.match(/(?:combo|item)-([0-9a-f-]{36})(?:-item-|$)/);
        if (!idMatch) continue;

        if (isCombo) {
          const comboId = rowKey.match(/-combo-([0-9a-f-]{36})$/)?.[1];
          if (comboId) {
            combos.push({ id: comboId, name: fields.name, component: fields.component, description: fields.description, quantity: fields.quantity });
          }
        } else {
          const itemId = rowKey.match(/-item-([0-9a-f-]{36})$/)?.[1];
          if (itemId) {
            const taxDecimal = fields.tax ? String(parseFloat(fields.tax) / 100) : undefined;
            items.push({
              id: itemId,
              name: fields.name,
              component: fields.component,
              description: fields.description,
              quantity: fields.quantity,
              unitCost: fields.unitCost,
              markupValue: fields.markupValue,
              tax: taxDecimal,
            });
          }
        }
      }

      if (items.length === 0 && combos.length === 0) {
        setStructurallyDirty(false);
        setMessage('Changes saved');
        return;
      }

      const result = await saveQuoteLineItemsAction({ quoteId: quote.id, items, combos });
      if (!result.success) {
        console.error(`${PREFIX}.handleSaveLineItems — ${result.error}`);
        setMessage(result.error ?? 'Failed to save line items');
        return;
      }

      setMessage(`Saved ${result.updated} line item${result.updated !== 1 ? 's' : ''}`);
      setStructurallyDirty(false);
      await loadLineItems();
      router.refresh();
    });
  }

  function handleMoveGroup(groupId: string, direction: 'up' | 'down') {
    const currentIds = groups.map((g) => g.id).filter(Boolean) as string[];
    const idx = currentIds.indexOf(groupId);
    if (idx < 0) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= currentIds.length) return;

    const newOrder = [...currentIds];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    startTransition(async () => {
      const result = await reorderQuoteGroupsAction({ quoteId: quote.id, groupIds: newOrder });
      if (!result.success) {
        setMessage(result.error ?? 'Failed to reorder groups');
        return;
      }
      await loadLineItems();
      router.refresh();
    });
  }

  const editingGroup = editingGroupId ? groups.find((g) => g.id === editingGroupId) : null;
  const deletingGroup = deletingGroupId ? groups.find((g) => g.id === deletingGroupId) : null;

  return (
    <div className="space-y-4">
      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      <CatalogPickerDrawer open={drawerOpen} onOpenChange={onDrawerOpenChange} />

      <QuoteLineItemsTable
        groups={groups}
        activeDropKey={activeDropKey}
        setActiveDropKey={setActiveDropKey}
        onCatalogDrop={handleCatalogDrop}
        onGroupLabelDrop={handleGroupLabelDrop}
        onEditGroup={(id) => setEditingGroupId(id)}
        onDeleteGroup={(id) => setDeletingGroupId(id)}
        onDeleteItem={handleDeleteItem}
        onDeleteCombo={handleDeleteCombo}
        onMoveGroupUp={(id) => handleMoveGroup(id, 'up')}
        onMoveGroupDown={(id) => handleMoveGroup(id, 'down')}
        onOpenCatalogDrawer={() => onDrawerOpenChange(true)}
        onSave={handleSaveLineItems}
        structurallyDirty={structurallyDirty}
      />

      {editingGroup && (
        <EditGroupDialog
          open={!!editingGroupId}
          onOpenChange={(open) => { if (!open) setEditingGroupId(null); }}
          group={editingGroup}
          onSave={(params) => handleUpdateGroup(editingGroupId!, params)}
          pending={pending}
        />
      )}

      {deletingGroup && (
        <DeleteGroupDialog
          open={!!deletingGroupId}
          onOpenChange={(open) => { if (!open) setDeletingGroupId(null); }}
          group={deletingGroup}
          onConfirm={() => handleDeleteGroup(deletingGroupId!)}
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
