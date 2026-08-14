'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Receipt, Send, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { formatCurrency, formatDate } from '@/components/shared/detail';
import {
  PublishEntityContext,
  PublishSummaryCard,
  PublishSummaryRow,
} from '@/components/shared/PublishEntityContext';
import { publishInvoiceAction } from '@/app/(app)/mutations';
import type { Claim, Invoice, Job } from '@/types/api';

export type InvoicePublishMode = 'internal' | 'external';

export interface InvoicePublishWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  job?: Job | null;
  claim?: Claim | null;
  mode: InvoicePublishMode;
}

export function InvoicePublishWizard({
  open,
  onOpenChange,
  invoice,
  job,
  claim,
  mode,
}: InvoicePublishWizardProps) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInternal = mode === 'internal';

  const reset = useCallback(() => {
    setPublishing(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function handleOpenChange(next: boolean) {
    if (publishing) return;
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleConfirm() {
    setPublishing(true);
    setError(null);
    try {
      const result = await publishInvoiceAction(invoice.id);
      if (!result.success) {
        setError(
          result.error ??
            (isInternal
              ? 'Failed to publish invoice'
              : 'Failed to send invoice to NRMA'),
        );
        return;
      }

      toast.success(
        isInternal ? 'Invoice published' : 'Invoice sent to NRMA',
      );
      onOpenChange(false);
      reset();
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  const statusName = invoice.status?.name ?? (invoice.sourceExternalReference ? 'Unknown' : 'Draft');
  const title = invoice.invoiceNumber ?? invoice.id;

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isInternal ? 'Publish invoice' : 'Publish invoice to NRMA'}
      description={
        isInternal
          ? 'Review the claim, job, and invoice summary, then publish. It will be locked afterwards.'
          : 'Review the claim, job, and invoice summary, then send this invoice to NRMA.'
      }
      icon={
        isInternal ? (
          <Receipt className="h-5 w-5 text-amber-600" />
        ) : (
          <Shield className="h-5 w-5 text-amber-600" />
        )
      }
      widthClassName="w-[55%]"
      preventClose={publishing}
    >
      <BottomFormDrawerBody>
        <div className="mx-auto max-w-2xl space-y-4">
          {isInternal ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium">This invoice will be locked after publish</p>
              <p className="mt-2 text-amber-900/80">
                Status will change to Submitted. Invoice details cannot be edited
                afterwards.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium">This will be pushed to NRMA</p>
              <p className="mt-2 text-amber-900/80">
                Submitting creates the invoice in Crunchwork for NRMA against the
                linked work order. Status will change to Submitted and the invoice
                will be locked. This cannot be undone from this screen.
              </p>
            </div>
          )}

          <PublishSummaryCard title="Invoice summary">
            <PublishSummaryRow label="Invoice number" value={title} />
            <PublishSummaryRow label="Status" value={statusName} />
            <PublishSummaryRow
              label="Total"
              value={formatCurrency(invoice.totalAmount)}
            />
            <PublishSummaryRow
              label="Issue date"
              value={invoice.issueDate ? formatDate(invoice.issueDate) : '—'}
            />
            <PublishSummaryRow
              label="Work order"
              value={invoice.workOrderId ?? '—'}
            />
            <PublishSummaryRow
              label="Purchase order"
              value={invoice.purchaseOrderId ?? '—'}
            />
          </PublishSummaryCard>

          <PublishEntityContext job={job} claim={claim} />
        </div>

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={publishing}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={publishing}
          onClick={() => void handleConfirm()}
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          {publishing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : isInternal ? (
            <FileText className="mr-1.5 h-4 w-4" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {publishing
            ? isInternal
              ? 'Publishing…'
              : 'Sending to NRMA…'
            : isInternal
              ? 'Publish invoice'
              : 'Submit to NRMA'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
