'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileText, Loader2, Send, Shield, AlertTriangle } from 'lucide-react';
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
import type { PublishQuoteResult } from '@/lib/api-client';
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
  const [publishResult, setPublishResult] = useState<PublishQuoteResult | null>(null);
  const isInternal = mode === 'internal';

  const reset = useCallback(() => {
    setPublishing(false);
    setError(null);
    setPublishResult(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function handleOpenChange(next: boolean) {
    if (publishing) return;
    onOpenChange(next);
    if (!next) reset();
  }

  function handleDone() {
    onOpenChange(false);
    reset();
    router.refresh();
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
              : 'Failed to send estimate to insurer'),
        );
        return;
      }

      setPublishResult(result.publishResult ?? null);

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
        const prov = result.publishResult?.provider;
        const excludedItems = prov?.excludedItems ?? 0;
        toast.success(
          prov
            ? `Estimate sent to insurer (${prov.sentItems} items in ${prov.sentGroups} groups` +
              (excludedItems > 0 ? `, ${excludedItems} item${excludedItems > 1 ? 's' : ''} excluded` : '') + ')'
            : 'Estimate sent to insurer',
        );
      }
    } finally {
      setPublishing(false);
    }
  }

  const statusName =
    quote.status?.name ??
    (quote.externalReference ? 'Unknown' : 'Draft');
  const title =
    quote.name ?? quote.quoteNumber ?? quote.externalReference ?? quote.id;

  // --- Result panel (shown after successful publish) ---
  if (publishResult) {
    const prov = publishResult.provider;
    const hasWarnings = prov?.warnings && prov.warnings.length > 0;
    return (
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title={hasWarnings ? 'Published with warnings' : 'Estimate published'}
        description=""
        icon={
          hasWarnings
            ? <AlertTriangle className="h-5 w-5 text-amber-600" />
            : <CheckCircle2 className="h-5 w-5 text-green-600" />
        }
      >
        <BottomFormDrawerBody>
          <div className="mx-auto max-w-2xl space-y-4">
            <div className={`rounded-lg border px-4 py-4 text-sm ${hasWarnings ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-green-200 bg-green-50 text-green-950'}`}>
              {publishResult.publishMode === 'external' ? (
                <>
                  <p className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Estimate sent to insurer
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {prov?.providerReference && (
                      <>
                        <dt className="text-muted-foreground">Provider reference</dt>
                        <dd className="font-mono">{prov.providerReference}</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Groups sent</dt>
                    <dd>{prov?.sentGroups ?? 0}</dd>
                    <dt className="text-muted-foreground">Items sent</dt>
                    <dd>{prov?.sentItems ?? 0}</dd>
                    <dt className="text-muted-foreground">Assemblies sent</dt>
                    <dd>{prov?.sentCombos ?? 0}</dd>
                    {(prov?.excludedItems ?? 0) > 0 && (
                      <>
                        <dt className="text-amber-700">Items excluded</dt>
                        <dd className="text-amber-700">{prov!.excludedItems} (not tagged for provider)</dd>
                      </>
                    )}
                    {(prov?.excludedCombos ?? 0) > 0 && (
                      <>
                        <dt className="text-muted-foreground">Scopes stripped</dt>
                        <dd>{prov!.excludedCombos} (normal — structural only)</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>Pending (awaiting insurer review)</dd>
                  </dl>
                </>
              ) : (
                <>
                  <p className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Estimate published internally
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>Pending</dd>
                    <dt className="text-muted-foreground">PDF generated</dt>
                    <dd>Yes</dd>
                  </dl>
                </>
              )}
            </div>

            {hasWarnings && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium mb-1">Warnings</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {prov!.warnings!.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            size="lg"
            onClick={handleDone}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            Done
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
    );
  }

  // --- Confirm panel (shown before publish) ---
  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isInternal ? 'Publish estimate' : 'Publish estimate to insurer'}
      description={
        isInternal
          ? 'Review the claim, job, and estimate summary, then publish. It will be locked afterwards.'
          : 'Review the claim, job, and estimate summary, then send this estimate to the insurer.'
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
              <p className="font-medium">This will be pushed to the insurer</p>
              <p className="mt-2 text-amber-900/80">
                Submitting creates the estimate in Crunchwork for the insurer. Status will change
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
              : 'Sending to insurer…'
            : isInternal
              ? 'Publish estimate'
              : 'Submit to insurer'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
