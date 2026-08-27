'use client';

import { BookCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CatalogSourcePushItem } from './lib/catalog-update';

export interface CatalogUpdateConfirmDialogProps {
  open: boolean;
  items: CatalogSourcePushItem[];
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CatalogUpdateConfirmDialog({
  open,
  items,
  pending = false,
  onConfirm,
  onCancel,
}: CatalogUpdateConfirmDialogProps) {
  const count = items.length;
  const preview = items.slice(0, 8);
  const extra = count - preview.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <BookCopy className="h-6 w-6" />
            </div>
            <div className="space-y-2 pt-0.5">
              <DialogTitle className="text-xl">
                Update {count === 1 ? 'catalogue item' : 'catalogue items'}?
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                The estimate has been saved. Apply the same changes to the linked
                catalogue {count === 1 ? 'item' : 'items'} so future estimates use
                these values?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {count === 1 ? 'Catalogue item' : `${count} catalogue items`}
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-800">
            {preview.map((item) => (
              <li key={item.id} className="truncate">
                {item.label}
              </li>
            ))}
            {extra > 0 && (
              <li className="text-slate-500">and {extra} more</li>
            )}
          </ul>
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          Quantity on this estimate is not copied to the catalogue. Name, description,
          unit, cost, markup, and tax will be updated where they changed.
        </p>

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={onCancel}
            className="h-9 px-4"
          >
            Keep estimate only
          </Button>
          <Button
            disabled={pending}
            onClick={onConfirm}
            className="h-9 px-4"
          >
            {pending ? 'Updating…' : 'Update catalogue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
