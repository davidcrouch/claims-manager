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
import { archiveEntityAction, type ArchiveEntityType } from '@/app/(app)/mutations-archive';
import { isArchivedStatus } from '@/components/shared/list-filters';

const ENTITY_LABELS: Record<ArchiveEntityType, string> = {
  job: 'job',
  claim: 'claim',
  quote: 'estimate',
  invoice: 'invoice',
  bill: 'bill',
  work_order: 'work order',
  purchase_order: 'purchase order',
  rfq: 'RFQ',
  proposal: 'proposal',
  report: 'report',
  journal: 'journal',
  vendor: 'vendor',
  assessment: 'assessment',
};

interface ArchiveEntityButtonProps {
  entityType: ArchiveEntityType;
  entityId: string;
  /** Current status name — when already archived, the button is hidden. */
  statusName?: string | null;
  /** Optional display name used in the confirmation copy. */
  entityLabel?: string;
  className?: string;
  /** Where to navigate after a successful archive. Defaults to staying and refreshing. */
  redirectTo?: string;
}

export function ArchiveEntityButton({
  entityType,
  entityId,
  statusName,
  entityLabel,
  className,
  redirectTo,
}: ArchiveEntityButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isArchivedStatus(statusName)) {
    return null;
  }

  const noun = ENTITY_LABELS[entityType];
  const displayName = entityLabel?.trim() || `this ${noun}`;

  function handleConfirm() {
    startTransition(async () => {
      const result = await archiveEntityAction(entityType, entityId);
      if (!result.success) {
        console.error(
          `[frontend:ArchiveEntityButton.handleConfirm] ${entityType}/${entityId}`,
          result.error,
        );
        toast.error(result.error ?? `Failed to archive ${noun}`);
        return;
      }
      toast.success(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} archived`);
      setOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
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
        title={`Archive ${noun}`}
        aria-label={`Archive ${noun}`}
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
                <DialogTitle className="text-xl">Archive {noun}</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Are you sure you want to archive <span className="font-medium text-foreground">{displayName}</span>?
                  It will be moved to the archived list and hidden from active views. You can find it
                  later under the Archived tab.
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
              {isPending ? 'Archiving…' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
