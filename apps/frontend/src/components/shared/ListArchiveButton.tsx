'use client';

import { useState, useTransition } from 'react';
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
import { archiveEntityAction, type ArchiveEntityType } from '@/app/(app)/mutations-archive';
import { isArchivedStatus } from '@/components/shared/archive-list';

/** Minimal-width header cell for list archive actions. */
export const LIST_ARCHIVE_TH_CLASS = 'w-px p-0 py-2.5 text-center';

/** Minimal-width body cell for list archive actions. */
export const LIST_ARCHIVE_TD_CLASS = 'w-px whitespace-nowrap p-0 text-center';

/** Trailing spacer under the column-settings gear (keep padding minimal after trash). */
export const LIST_ARCHIVE_SPACER_TD_CLASS = 'w-px p-0';

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

export interface ListArchiveButtonProps {
  entityType: ArchiveEntityType;
  entityId: string;
  /** Current status name — when already archived, the button is hidden. */
  statusName?: string | null;
  /** Optional display name used in the confirmation copy. */
  entityLabel?: string;
  /** Called after a successful archive so the parent list can update local state. */
  onArchived?: (entityId: string) => void;
}

export function ListArchiveButton({
  entityType,
  entityId,
  statusName,
  entityLabel,
  onArchived,
}: ListArchiveButtonProps) {
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
          `[frontend:ListArchiveButton.handleConfirm] ${entityType}/${entityId}`,
          result.error,
        );
        toast.error(result.error ?? `Failed to archive ${noun}`);
        return;
      }
      toast.success(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} archived`);
      setOpen(false);
      onArchived?.(entityId);
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="m-0 inline-flex size-5 items-center justify-center rounded p-0 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        title={`Archive ${noun}`}
        aria-label={`Archive ${noun}`}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isPending) setOpen(next);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-2 pt-0.5">
                <DialogTitle className="text-xl">Archive {noun}</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Are you sure you want to archive{' '}
                  <span className="font-medium text-foreground">{displayName}</span>?
                  It will be moved to the archived list and hidden from active views.
                  You can find it later under the Archived tab.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
              className="h-9 min-w-28 px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={handleConfirm}
              className="h-9 min-w-28 px-4 bg-red-600 text-white hover:bg-red-500 hover:text-white"
            >
              {isPending ? 'Archiving…' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
