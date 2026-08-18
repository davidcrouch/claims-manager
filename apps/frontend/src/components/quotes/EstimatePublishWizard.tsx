'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Send, Shield } from 'lucide-react';
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
import { publishQuoteAction } from '@/app/(app)/mutations';
import { generateAndDownloadDocument } from '@/lib/generate-document';
import type { Claim, Job, Quote } from '@/types/api';

export type EstimatePublishMode = 'internal' | 'external';

export interface EstimatePublishWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote;
  job?: Job | null;
  claim?: Claim | null;
  mode: EstimatePublishMode;
}

export function EstimatePublishWizard({
  open,
  onOpenChange,
  quote,
  job,
  claim,
  mode,
}: EstimatePublishWizardProps) {
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
      const result = await publishQuoteAction(quote.id);
      if (!result.success) {
        setError(
          result.error ??
            (isInternal
              ? 'Failed to publish estimate'
              : 'Failed to send estimate to NRMA'),
        );
        return;
      }

      if (isInternal) {
        try {
          await generateAndDownloadDocument({
            documentType: 'quote',
            entityId: quote.id,
          });
          toast.success('Estimate published and PDF downloaded');
        } catch (err) {
          toast.warning('Estimate published, but PDF generation failed', {
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      } else {
        toast.success('Estimate sent to NRMA');
      }

      onOpenChange(false);
      reset();
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  const statusName =
    quote.status?.name ??
    (quote.externalReference ? 'Unknown' : 'Draft');
  const title =
    quote.name ?? quote.quoteNumber ?? quote.externalReference ?? quote.id;

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isInternal ? 'Publish estimate' : 'Publish estimate to NRMA'}
      description={
        isInternal
          ? 'Review the claim, job, and estimate summary, then publish. It will be locked afterwards.'
          : 'Review the claim, job, and estimate summary, then send this estimate to NRMA.'
      }
      icon={
        isInternal ? (
          <FileText className="h-5 w-5 text-amber-600" />
        ) : (
          <Shield className="h-5 w-5 text-amber-600" />
        )
      }
      preventClose={publishing}
    >
      <BottomFormDrawerBody>
        <div className="mx-auto max-w-2xl space-y-4">
          {isInternal ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium">This estimate will be locked after publish</p>
              <p className="mt-2 text-amber-900/80">
                A PDF will be created from the assigned estimate template and downloaded.
                Status will change to Pending. Line items and estimate details cannot be
                edited afterwards.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium">This will be pushed to NRMA</p>
              <p className="mt-2 text-amber-900/80">
                Submitting creates the estimate in Crunchwork for NRMA. Status will change
                to Pending and the estimate will be locked. This cannot be undone from this
                screen.
              </p>
            </div>
          )}

          <PublishEntityContext job={job} claim={claim} />

          <PublishSummaryCard title="Estimate summary">
            <PublishSummaryRow label="Name" value={title} />
            <PublishSummaryRow label="Status" value={statusName} />
            <PublishSummaryRow label="Estimate number" value={quote.quoteNumber ?? '—'} />
            <PublishSummaryRow label="Reference" value={quote.reference ?? '—'} />
            <PublishSummaryRow label="Total" value={formatCurrency(quote.totalAmount)} />
            <PublishSummaryRow
              label="Estimate date"
              value={quote.quoteDate ? formatDate(quote.quoteDate) : '—'}
            />
          </PublishSummaryCard>
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
              ? 'Publish estimate'
              : 'Submit to NRMA'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
