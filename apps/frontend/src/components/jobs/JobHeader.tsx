'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  ChevronsUpDown,
  MapPin,
  ExternalLink,
  X,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { BackButton } from '@/components/layout/BackButton';
import { JobsPickerDrawer } from '@/components/jobs/JobsPickerDrawer';
import { formatDate, formatDateTime, formatCurrency, formatAddress } from '@/components/shared/detail';
import type { Job, Claim } from '@/types/api';

type Dict = Record<string, unknown>;

function getApi(job: Job): Dict {
  return (job.apiPayload as Dict | undefined) ?? {};
}

function addressLine(job: Job): string {
  return formatAddress(job.address as Dict | undefined, {
    fallback: {
      suburb: job.addressSuburb,
      state: job.addressState,
      postcode: job.addressPostcode,
      country: job.addressCountry,
    },
  });
}

/**
 * Compact page-header for the job overview page (/jobs/[id]).
 * Designed to live inside the top title bar via `SetPageHeader`.
 */
export function JobPageHeader({
  job,
  parentClaim,
}: {
  job: Job;
  parentClaim?: Claim | null;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const title = job.name ?? job.externalJobId ?? job.externalReference ?? job.id;
  const api = getApi(job);

  const clearJobSelection = () => {
    router.push('/jobs');
  };
  const statusName =
    job.status?.name ??
    ((api.status as Dict | undefined)?.name as string | undefined) ??
    'Unknown';
  const jobTypeName =
    job.jobType?.name ??
    ((api.jobType as Dict | undefined)?.name as string | undefined);
  const address = addressLine(job);

  const parentClaimNumber =
    parentClaim?.claimNumber ??
    parentClaim?.externalReference ??
    ((api.claim as Dict | undefined)?.claimNumber as string | undefined) ??
    ((api.claim as Dict | undefined)?.externalReference as string | undefined);

  return (
    <>
      <div className="flex w-full min-w-0 flex-col gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <BackButton href="/jobs" label="Back to jobs" />
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Briefcase className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="group inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md text-left outline-none transition-colors hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              title="Switch job"
            >
              <h1 className="truncate text-lg font-semibold leading-tight uppercase underline-offset-4 group-hover:underline">
                {title}
              </h1>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-emerald-700" />
            </button>
            <button
              type="button"
              onClick={clearJobSelection}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              title="Back to All Jobs"
              aria-label="Back to all jobs list"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <StatusBadge status={statusName} />
          {jobTypeName && <TypeBadge type={jobTypeName} />}
          {address && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {address}
            </span>
          )}
          {job.claimId && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span>Claim:</span>
              <Link
                href={`/claims/${job.claimId}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {parentClaimNumber ?? job.claimId}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-20 text-xs">
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Request:</span>
            <span className="font-medium">{formatDate(job.requestDate)}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Updated:</span>
            <span className="font-medium">{formatDateTime(job.updatedAt)}</span>
          </div>
          {job.excess != null && job.excess !== '' && (
            <div className="flex items-baseline gap-1">
              <span className="text-muted-foreground">Excess:</span>
              <span className="font-medium">{formatCurrency(job.excess)}</span>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Make-safe:</span>
            <span className="font-medium">
              {job.makeSafeRequired == null
                ? '—'
                : job.makeSafeRequired
                  ? 'Yes'
                  : 'No'}
            </span>
          </div>
        </div>
      </div>
      <JobsPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedJobId={job.id}
      />
    </>
  );
}
