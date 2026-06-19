'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Quote } from '@/types/api';
import { CatalogPickerDrawer } from '@/components/catalog/CatalogPickerDrawer';
import { QuoteLineItemsTable } from '@/components/quotes/QuoteLineItemsTable';
import { EditGroupDialog } from '@/components/quotes/EditGroupDialog';
import { DeleteGroupDialog } from '@/components/quotes/DeleteGroupDialog';
import type { CatalogDragPayload, GroupLabelDragPayload } from '@/components/catalog/catalog-drag';
import type { ApiGroup } from '@/components/quotes/quote-line-items.types';
import { getPayloadGroups } from '@/components/quotes/quote-line-items.utils';
import {
  addCatalogAssemblyToQuoteAction,
  addCatalogItemToQuoteAction,
  createQuoteGroupAction,
  updateQuoteGroupAction,
  deleteQuoteGroupAction,
  reorderQuoteGroupsAction,
  getQuoteLineItemsAction,
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

  const loadLineItems = useCallback(async () => {
    const result = await getQuoteLineItemsAction(quote.id);
    if (result.success && result.groups) {
      setDbGroups(result.groups as ApiGroup[]);
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
        onMoveGroupUp={(id) => handleMoveGroup(id, 'up')}
        onMoveGroupDown={(id) => handleMoveGroup(id, 'down')}
        onOpenCatalogDrawer={() => onDrawerOpenChange(true)}
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
    </div>
  );
}
