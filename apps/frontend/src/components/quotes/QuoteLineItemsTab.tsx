'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Quote } from '@/types/api';
import { QuoteCatalogToolbar } from '@/components/quotes/QuoteCatalogToolbar';
import { CatalogPickerDrawer } from '@/components/catalog/CatalogPickerDrawer';
import { QuoteLineItemsTable } from '@/components/quotes/QuoteLineItemsTable';
import type { CatalogDragPayload } from '@/components/catalog/catalog-drag';
import type { ApiGroup } from '@/components/quotes/quote-line-items.types';
import { getPayloadGroups } from '@/components/quotes/quote-line-items.utils';
import {
  addCatalogAssemblyToQuoteAction,
  addCatalogItemToQuoteAction,
  getQuoteLineItemsAction,
} from '@/app/(app)/quotes/actions';

const PREFIX = 'frontend:QuoteLineItemsTab';

export function QuoteLineItemsTab({ quote }: { quote: Quote }) {
  const router = useRouter();
  const payloadGroups = getPayloadGroups(quote);
  const [dbGroups, setDbGroups] = useState<ApiGroup[] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState<string | null>(null);
  const [activeDropKey, setActiveDropKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  if (groups.length === 0 && process.env.NODE_ENV !== 'production') {
    console.debug(`${PREFIX} — no groups on estimate ${quote.id}`);
  }

  return (
    <div className="space-y-4">
      <QuoteCatalogToolbar
        quoteId={quote.id}
        quantity={quantity}
        onQuantityChange={setQuantity}
        pending={pending}
        onOpenCatalogDrawer={() => setDrawerOpen(true)}
        message={message}
      />

      <CatalogPickerDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <QuoteLineItemsTable
        groups={groups}
        activeDropKey={activeDropKey}
        setActiveDropKey={setActiveDropKey}
        onCatalogDrop={handleCatalogDrop}
      />
    </div>
  );
}
