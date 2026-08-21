'use client';

import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
} from '@/components/forms/BottomFormDrawer';
import { CatalogBomEditor } from '@/components/catalog/CatalogBomEditor';
import { fetchCatalogItemForBomAction } from '@/app/(app)/admin/catalog/actions';
import type { CatalogItem } from '@/types/api';

export interface CatalogBomDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  assemblyId?: string;
  companionChatOpen?: boolean;
  componentId?: string;
  quantity?: string;
  wasteFactor?: string;
  [key: string]: unknown;
}

export function CatalogBomDrawer({
  open,
  onOpenChange,
  itemId,
  assemblyId,
  componentId,
  quantity,
  wasteFactor,
}: CatalogBomDrawerProps) {
  const id = itemId ?? assemblyId ?? '';
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [components, setComponents] = useState<
    Array<{
      id: string;
      componentId: string;
      quantity: string;
      wasteFactor: string;
      component?: { code?: string; name?: string; kind?: string };
      resolvedUnitCost?: string | null;
    }>
  >([]);
  const [candidates, setCandidates] = useState<CatalogItem[]>([]);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const data = await fetchCatalogItemForBomAction(id);
      if (cancelled) return;
      if (data) {
        setItem(data.item);
        setComponents(data.components);
        setCandidates(data.candidates);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Bill of materials"
      description={
        item
          ? `Edit BOM for ${item.code} — ${item.name} (${item.kind})`
          : 'Edit assembly or scope components'
      }
      icon={<Layers className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        {!id ? (
          <p className="text-sm text-muted-foreground">Missing assembly or scope id.</p>
        ) : loading && !item ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : item && (item.kind === 'assembly' || item.kind === 'scope') ? (
          <CatalogBomEditor
            assemblyId={id}
            parentKind={item.kind}
            components={components}
            candidateItems={candidates}
            suggestedComponentId={componentId}
            suggestedQuantity={quantity}
            suggestedWasteFactor={wasteFactor}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Only assemblies and scopes have a bill of materials.
          </p>
        )}
      </BottomFormDrawerBody>
    </BottomFormDrawer>
  );
}
