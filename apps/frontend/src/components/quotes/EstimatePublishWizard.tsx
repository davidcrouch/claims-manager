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
import { publishQuoteAction } from '@/app/(app)/mutations';
import { generateAndDownloadDocument } from '@/lib/generate-document';

export type EstimatePublishMode = 'internal' | 'external';

type WizardStep = 'confirm';

const STEPS: WizardStep[] = ['confirm'];

export interface EstimatePublishWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  mode: EstimatePublishMode;
}

export function EstimatePublishWizard({
  open,
  onOpenChange,
  quoteId,
  mode,
}: EstimatePublishWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('confirm');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInternal = mode === 'internal';

  const reset = useCallback(() => {
    setStep('confirm');
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
      const result = await publishQuoteAction(quoteId);
      if (!result.success) {
        setError(
          result.error ??
            (isInternal
              ? 'Failed to publish estimate'
              : 'Failed to send estimate to insurance provider'),
        );
        return;
      }

      if (isInternal) {
        try {
          await generateAndDownloadDocument({
            documentType: 'quote',
            entityId: quoteId,
          });
          toast.success('Estimate published and PDF downloaded');
        } catch (err) {
          toast.warning('Estimate published, but PDF generation failed', {
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      } else {
        toast.success('Estimate sent to insurance provider');
      }

      onOpenChange(false);
      reset();
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  const stepLabels: Record<WizardStep, string> = {
    confirm: isInternal ? 'Generate PDF' : 'Send to Provider',
  };

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isInternal ? 'Publish estimate' : 'Send to insurance provider'}
      description={
        isInternal
          ? 'Confirm generating an estimate PDF. Status will be set to Pending.'
          : 'Confirm sending this estimate to the insurance provider. Status will be set to Pending.'
      }
      icon={
        isInternal ? (
          <FileText className="h-5 w-5 text-amber-600" />
        ) : (
          <Shield className="h-5 w-5 text-amber-600" />
        )
      }
    >
      <div className="border-b border-slate-200 px-12 py-3">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`rounded-full px-3 py-1 font-medium ${
                step === s
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {i + 1}. {stepLabels[s]}
            </li>
          ))}
        </ol>
      </div>

      <BottomFormDrawerBody>
        {step === 'confirm' && (
          <div className="mx-auto max-w-xl space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              {isInternal ? (
                <>
                  <p className="font-medium text-foreground">Generate estimate PDF</p>
                  <p className="mt-2 text-muted-foreground">
                    A PDF will be created from the assigned estimate document template and
                    downloaded. The estimate status will change from Draft to Pending.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">Send to insurance provider</p>
                  <p className="mt-2 text-muted-foreground">
                    This estimate will be submitted to the linked insurance provider for this job.
                    The estimate status will change from Draft to Pending.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

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
              : 'Sending…'
            : isInternal
              ? 'Generate PDF'
              : 'Send to provider'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
