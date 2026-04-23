'use client';

import Link from 'next/link';
import {
  Briefcase,
  Building2,
  MapPin,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatDateTime, formatCurrency } from '@/components/shared/detail';
import type { Job, Claim } from '@/types/api';

type Dict = Record<string, unknown>;

function getApi(job: Job): Dict {
  return (job.apiPayload as Dict | undefined) ?? {};
}

function addressLine(job: Job): string {
  const addr = job.address as Dict | undefined;
  if (!addr) return '';
  const parts = [
    addr.unitNumber ?? addr.unit_number,
    addr.streetNumber ?? addr.street_number,
    addr.streetName ?? addr.street_name,
    addr.suburb,
    addr.state,
    addr.postcode,
    addr.country,
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : x))
    .filter(Boolean);
  if (parts.length) return parts.join(', ');
  const fallback = [job.addressSuburb, job.addressState, job.addressPostcode, job.addressCountry]
    .filter(Boolean)
    .join(', ');
  return fallback;
}

function vendorDisplay(job: Job): { name?: string; externalReference?: string } {
  const api = getApi(job);
  const apiVendor = (api.vendor as Dict | undefined) ?? {};
  return {
    name:
      (job.vendor?.name as string | undefined) ??
      (apiVendor.name as string | undefined) ??
      ((job.vendorSnapshot as Dict | undefined)?.name as string | undefined),
    externalReference:
      (job.vendor?.externalReference as string | undefined) ??
      (apiVendor.externalReference as string | undefined),
  };
}

/**
 * Compact page-header renderer for a job. Designed to live inside the top
 * title bar (see `SetPageHeader`).
 */
export function JobPageHeader({
  job,
  parentClaim,
}: {
  job: Job;
  parentClaim?: Claim | null;
}) {
  const title = job.externalReference ?? job.id;
  const api = getApi(job);
  const statusName =
    job.status?.name ??
    ((api.status as Dict | undefined)?.name as string | undefined) ??
    'Unknown';
  const jobTypeName =
    job.jobType?.name ??
    ((api.jobType as Dict | undefined)?.name as string | undefined);
  const vendor = vendorDisplay(job);
  const address = addressLine(job);

  const parentClaimNumber =
    parentClaim?.claimNumber ??
    parentClaim?.externalReference ??
    ((api.claim as Dict | undefined)?.claimNumber as string | undefined) ??
    ((api.claim as Dict | undefined)?.externalReference as string | undefined);

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <Briefcase className="h-5 w-5 shrink-0 text-muted-foreground" />
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
        <StatusBadge status={statusName} />
        {jobTypeName && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Tag className="h-3 w-3" />
            {jobTypeName}
          </span>
        )}
        {vendor.name && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {vendor.name}
            {vendor.externalReference && (
              <span className="font-mono text-[10px] opacity-70">
                · {vendor.externalReference}
              </span>
            )}
          </span>
        )}
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
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
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
  );
}
