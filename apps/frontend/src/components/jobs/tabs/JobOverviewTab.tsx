'use client';

import Link from 'next/link';
import {
  Building2,
  MapPin,
  FileSignature,
  Briefcase,
  ExternalLink,
  ScrollText,
  FileText,
  Phone,
  Clock,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DefRow,
  SectionCard,
  BoolPill,
  formatDate,
  formatDateTime,
  formatCurrency,
  pick,
  asString,
} from '@/components/shared/detail';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Job, Claim } from '@/types/api';

type Dict = Record<string, unknown>;

function getApi(job: Job): Dict {
  return (job.apiPayload as Dict | undefined) ?? {};
}

function formatAddress(job: Job): string {
  const addr = job.address as Dict | undefined;
  if (addr) {
    const parts = [
      pick(addr, 'unitNumber', 'unit_number'),
      pick(addr, 'streetNumber', 'street_number'),
      pick(addr, 'streetName', 'street_name'),
      pick(addr, 'suburb'),
      pick(addr, 'state'),
      pick(addr, 'postcode'),
      pick(addr, 'country'),
    ]
      .map((x) => (typeof x === 'string' ? x.trim() : x))
      .filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  const fallback = [
    job.addressSuburb,
    job.addressState,
    job.addressPostcode,
    job.addressCountry,
  ]
    .filter(Boolean)
    .join(', ');
  return fallback;
}

export function JobOverviewTab({
  job,
  parentClaim,
}: {
  job: Job;
  parentClaim?: Claim | null;
}) {
  const api = getApi(job);
  const address = formatAddress(job);
  const statusName =
    job.status?.name ??
    ((api.status as Dict | undefined)?.name as string | undefined) ??
    'Unknown';
  const jobTypeName =
    job.jobType?.name ??
    ((api.jobType as Dict | undefined)?.name as string | undefined);

  const addr = (job.address as Dict | undefined) ?? {};
  const latitude = asString(pick(addr, 'latitude', 'lat'));
  const longitude = asString(pick(addr, 'longitude', 'lng', 'long'));

  const apiVendor = (api.vendor as Dict | undefined) ?? {};
  const snapshot = (job.vendorSnapshot as Dict | undefined) ?? {};
  const vendorName =
    job.vendor?.name ??
    (apiVendor.name as string | undefined) ??
    (snapshot.name as string | undefined);
  const vendorExtRef =
    job.vendor?.externalReference ??
    (apiVendor.externalReference as string | undefined) ??
    (snapshot.externalReference as string | undefined);
  const vendorPhone = asString(
    pick(apiVendor, 'phone', 'contactPhone') ??
      pick(snapshot, 'phone', 'contactPhone'),
  );
  const vendorAfterHours = asString(
    pick(apiVendor, 'afterHoursPhone') ?? pick(snapshot, 'afterHoursPhone'),
  );
  const vendorEmail = asString(
    pick(apiVendor, 'email') ?? pick(snapshot, 'email'),
  );

  const instructionsHtml = job.jobInstructions ?? '';

  const parentClaimNumber =
    parentClaim?.claimNumber ??
    parentClaim?.externalReference ??
    ((api.claim as Dict | undefined)?.claimNumber as string | undefined) ??
    ((api.claim as Dict | undefined)?.externalReference as string | undefined);

  const custom = (job.customData as Dict | undefined) ?? {};
  const insurerRef = asString(
    pick(custom, 'insurerExternalReference') ??
      pick(api, 'externalReference'),
  );
  const cwUpdatedAt = asString(
    pick(custom, 'cwUpdatedAtDate') ?? pick(api, 'updatedAtDate'),
  );
  const parentClaimCw = job.parentClaimId ?? null;
  const parentJobId = job.parentJobId ?? null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium">{statusName}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Job type</p>
            <p className="mt-1 text-sm font-medium">{jobTypeName ?? '—'}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Vendor</p>
            <p className="mt-1 text-sm font-medium">{vendorName ?? '—'}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Request date</p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(job.requestDate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Core Details"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="External reference"
            value={job.externalReference ?? '—'}
          />
          {insurerRef && (
            <DefRow label="Insurer reference" value={insurerRef} />
          )}
          <DefRow label="Job type" value={jobTypeName ?? '—'} />
          <DefRow label="Status" value={statusName} />
          <DefRow
            label="Parent claim"
            value={
              job.claimId ? (
                <Link
                  href={`/claims/${job.claimId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {parentClaimNumber ?? job.claimId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          {parentClaimCw && parentClaimCw !== job.claimId && (
            <DefRow
              label="Parent claim (Crunchwork)"
              value={
                <span className="font-mono text-xs">{parentClaimCw}</span>
              }
            />
          )}
          {parentJobId && (
            <DefRow
              label="Parent job"
              value={
                <Link
                  href={`/jobs/${parentJobId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open master job
                  <ExternalLink className="h-3 w-3" />
                </Link>
              }
            />
          )}
          <DefRow label="Request date" value={formatDate(job.requestDate)} />
          <DefRow
            label="Make-safe required"
            value={<BoolPill value={job.makeSafeRequired} />}
          />
          <DefRow
            label="Collect excess"
            value={<BoolPill value={job.collectExcess} />}
          />
          <DefRow label="Excess" value={formatCurrency(job.excess)} />
          <DefRow label="Created" value={formatDateTime(job.createdAt)} />
          <DefRow label="Updated" value={formatDateTime(job.updatedAt)} />
          {cwUpdatedAt && (
            <DefRow
              label="Crunchwork updated"
              value={formatDateTime(cwUpdatedAt)}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Risk Location"
          icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Address" value={address || '—'} />
          <DefRow label="Suburb" value={job.addressSuburb ?? '—'} />
          <DefRow label="State" value={job.addressState ?? '—'} />
          <DefRow label="Postcode" value={job.addressPostcode ?? '—'} />
          <DefRow label="Country" value={job.addressCountry ?? '—'} />
          {(latitude || longitude) && (
            <DefRow
              label="Coordinates"
              value={
                latitude && longitude
                  ? `${latitude}, ${longitude}`
                  : (latitude ?? longitude ?? '—')
              }
            />
          )}
        </SectionCard>
      </div>

      {(vendorName || vendorExtRef || vendorPhone || vendorEmail) && (
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard
            title="Vendor"
            icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
          >
            <DefRow label="Name" value={vendorName ?? '—'} />
            <DefRow
              label="External reference"
              value={vendorExtRef ?? '—'}
            />
            <DefRow
              label="Phone"
              value={
                vendorPhone ? (
                  <a
                    href={`tel:${vendorPhone}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {vendorPhone}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <DefRow
              label="After-hours phone"
              value={
                vendorAfterHours ? (
                  <a
                    href={`tel:${vendorAfterHours}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Clock className="h-3 w-3" />
                    {vendorAfterHours}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <DefRow label="Email" value={vendorEmail ?? '—'} />
          </SectionCard>

          <SectionCard
            title="Parent Claim"
            icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
            action={
              job.claimId ? (
                <Link
                  href={`/claims/${job.claimId}`}
                  className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null
            }
          >
            <DefRow
              label="Claim number"
              value={parentClaim?.claimNumber ?? parentClaimNumber ?? '—'}
            />
            <DefRow
              label="External reference"
              value={parentClaim?.externalReference ?? '—'}
            />
            <DefRow
              label="Status"
              value={
                parentClaim?.status?.name ? (
                  <StatusBadge status={parentClaim.status.name} />
                ) : (
                  '—'
                )
              }
            />
            <DefRow
              label="Account"
              value={parentClaim?.account?.name ?? '—'}
            />
            <DefRow
              label="Lodged"
              value={formatDate(parentClaim?.lodgementDate)}
            />
            <DefRow
              label="Date of loss"
              value={formatDate(parentClaim?.dateOfLoss)}
            />
          </SectionCard>
        </div>
      )}

      {!vendorName && !vendorExtRef && !vendorPhone && !vendorEmail && (
        <SectionCard
          title="Parent Claim"
          icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
          action={
            job.claimId ? (
              <Link
                href={`/claims/${job.claimId}`}
                className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline"
              >
                Open <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null
          }
        >
          <DefRow
            label="Claim number"
            value={parentClaim?.claimNumber ?? parentClaimNumber ?? '—'}
          />
          <DefRow
            label="External reference"
            value={parentClaim?.externalReference ?? '—'}
          />
          <DefRow
            label="Status"
            value={
              parentClaim?.status?.name ? (
                <StatusBadge status={parentClaim.status.name} />
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Account"
            value={parentClaim?.account?.name ?? '—'}
          />
          <DefRow
            label="Lodged"
            value={formatDate(parentClaim?.lodgementDate)}
          />
        </SectionCard>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {instructionsHtml ? (
            <div
              className="prose prose-sm max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: instructionsHtml }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              <FileText className="mr-1 inline h-3 w-3" />
              No job instructions provided.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
