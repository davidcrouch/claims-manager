'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export interface DeleteItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName?: string;
  isAssemblyChild: boolean;
  onConfirm: (removeFromCatalogAssembly: boolean) => void;
  pending?: boolean;
}

export function DeleteItemDialog({
  open,
  onOpenChange,
  itemName,
  isAssemblyChild,
  onConfirm,
  pending,
}: DeleteItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete line item</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            {itemName ? <>&ldquo;{itemName}&rdquo;</> : 'this item'}?
          </DialogDescription>
        </DialogHeader>

        {isAssemblyChild && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This item belongs to a catalogue assembly. You can also remove it
              from the catalogue assembly definition so future uses won&rsquo;t
              include it.
            </p>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          {isAssemblyChild && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onConfirm(true)}
              disabled={pending}
            >
              Delete from estimate &amp; catalogue
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onConfirm(false)}
            disabled={pending}
          >
            {isAssemblyChild ? 'Delete from estimate only' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
