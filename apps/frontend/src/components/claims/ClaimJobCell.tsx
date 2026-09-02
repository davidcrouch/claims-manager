'use client';

import Link from 'next/link';
import { jobDisplayName } from '@/components/shared/job-label';
import type { Job } from '@/types/api';

type ClaimJobRef = Pick<
  Job,
  'id' | 'name' | 'internalNumber' | 'externalJobId' | 'externalReference'
>;

export function ClaimJobCell({ jobs }: { jobs?: ClaimJobRef[] | null }) {
  const items = (jobs ?? []).filter((job) => job.id);
  if (items.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  const primary = items[0];
  const primaryLabel = jobDisplayName(primary);

  return (
    <Link
      href={`/jobs/${primary.id}`}
      className="text-primary hover:underline"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Open ${primaryLabel}`}
    >
      {primaryLabel}
    </Link>
  );
}
