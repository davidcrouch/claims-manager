'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileText, Loader2, Send, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
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
import { useJobCaps } from '@/hooks/useJobCaps';

export type EstimatePublishMode = 'internal' | 'external';

export interface EstimatePublishWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote;
  job?: Job | null;
  claim?: Claim | null;
  mode: EstimatePublishMode;
  /** Create already succeeded on Crunchwork; only the Published status update is needed. */
  republish?: boolean;
}

export function EstimatePublishWizard({
  open,
  onOpenChange,
  quote,
  job,
  claim,
  mode,
  republish = false,
}: EstimatePublishWizardProps) {
  const router = useRouter();
  const caps = useJobCaps(job);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishQuoteResult | null>(null);
  const [createPdf, setCreatePdf] = useState(false);
  const [documentFormat, setDocumentFormat] = useState<'pdf' | 'docx' | null>(null);
  const isInternal = mode === 'internal';

  const reset = useCallback(() => {
    setPublishing(false);
    setError(null);
    setErrorDialogOpen(false);
    setPublishResult(null);
    setCreatePdf(false);
    setDocumentFormat(null);
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

  function showPublishError(message: string) {
    setError(message);
    setErrorDialogOpen(true);
  }

  async function handleConfirm() {
    setPublishing(true);
    setError(null);
    setErrorDialogOpen(false);
    try {
      const result = await publishQuoteAction(quote.id);
      if (!result.success) {
        showPublishError(
          result.error ??
            (isInternal
              ? 'Failed to publish estimate'
              : 'Failed to send estimate to Insurer'),
        );
        return;
      }

      setPublishResult(result.publishResult ?? null);

      const formatLabel = createPdf ? 'PDF' : 'Word document';
      try {
        const docResult = await generateAndDownloadDocument({
          documentType: 'quote',
          entityId: quote.id,
          createPdf,
        });
        setDocumentFormat(docResult.format);
        if (isInternal) {
          toast.success(`Estimate published and ${formatLabel} downloaded`);
        } else {
          const prov = result.publishResult?.provider;
          const excludedItems = prov?.excludedItems ?? 0;
          toast.success(
            prov
              ? `Estimate sent to Insurer (${prov.sentItems} items in ${prov.sentGroups} groups` +
                (excludedItems > 0 ? `, ${excludedItems} item${excludedItems > 1 ? 's' : ''} excluded` : '') +
                `) — ${formatLabel} downloaded`
              : `Estimate sent to Insurer — ${formatLabel} downloaded`,
          );
        }
      } catch (err) {
        if (isInternal) {
          toast.warning(`Estimate published, but ${formatLabel} generation failed`, {
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        } else {
          const prov = result.publishResult?.provider;
          const excludedItems = prov?.excludedItems ?? 0;
          toast.success(
            prov
              ? `Estimate sent to Insurer (${prov.sentItems} items in ${prov.sentGroups} groups` +
                (excludedItems > 0 ? `, ${excludedItems} item${excludedItems > 1 ? 's' : ''} excluded` : '') +
                ')'
              : 'Estimate sent to Insurer',
          );
          toast.warning(`${formatLabel} generation failed`, {
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    } catch (err) {
      showPublishError(
        err instanceof Error
          ? err.message
          : isInternal
            ? 'Failed to publish estimate'
            : 'Failed to send estimate to Insurer',
      );
    } finally {
      setPublishing(false);
    }
  }

  const statusName =
    quote.status?.name ??
    (quote.externalReference ? 'Unknown' : 'Draft');
  const title =
    quote.name ?? quote.quoteNumber ?? quote.externalReference ?? quote.id;

  const errorDialog = (
    <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-2 pt-0.5">
              <DialogTitle className="text-xl">
                {isInternal ? 'Publish failed' : 'Could not send to Insurer'}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-slate-700">
                {error ?? 'An unexpected error occurred while publishing this estimate.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button className="h-9 px-4" onClick={() => setErrorDialogOpen(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // --- Result panel (shown after successful publish) ---
  if (publishResult) {
    const prov = publishResult.provider;
    const hasWarnings = prov?.warnings && prov.warnings.length > 0;
    const docLabel =
      documentFormat === 'pdf'
        ? 'PDF'
        : documentFormat === 'docx'
          ? 'Word document'
          : null;
    return (
      <>
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
                      Estimate sent to Insurer
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
                      <dd>Pending (awaiting Insurer review)</dd>
                      {docLabel && (
                        <>
                          <dt className="text-muted-foreground">Document</dt>
                          <dd>{docLabel} downloaded</dd>
                        </>
                      )}
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
                      <dt className="text-muted-foreground">Document</dt>
                      <dd>{docLabel ? `${docLabel} downloaded` : 'Not generated'}</dd>
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
        {errorDialog}
      </>
    );
  }

  // --- Confirm panel (shown before publish) ---
  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title={
          isInternal
            ? 'Publish estimate'
            : republish
              ? 'Publish estimate status'
              : 'Publish estimate to Insurer'
        }
        description={
          isInternal
            ? 'Review the job and estimate summary, then publish. It will be locked afterwards.'
            : republish
              ? 'This estimate already exists in Crunchwork as a Draft. Publishing will set its status to Published without creating a new estimate.'
              : 'Review the claim, job, and estimate summary, then send this estimate to the Insurer.'
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
                  A Word document will be created from the assigned estimate template and
                  downloaded (turn on Create PDF below if you need a PDF). Status will change
                  to Pending. Line items and estimate details cannot be edited afterwards.
                </p>
              </div>
            ) : republish ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                <p className="font-medium">Crunchwork estimate is still Draft</p>
                <p className="mt-2 text-amber-900/80">
                  The estimate was created in Crunchwork but its status was not set to
                  Published. This will only update the existing Crunchwork estimate — it will
                  not create a duplicate.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                <p className="font-medium">This will be pushed to the Insurer</p>
                <p className="mt-2 text-amber-900/80">
                  Submitting creates the estimate in Crunchwork for the Insurer. A Word
                  document is also downloaded from the assigned template (turn on Create PDF
                  below if you need a PDF). Status will change to Pending and the estimate
                  will be locked. This cannot be undone from this screen.
                </p>
              </div>
            )}

            <PublishSummaryCard title="Estimate Summary">
              <PublishSummaryRow label="Name" value={title} />
              <PublishSummaryRow label="Status" value={statusName} />
              <PublishSummaryRow label="Estimate number" value={quote.quoteNumber ?? '—'} />
              {caps.estimate.reference.visible && (
                <PublishSummaryRow label="Reference" value={quote.reference ?? '—'} />
              )}
              <PublishSummaryRow label="Total" value={formatCurrency(quote.totalAmount)} />
              <PublishSummaryRow
                label="Estimate date"
                value={quote.quoteDate ? formatDate(quote.quoteDate) : '—'}
              />
            </PublishSummaryCard>

            <PublishEntityContext
              job={job}
              claim={claim}
              showClaim={!isInternal}
              showInsurerJobRef={!isInternal}
              showMakeSafeRequired={!isInternal}
            />

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="estimate-publish-create-pdf" className="text-sm font-medium text-slate-900">
                    Create PDF
                  </Label>
                  <p className="text-xs text-slate-500">
                    Off by default — downloads a Word document. Turn on to convert to PDF.
                  </p>
                </div>
                <Switch
                  id="estimate-publish-create-pdf"
                  checked={createPdf}
                  disabled={publishing}
                  onCheckedChange={(checked) => setCreatePdf(!!checked)}
                />
              </div>
            </div>
          </div>
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
                : republish
                  ? 'Updating Crunchwork status…'
                  : 'Sending to Insurer…'
              : isInternal
                ? 'Publish estimate'
                : republish
                  ? 'Publish status'
                  : 'Submit to Insurer'}
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
      {errorDialog}
    </>
  );
}
