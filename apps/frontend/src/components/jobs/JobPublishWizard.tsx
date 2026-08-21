'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Send, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { formatDate } from '@/components/shared/detail';
import {
  PublishEntityContext,
  PublishSummaryCard,
  PublishSummaryRow,
} from '@/components/shared/PublishEntityContext';
import { jobDisplayName } from '@/components/shared/job-label';
import type { Claim, Job } from '@/types/api';

export interface JobPublishWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  claim?: Claim | null;
  /** Flush local drafts and push CW fields to the insurer. */
  onPublish: () => Promise<{ success: boolean; error?: string }>;
}

function dash(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : '—';
}

function customDate(job: Job, key: string): string | null {
  const custom = (job.customData as Record<string, unknown> | undefined) ?? {};
  const api = (job.apiPayload as Record<string, unknown> | undefined) ?? {};
  const raw = custom[key] ?? api[key];
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

export function JobPublishWizard({
  open,
  onOpenChange,
  job,
  claim,
  onPublish,
}: JobPublishWizardProps) {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const reset = useCallback(() => {
    setPublishing(false);
    setError(null);
    setPublished(false);
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
  }

  async function handleConfirm() {
    setPublishing(true);
    setError(null);
    try {
      const result = await onPublish();
      if (!result.success) {
        setError(result.error ?? 'Failed to push job updates to the insurer');
        return;
      }
      setPublished(true);
      toast.success('Job updates sent to insurer');
    } finally {
      setPublishing(false);
    }
  }

  const bookedDate = customDate(job, 'bookedDate');
  const attendanceDate = customDate(job, 'attendanceDate');
  const instructions = job.jobInstructions?.trim() || null;

  if (published) {
    return (
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Job updates published"
        description=""
        icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
      >
        <BottomFormDrawerBody>
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-950">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Job updates sent to insurer
              </p>
              <p className="mt-2 text-green-900/80">
                Crunchwork field changes for this job have been queued for the insurer.
                Sync may complete shortly after this confirmation.
              </p>
            </div>
            <PublishEntityContext job={job} claim={claim} />
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

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Publish job updates to insurer"
      description="Review the claim and job summary, then push the saved Crunchwork field changes to the insurer."
      icon={<Shield className="h-5 w-5 text-amber-600" />}
      preventClose={publishing}
    >
      <BottomFormDrawerBody>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            <p className="font-medium">This will be pushed to the insurer</p>
            <p className="mt-2 text-amber-900/80">
              Submitting sends the latest Crunchwork job fields (such as booked date,
              attendance date, status, instructions, and type details) to Crunchwork
              for the insurer. This cannot be undone from this screen.
            </p>
          </div>

          <PublishEntityContext job={job} claim={claim} />

          <PublishSummaryCard title="Updates to publish">
            <PublishSummaryRow label="Job" value={jobDisplayName(job)} />
            <PublishSummaryRow label="Status" value={dash(job.status?.name)} />
            <PublishSummaryRow
              label="Booked date"
              value={bookedDate ? formatDate(bookedDate) : '—'}
            />
            <PublishSummaryRow
              label="Attendance date"
              value={attendanceDate ? formatDate(attendanceDate) : '—'}
            />
            <PublishSummaryRow
              label="Instructions"
              value={instructions ? 'Included' : '—'}
            />
            <PublishSummaryRow
              label="Insurer / CW job ID"
              value={dash(job.externalJobId ?? job.externalReference)}
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
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {publishing ? 'Sending to insurer…' : 'Submit to insurer'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
