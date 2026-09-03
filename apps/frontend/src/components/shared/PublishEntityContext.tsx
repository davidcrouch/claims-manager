'use client';

import type { ReactNode } from 'react';
import { formatAddress, formatDate } from '@/components/shared/detail';
import { jobDisplayName } from '@/components/shared/job-label';
import type { Claim, Job } from '@/types/api';

function dash(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : '—';
}

function yesNo(value: boolean | null | undefined): string {
  if (value == null) return '—';
  return value ? 'Yes' : 'No';
}

function jobAddress(job?: Job | null): string {
  if (!job) return '';
  return formatAddress((job.address as Record<string, unknown> | undefined) ?? {}, {
    full: true,
    fallback: {
      suburb: job.addressSuburb,
      state: job.addressState,
      postcode: job.addressPostcode,
      country: job.addressCountry,
    },
  });
}

function claimAddress(claim?: Claim | null): string {
  if (!claim) return '';
  return formatAddress((claim.address as Record<string, unknown> | undefined) ?? {}, {
    full: true,
    fallback: {
      suburb: claim.addressSuburb,
      state: claim.addressState,
      postcode: claim.addressPostcode,
      country: claim.addressCountry,
    },
  });
}

export function PublishSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="truncate font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export function PublishSummaryCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{children}</dl>
    </div>
  );
}

export function PublishEntityContext({
  job,
  claim,
  showClaim = true,
  showInsurerJobRef = true,
  showMakeSafeRequired = true,
}: {
  job?: Job | null;
  claim?: Claim | null;
  /** When false, omit the Claim summary card (e.g. internal estimate publish). */
  showClaim?: boolean;
  /** When false, omit Insurer / CW job ID (e.g. internal estimate publish). */
  showInsurerJobRef?: boolean;
  /** When false, omit Make-safe required (e.g. internal estimate publish). */
  showMakeSafeRequired?: boolean;
}) {
  const jobAddr = jobAddress(job);
  const claimAddr = claimAddress(claim);

  return (
    <>
      <PublishSummaryCard title="Job">
        <PublishSummaryRow label="Job" value={job ? jobDisplayName(job) : 'Not linked'} />
        <PublishSummaryRow label="Status" value={dash(job?.status?.name)} />
        <PublishSummaryRow label="Job type" value={dash(job?.jobType?.name)} />
        {showInsurerJobRef && (
          <PublishSummaryRow label="Insurer / CW job ID" value={dash(job?.externalJobId ?? job?.externalReference)} />
        )}
        <PublishSummaryRow label="Request date" value={job?.requestDate ? formatDate(job.requestDate) : '—'} />
        <PublishSummaryRow label="Assignee" value={dash(job?.assigneeName)} />
        {showMakeSafeRequired && (
          <PublishSummaryRow label="Make-safe required" value={yesNo(job?.makeSafeRequired)} />
        )}
        <PublishSummaryRow label="Site address" value={dash(jobAddr)} />
      </PublishSummaryCard>

      {showClaim && (
        <PublishSummaryCard title="Claim">
          <PublishSummaryRow label="Claim number" value={dash(claim?.claimNumber ?? claim?.externalReference)} />
          <PublishSummaryRow label="Insurer reference" value={dash(claim?.externalClaimId)} />
          <PublishSummaryRow label="Status" value={dash(claim?.status?.name)} />
          <PublishSummaryRow label="Policy name" value={dash(claim?.policyName)} />
          <PublishSummaryRow label="Policy number" value={dash(claim?.policyNumber)} />
          <PublishSummaryRow label="Date of loss" value={claim?.dateOfLoss ? formatDate(claim.dateOfLoss) : '—'} />
          <PublishSummaryRow label="Loss description" value={dash(claim?.incidentDescription)} />
          <PublishSummaryRow label="Risk address" value={dash(claimAddr || jobAddr)} />
        </PublishSummaryCard>
      )}
    </>
  );
}
