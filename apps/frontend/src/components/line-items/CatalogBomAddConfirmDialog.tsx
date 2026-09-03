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

export interface CatalogBomAddPrompt {
  parentQuoteComboId: string;
  catalogComponentId: string;
  quantity: string;
  itemLabel: string;
  parentLabel: string;
}

export interface CatalogBomAddConfirmDialogProps {
  open: boolean;
  prompt: CatalogBomAddPrompt | null;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CatalogBomAddConfirmDialog({
  open,
  prompt,
  pending = false,
  onConfirm,
  onCancel,
}: CatalogBomAddConfirmDialogProps) {
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
              <DialogTitle className="text-xl">Add to catalogue?</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                The item was added to this estimate. Also add it under the linked
                catalogue parent so future estimates include it?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
          <p className="truncate font-medium">{prompt?.itemLabel ?? 'Item'}</p>
          <p className="mt-1 truncate text-slate-500">
            under {prompt?.parentLabel ?? 'catalogue parent'}
          </p>
        </div>

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
            {pending ? 'Updating…' : 'Add to catalogue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
