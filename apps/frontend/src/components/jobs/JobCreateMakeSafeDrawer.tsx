'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Plus, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import {
  CreateSubmitOverlay,
  navigateToCreated,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import {
  PublishEntityContext,
  PublishSummaryCard,
  PublishSummaryRow,
} from '@/components/shared/PublishEntityContext';
import { formatAddress } from '@/components/shared/detail';
import { jobDisplayName } from '@/components/shared/job-label';
import { createJobAction } from '@/app/(app)/jobs/mutations';
import type { Claim, Job } from '@/types/api';

const BUILDER_MAKE_SAFE_JOB_TYPE = 'Builder Make Safe';

export interface JobCreateMakeSafeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  claim?: Claim | null;
  /** Lookup id for the Builder Make Safe job type. */
  makeSafeJobTypeId: string;
  makeSafeJobTypeName?: string;
}

function dash(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : '—';
}

function jobAddressPayload(job: Job): Record<string, unknown> | undefined {
  const raw =
    job.address && typeof job.address === 'object' && !Array.isArray(job.address)
      ? (job.address as Record<string, unknown>)
      : {};
  const address: Record<string, unknown> = {
    unitNumber: typeof raw.unitNumber === 'string' ? raw.unitNumber : undefined,
    streetNumber: typeof raw.streetNumber === 'string' ? raw.streetNumber : undefined,
    streetName: typeof raw.streetName === 'string' ? raw.streetName : undefined,
    suburb:
      (typeof raw.suburb === 'string' ? raw.suburb : undefined) ??
      job.addressSuburb ??
      undefined,
    state:
      (typeof raw.state === 'string' ? raw.state : undefined) ??
      job.addressState ??
      undefined,
    postcode:
      (typeof raw.postcode === 'string' ? raw.postcode : undefined) ??
      job.addressPostcode ??
      undefined,
    country:
      (typeof raw.country === 'string' ? raw.country : undefined) ??
      job.addressCountry ??
      undefined,
  };
  return Object.values(address).some((v) => typeof v === 'string' && v.trim())
    ? address
    : undefined;
}

function siteAddressLabel(job: Job): string {
  return formatAddress(jobAddressPayload(job) ?? {}, {
    full: true,
    fallback: {
      suburb: job.addressSuburb,
      state: job.addressState,
      postcode: job.addressPostcode,
      country: job.addressCountry,
    },
  });
}

