'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { GripVertical, Layers, Package, Pin, PinOff, Search, Tag, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSidebar } from '@/components/ui/sidebar';
import { searchCatalogItemsAction } from '@/app/(app)/admin/catalog/actions';
import { fetchGroupLabelLookupsAction } from '@/app/(app)/quotes/actions';
import type { CatalogItem } from '@/types/api';
import {
  setCatalogDragData,
  setGroupLabelDragData,
  type CatalogDragPayload,
  type GroupLabelDragPayload,
} from '@/components/catalog/catalog-drag';
import { formatCurrency } from '@/components/shared/detail';

export interface CatalogPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toDragPayload(item: CatalogItem): CatalogDragPayload {
  return {
    id: item.id,
    kind: item.kind,
    code: item.code,
    name: item.name,
  };
}

function CatalogRow({ item }: { item: CatalogItem }) {
  const isAssembly = item.kind === 'assembly';

  return (
    <li
      draggable
      onDragStart={(e) => {
        if (!e.dataTransfer) return;
        setCatalogDragData(e.dataTransfer, toDragPayload(item));
        e.currentTarget.classList.add('opacity-50');
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove('opacity-50');
      }}
      className="flex cursor-grab items-start gap-2 rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/40 active:cursor-grabbing"
    >
      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
          <span className="font-medium">{item.name}</span>
        </div>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {item.description}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 capitalize ${
              isAssembly ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
            }`}
          >
            {isAssembly ? (
              <Layers className="h-3 w-3" />
            ) : (
              <Package className="h-3 w-3" />
            )}
            {item.kind}
          </span>
          {item.unitCost && (
            <span>Unit {formatCurrency(item.unitCost)}</span>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---- Items Tab ---- */

function ItemsTab({ open }: { open: boolean }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const [primitives, assemblies] = await Promise.all([
        searchCatalogItemsAction({
          q: debouncedQuery || undefined,
          kind: 'primitive',
          limit: 40,
        }),
        searchCatalogItemsAction({
          q: debouncedQuery || undefined,
          kind: 'assembly',
          limit: 40,
        }),
      ]);
      const merged = [...primitives, ...assemblies].sort((a, b) =>
        a.code.localeCompare(b.code),
      );
      setItems(merged);
    });
  }, [open, debouncedQuery]);

  useEffect(() => {
    if (open) return;
    setQuery('');
    setDebouncedQuery('');
  }, [open]);

  return (
    <>
      <div className="border-b border-slate-100 px-5 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by code or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {pending && items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        )}
        {!pending && items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No catalogue items found
          </p>
        )}
        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((item) => (
              <CatalogRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ---- Group Labels Tab ---- */

interface GroupLabelOption {
  id: string;
  name?: string;
  externalReference?: string;
}

function GroupLabelsTab({ open }: { open: boolean }) {
  const [labels, setLabels] = useState<GroupLabelOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchGroupLabelLookupsAction().then((result) => {
      if (result.success && result.options) {
        setLabels(result.options);
      }
      setLoading(false);
    });
  }, [open]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      {loading && labels.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      )}
      {!loading && labels.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No group labels found
        </p>
      )}
      {labels.length > 0 && (
        <ul className="space-y-2">
          {labels.map((label) => {
            const displayName = label.name ?? label.externalReference ?? label.id;
            const payload: GroupLabelDragPayload = { id: label.id, name: displayName };
            return (
              <li
                key={label.id}
                draggable
                onDragStart={(e) => {
                  if (!e.dataTransfer) return;
                  setGroupLabelDragData(e.dataTransfer, payload);
                  e.currentTarget.classList.add('opacity-50');
                }}
                onDragEnd={(e) => {
                  e.currentTarget.classList.remove('opacity-50');
                }}
                className="flex cursor-grab items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Tag className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="font-medium">{displayName}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---- Main Drawer ---- */

export function CatalogPickerDrawer({ open, onOpenChange }: CatalogPickerDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('items');
  const [pinned, setPinned] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const sidebarStateBeforePin = useRef<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setIsDragging(false);
      return;
    }
    const onStart = () => setIsDragging(true);
    const onEnd = () => setIsDragging(false);
    document.addEventListener('dragstart', onStart);
    document.addEventListener('dragend', onEnd);
    return () => {
      document.removeEventListener('dragstart', onStart);
      document.removeEventListener('dragend', onEnd);
      setIsDragging(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pinned) onOpenChange(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onOpenChange, pinned]);

  useEffect(() => {
    const inset = document.querySelector('[data-slot="sidebar-inset"]') as HTMLElement | null;
    const root = document.documentElement;

    if (open && pinned) {
      root.dataset.catalogDrawerPinned = 'true';
      if (inset) {
        inset.style.transition = 'margin-right 0.2s ease';
        inset.style.marginRight = '28rem';
      }
    } else {
      delete root.dataset.catalogDrawerPinned;
      if (inset) {
        inset.style.marginRight = '';
      }
    }

    return () => {
      delete root.dataset.catalogDrawerPinned;
      if (inset) inset.style.marginRight = '';
    };
  }, [open, pinned]);

  function handleTogglePin() {
    const next = !pinned;
    setPinned(next);
    if (next) {
      sidebarStateBeforePin.current = sidebarOpen;
      setSidebarOpen(false);
    } else {
      if (sidebarStateBeforePin.current !== null) {
        setSidebarOpen(sidebarStateBeforePin.current);
        sidebarStateBeforePin.current = null;
      }
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="catalog-picker-drawer"
          className="pointer-events-none fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Visual backdrop (always inert — never blocks drag events) */}
          {!pinned && (
            <div className="absolute inset-0 bg-slate-900/15 pointer-events-none" aria-hidden />
          )}
          {/* Click-outside-to-close layer — unmounted during drag so it
              cannot intercept drag events passing to drop targets below */}
          {!pinned && !isDragging && (
            <div
              className="absolute inset-0 pointer-events-auto cursor-default"
              onClick={() => onOpenChange(false)}
            />
          )}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-picker-title"
            className="pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200 bg-background shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-linear-to-b from-slate-50 to-white px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/60">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="catalog-picker-title"
                    className="font-heading text-base font-semibold text-slate-900"
                  >
                    Catalogue
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Drag items onto the estimate to add them.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleTogglePin}
                  aria-label={pinned ? 'Unpin drawer' : 'Pin drawer'}
                  title={pinned ? 'Unpin (click outside to close)' : 'Pin open'}
                  className={`rounded-md p-1.5 transition-colors ${pinned ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                >
                  {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close catalogue drawer"
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as string)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="border-b border-slate-100 px-5 pt-2">
                <TabsList variant="line" className="w-full">
                  <TabsTrigger value="items" className="flex-1 gap-1.5 text-xs">
                    <Package className="h-3.5 w-3.5" />
                    Items &amp; Assemblies
                  </TabsTrigger>
                  <TabsTrigger value="groups" className="flex-1 gap-1.5 text-xs">
                    <Tag className="h-3.5 w-3.5" />
                    Group Labels
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="items" className="flex min-h-0 flex-1 flex-col">
                <ItemsTab open={open} />
              </TabsContent>

              <TabsContent value="groups" className="flex min-h-0 flex-1 flex-col">
                <GroupLabelsTab open={open} />
              </TabsContent>
            </Tabs>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
