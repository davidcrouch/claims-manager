'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { approveQuoteAction } from '@/app/(app)/mutations';

export interface EstimateApprovalWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
}

export function EstimateApprovalWizard({
  open,
  onOpenChange,
  quoteId,
}: EstimateApprovalWizardProps) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setApproving(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function handleOpenChange(next: boolean) {
    if (approving) return;
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleConfirm() {
    setApproving(true);
    setError(null);
    try {
      const result = await approveQuoteAction(quoteId);
      if (!result.success) {
        setError(result.error ?? 'Failed to approve estimate');
        return;
      }

      toast.success('Estimate approved — Work Order created', {
        action: result.workOrderId
          ? {
              label: 'View Work Order',
              onClick: () => router.push(`/work-orders/${result.workOrderId}`),
            }
          : undefined,
      });

      onOpenChange(false);
      reset();
      router.refresh();
    } finally {
      setApproving(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Received approval"
      description="Confirm approval receipt and create a linked Work Order from this estimate."
      icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
    >
      <div className="border-b border-slate-200 px-12 py-3">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          <li className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">
            1. Confirm Approval
          </li>
        </ol>
      </div>

      <BottomFormDrawerBody>
        <div className="mx-auto max-w-xl space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p className="font-medium text-foreground">Confirm estimate approval</p>
            <p className="mt-2 text-muted-foreground">
              This will mark the estimate as <strong>Approved</strong> and automatically
              create a <strong>Work Order</strong> linked to this estimate&apos;s job.
            </p>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">A Work Order will be created</p>
                <p className="mt-1 text-blue-700">
                  The work order will inherit the job, claim, and total amount from this
                  estimate. You can edit the work order details afterwards.
                </p>
              </div>
            </div>
          </div>
        </div>

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={approving}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={approving}
          onClick={() => void handleConfirm()}
          className="bg-emerald-600 text-white hover:bg-emerald-500"
        >
          {approving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
          )}
          {approving ? 'Approving…' : 'Confirm Approval'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
