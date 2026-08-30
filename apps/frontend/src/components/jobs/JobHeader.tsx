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
import {
  PageHeaderField,
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
import { JobsPickerDrawer } from '@/components/jobs/JobsPickerDrawer';
import { formatDate, formatDateTime, formatCurrency, formatAddress, BoolPill } from '@/components/shared/detail';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { jobHeaderSubtitle, jobHeaderTitle } from '@/components/shared/job-label';
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
  const api = getApi(job);

  const clearJobSelection = () => {
    router.push('/jobs');
  };
  const statusName =
    job.status?.name?.trim() ||
    ((api.status as Dict | undefined)?.name as string | undefined)?.trim() ||
    job.status?.externalReference?.trim() ||
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

  const topLabel = jobHeaderSubtitle(job);
  const linkTitle = jobHeaderTitle(job);

  return (
    <>
      <PageHeaderLayout
        leading={<BackButton href="/jobs" label="Back to jobs" />}
        icon={
          <PageHeaderIcon
            icon={Briefcase}
            className="bg-emerald-100"
            iconClassName="text-emerald-600"
          />
        }
        topTitle={
          topLabel ? (
            <Link
              href={`/jobs/${job.id}`}
              className="group min-w-0 max-w-full rounded-md outline-none transition-colors hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              title="View job"
            >
              <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {topLabel}
              </p>
            </Link>
          ) : undefined
        }
        title={
          <Link
            href={`/jobs/${job.id}`}
            className="group min-w-0 max-w-full rounded-md outline-none transition-colors hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            title="View job"
          >
            <h1 className="truncate font-mono text-lg font-semibold leading-tight uppercase underline-offset-4 group-hover:underline">
              {linkTitle}
            </h1>
          </Link>
        }
        titleActions={
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              title="Switch job"
              aria-label="Switch job"
            >
              <ChevronsUpDown className="h-4 w-4" />
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
        }
        topRow={
          <>
            <StatusBadge status={statusName} />
            {job.syncStatus && (
              <SyncStatusIndicator syncStatus={job.syncStatus} compact />
            )}
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
          </>
        }
        bottomRow={
          <>
            <PageHeaderField label="Request">{formatDate(job.requestDate)}</PageHeaderField>
            <PageHeaderField label="Updated">{formatDateTime(job.updatedAt)}</PageHeaderField>
            {job.excess != null && job.excess !== '' && (
              <PageHeaderField label="Excess">{formatCurrency(job.excess)}</PageHeaderField>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-muted-foreground">Make-safe:</span>
              <BoolPill value={job.makeSafeRequired} />
            </div>
          </>
        }
      />
      <JobsPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedJobId={job.id}
      />
    </>
  );
}