export function JobCreateMakeSafeDrawer({
  open,
  onOpenChange,
  job,
  claim,
  makeSafeJobTypeId,
  makeSafeJobTypeName = BUILDER_MAKE_SAFE_JOB_TYPE,
}: JobCreateMakeSafeDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [outboundPayload, setOutboundPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [created, setCreated] = useState(false);
  const [createdJob, setCreatedJob] = useState<Job | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setOutboundPayload(null);
    setCreated(false);
    setCreatedJob(null);
    resetPhase();
  }, [resetPhase]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function handleOpenChange(next: boolean) {
    if (busy) return;
    onOpenChange(next);
    if (!next) reset();
  }

  function handleDone() {
    if (createdJob?.id) {
      startOpening();
      navigateToCreated(router, `/jobs/${createdJob.id}`);
      return;
    }
    onOpenChange(false);
    reset();
  }

  async function handleConfirm() {
    const claimId = job.claimId ?? claim?.id;
    if (!claimId) {
      setError('A linked claim is required to create a Make-Safe job in Crunchwork.');
      return;
    }
    if (!makeSafeJobTypeId) {
      setError('Builder Make Safe job type is not available for this organisation.');
      return;
    }

    startCreating();
    setError(null);
    setOutboundPayload(null);

    const claimLabel =
      claim?.claimNumber?.trim() ||
      claim?.externalReference?.trim() ||
      '';
    const name = claimLabel
      ? `${claimLabel} Make Safe`
      : BUILDER_MAKE_SAFE_JOB_TYPE;
    const address = jobAddressPayload(job);
    const excessRaw = job.excess;
    const excess =
      excessRaw != null && excessRaw !== ''
        ? Number.parseFloat(String(excessRaw))
        : undefined;

    try {
      const result = await createJobAction(
        {
          name,
          jobTypeLookupId: makeSafeJobTypeId,
          claimId,
          parentJobId: job.id,
          makeSafeRequired: true,
          ...(job.collectExcess != null ? { collectExcess: job.collectExcess } : {}),
          ...(excess != null && !Number.isNaN(excess) ? { excess } : {}),
          ...(job.jobInstructions?.trim()
            ? { jobInstructions: job.jobInstructions.trim() }
            : {}),
          ...(job.assignedToUserId
            ? { assignedToUserId: job.assignedToUserId }
            : {}),
          ...(address ? { address } : {}),
        },
        { provider: 'crunchwork' },
      );

      if (!result.success || !result.job) {
        setError(result.error ?? 'Failed to create Make-Safe job');
        setOutboundPayload(result.outboundPayload ?? null);
        resetPhase();
        return;
      }

      setCreatedJob(result.job);
      setCreated(true);
      resetPhase();
      toast.success('Make-Safe job created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Make-Safe job');
      resetPhase();
    }
  }

  if (created) {
    return (
      <>
        <BottomFormDrawer
          open={open}
          onOpenChange={handleOpenChange}
          title="Make-Safe job created"
          description=""
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          preventClose={busy}
        >
          <BottomFormDrawerBody>
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-950">
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Make-Safe job sent to insurer
                </p>
                <p className="mt-2 text-green-900/80">
                  A Builder Make Safe job has been created in Crunchwork for this
                  claim. Sync may complete shortly after this confirmation.
                </p>
              </div>
              <PublishEntityContext
                job={createdJob ?? undefined}
                claim={claim}
              />
            </div>
          </BottomFormDrawerBody>
          <BottomFormDrawerFooter>
            <Button
              type="button"
              size="lg"
              onClick={handleDone}
              disabled={busy}
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Open Make-Safe job
            </Button>
          </BottomFormDrawerFooter>
        </BottomFormDrawer>
        <CreateSubmitOverlay phase={phase} entityLabel="job" />
      </>
    );
  }

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Create Make-Safe job"
        description="Review the claim and parent job summary, then create a Builder Make Safe job in Crunchwork."
        icon={<Wrench className="h-5 w-5 text-amber-600" />}
        preventClose={busy}
      >
        <BottomFormDrawerBody>
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium">This will be pushed to the insurer</p>
              <p className="mt-2 text-amber-900/80">
                Submitting creates a new Builder Make Safe job in Crunchwork for
                NRMA against the linked claim, with this job as the parent. Claim
                contacts and site details are carried across. This cannot be
                undone from this screen.
              </p>
            </div>

            <PublishSummaryCard title="Make-Safe job to create">
              <PublishSummaryRow label="Job type" value={makeSafeJobTypeName} />
              <PublishSummaryRow label="Make-safe required" value="Yes" />
              <PublishSummaryRow label="Provider" value="Crunchwork (NRMA)" />
              <PublishSummaryRow
                label="Parent job"
                value={dash(jobDisplayName(job))}
              />
              <PublishSummaryRow
                label="Assignee"
                value={dash(job.assigneeName)}
              />
              <PublishSummaryRow
                label="Site address"
                value={dash(siteAddressLabel(job))}
              />
              <PublishSummaryRow
                label="Claim"
                value={dash(
                  claim?.claimNumber ??
                    claim?.externalReference ??
                    job.claimId,
                )}
              />
            </PublishSummaryCard>

            <PublishEntityContext job={job} claim={claim} />
          </div>

          <BottomFormDrawerError error={error} />
          {outboundPayload && (
            <div className="mx-auto mt-4 max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Crunchwork request payload
              </p>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                <div className="border-b border-slate-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                  json
                </div>
                <pre className="max-h-80 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
                  {JSON.stringify(outboundPayload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={busy || !makeSafeJobTypeId || !(job.claimId ?? claim?.id)}
            onClick={() => void handleConfirm()}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            {busy ? 'Creating Make-Safe…' : 'Create Make-Safe'}
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
      <CreateSubmitOverlay phase={phase} entityLabel="job" />
    </>
  );
}
