'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { deleteCatalogAction } from '@/app/(app)/admin/catalog/actions';

interface CatalogDeleteButtonProps {
  catalogId: string;
  /** Optional display name used in the confirmation copy. */
  catalogName?: string | null;
  className?: string;
  /** Where to navigate after a successful delete. Defaults to `/admin/catalog`. */
  redirectTo?: string;
}

export function CatalogDeleteButton({
  catalogId,
  catalogName,
  className,
  redirectTo = '/admin/catalog',
}: CatalogDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const displayName = catalogName?.trim() || 'this catalogue';

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteCatalogAction(catalogId);
      if (!result.success) {
        console.error(
          `[frontend:CatalogDeleteButton.handleConfirm] ${catalogId}`,
          result.error,
        );
        toast.error(result.error ?? 'Failed to delete catalogue');
        return;
      }
      toast.success('Catalogue deleted');
      setOpen(false);
      router.push(redirectTo);
    });
  }

  return (
    <>
      <Button
        size="default"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className={cn(
          'h-9 w-9 px-0 bg-red-600 text-white hover:bg-red-500 hover:text-white',
          className,
        )}
        title="Delete catalogue"
        aria-label="Delete catalogue"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isPending) setOpen(next);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-2 pt-0.5">
                <DialogTitle className="text-xl">Delete catalogue</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-foreground">{displayName}</span>?
                  It will be removed from the active catalogues list.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
              className="h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={handleConfirm}
              className="h-9 px-4 bg-red-600 text-white hover:bg-red-500 hover:text-white"
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
