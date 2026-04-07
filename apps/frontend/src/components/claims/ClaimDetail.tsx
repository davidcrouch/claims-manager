'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import type { Claim } from '@/types/api';

function formatAddress(claim: Claim): string {
  const addr = claim.address as Record<string, unknown> | undefined;
  if (!addr) return '';
  const parts = [
    addr.unitNumber ?? addr.unit_number,
    addr.streetNumber ?? addr.street_number,
    addr.streetName ?? addr.street_name,
    addr.suburb,
    addr.postcode,
    addr.state,
    addr.country,
  ].filter(Boolean);
  return parts.join(', ');
}

export function ClaimDetail({ claim }: { claim: Claim }) {
  const title = claim.claimNumber ?? claim.externalReference ?? claim.id;
  const statusName = (claim.status as { name?: string })?.name ?? 'Unknown';
  const address = formatAddress(claim) || claim.addressSuburb || '-';

  const policyDetails = claim.policyDetails as Record<string, unknown> | undefined;
  const policyName = String(policyDetails?.policyName ?? policyDetails?.policy_name ?? claim.policyName ?? '-');
  const policyNumber = String(policyDetails?.policyNumber ?? policyDetails?.policy_number ?? claim.policyNumber ?? '-');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            {title}
          </h1>
          <StatusBadge status={statusName} className="mt-2" />
          <p className="mt-2 text-muted-foreground">{address}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-medium">Address</h2>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{address || '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-medium">Policy</h2>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Name:</span> {policyName}</p>
            <p><span className="text-muted-foreground">Number:</span> {policyNumber}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-medium">Loss</h2>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Date:</span> {claim.dateOfLoss ? new Date(claim.dateOfLoss).toLocaleDateString() : '—'}</p>
            <p><span className="text-muted-foreground">Description:</span> {claim.incidentDescription ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      {claim.jobs && claim.jobs.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium">Linked Jobs</h2>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(claim.jobs as { id: string; externalReference?: string }[]).map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`}>
                    <Button variant="link" className="p-0 h-auto">
                      {job.externalReference ?? job.id}
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
