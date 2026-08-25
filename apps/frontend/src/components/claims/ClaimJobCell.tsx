'use client';

import Link from 'next/link';
import { TypeBadge } from '@/components/ui/type-badge';
import { jobDisplayName } from '@/components/shared/job-label';
import type { Job } from '@/types/api';

type ClaimJobRef = Pick<
  Job,
  'id' | 'name' | 'internalNumber' | 'externalJobId' | 'externalReference'
> & {
  jobType?: { name?: string | null } | null;
};

export function ClaimJobCell({ jobs }: { jobs?: ClaimJobRef[] | null }) {
  const items = (jobs ?? []).filter((job) => job.id);
  if (items.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  const primary = items[0];
  const extraCount = items.length - 1;
  const primaryLabel = jobDisplayName(primary);

  return (
    <div
      className="group/jobs relative isolate z-10 hover:z-40 focus-within:z-40"
      onClick={(e) => e.stopPropagation()}
    >
      <Link
        href={`/jobs/${primary.id}`}
        className="inline-flex items-baseline gap-1 text-primary hover:underline"
        aria-label={
          extraCount > 0
            ? `${primaryLabel} and ${extraCount} more job${extraCount === 1 ? '' : 's'}`
            : `Open ${primaryLabel}`
        }
      >
        <span>{primaryLabel}</span>
        {extraCount > 0 ? (
          <span className="text-xs font-medium text-slate-500">+{extraCount}</span>
        ) : null}
      </Link>

      <div className="pointer-events-none invisible absolute left-0 top-full z-40 pt-1 group-hover/jobs:pointer-events-auto group-hover/jobs:visible group-focus-within/jobs:pointer-events-auto group-focus-within/jobs:visible">
        <ul className="min-w-[16rem] rounded-md bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {items.map((job) => {
            const label = jobDisplayName(job);
            const typeName = job.jobType?.name?.trim();
            return (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-2 whitespace-nowrap px-2.5 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{label}</span>
                  {typeName ? <TypeBadge type={typeName} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
