'use client';

import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { EntityCard } from '@/components/ui/entity-card';
import type { Job } from '@/types/api';

function formatAddress(job: Job): string {
  const addr = job.address as { streetNumber?: string; streetName?: string; suburb?: string } | undefined;
  if (addr) {
    const parts = [addr.streetNumber, addr.streetName, addr.suburb].filter(Boolean);
    return parts.join(' ') || '';
  }
  return job.addressSuburb ?? '';
}

export function JobCard({ job }: { job: Job }) {
  const title = job.externalReference ?? job.id;
  const subtitle = formatAddress(job);
  const statusName = (job.status as { name?: string })?.name ?? 'Unknown';
  const jobTypeName = (job.jobType as { name?: string })?.name ?? '';
  const requestDate = job.requestDate
    ? new Date(job.requestDate).toLocaleDateString()
    : '';

  return (
    <EntityCard
      href={`/jobs/${job.id}`}
      icon={Briefcase}
      accentColor="border-l-amber-500"
      title={title}
      subtitle={subtitle}
      badge={statusName}
      footer={
        <>
          {jobTypeName}
          {requestDate && ` • ${requestDate}`}
          {job.claimId && (
            <>
              {' • '}
              <Link href={`/claims/${job.claimId}`} className="hover:underline">
                Claim
              </Link>
            </>
          )}
        </>
      }
    />
  );
}
