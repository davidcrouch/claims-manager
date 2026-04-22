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

export function JobHeader({
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
    <header className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            <span>Job</span>
            {job.externalReference && (
              <>
                <span>·</span>
                <span className="font-mono">{job.externalReference}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
          {job.claimId && (
            <p className="text-xs text-muted-foreground">
              Parent claim:{' '}
              <Link
                href={`/claims/${job.claimId}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {parentClaimNumber ?? job.claimId}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-6 text-right">
          <div>
            <p className="text-xs text-muted-foreground">Request</p>
            <p className="text-sm font-medium">{formatDate(job.requestDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Updated</p>
            <p className="text-sm font-medium">{formatDateTime(job.updatedAt)}</p>
          </div>
          {job.excess != null && job.excess !== '' && (
            <div>
              <p className="text-xs text-muted-foreground">Excess</p>
              <p className="text-sm font-medium">{formatCurrency(job.excess)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Make-safe</p>
            <p className="text-sm font-medium">
              {job.makeSafeRequired == null
                ? '—'
                : job.makeSafeRequired
                  ? 'Yes'
                  : 'No'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
