'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { GripVertical, Layers, Package, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchCatalogItemsAction } from '@/app/(app)/admin/catalog/actions';
import type { CatalogItem } from '@/types/api';
import {
  setCatalogDragData,
  type CatalogDragPayload,
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

export function CatalogPickerDrawer({ open, onOpenChange }: CatalogPickerDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) return;
    setQuery('');
    setDebouncedQuery('');
  }, [open]);

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
          <div
            className="pointer-events-none absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]"
            aria-hidden
          />
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
                    Drag items or assemblies onto a line item group below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close catalogue drawer"
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
