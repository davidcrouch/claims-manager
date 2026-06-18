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
import type { ApiGroup } from '@/components/quotes/quote-line-items.types';
import { groupLabel } from '@/components/quotes/quote-line-items.utils';

export interface DeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ApiGroup;
  onConfirm: () => void;
  pending?: boolean;
}

export function DeleteGroupDialog({
  open,
  onOpenChange,
  group,
  onConfirm,
  pending,
}: DeleteGroupDialogProps) {
  const label = groupLabel(group, 0);
  const itemCount =
    (group.items?.length ?? 0) +
    (group.combos ?? []).reduce((sum, c) => sum + (c.items?.length ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete group</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{label}&rdquo;?
          </DialogDescription>
        </DialogHeader>

        {itemCount > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This group contains {itemCount} line item{itemCount !== 1 ? 's' : ''}.
              Deleting the group will permanently remove all items within it.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={pending}>
            Delete group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
