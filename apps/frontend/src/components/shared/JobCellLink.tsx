'use client';

import Link from 'next/link';
import { resolveJobName, resolveJobType } from '@/components/shared/job-label';
import { TypeBadge } from '@/components/ui/type-badge';

type JobCellLinkProps = {
  jobId?: string | null;
  jobNameById?: Record<string, string>;
  jobTypeById?: Record<string, string>;
  label?: string;
  jobType?: string | null;
  className?: string;
  emptyLabel?: string;
};

export function JobCellLink({
  jobId,
  jobNameById,
  jobTypeById,
  label,
  jobType,
  className = 'text-primary hover:underline',
  emptyLabel = '—',
}: JobCellLinkProps) {
  const resolved = (label ?? resolveJobName(jobId, jobNameById)).trim();
  const typeName = resolveJobType(jobId, jobTypeById, jobType);
  if (!jobId?.trim() || !resolved) {
    return <>{emptyLabel}</>;
  }

  return (
    <Link
      href={`/jobs/${jobId}`}
      className="inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
      aria-label={typeName ? `Open ${resolved} ${typeName}` : `Open ${resolved}`}
    >
      <span className={className}>{resolved}</span>
      {typeName ? <TypeBadge type={typeName} /> : null}
    </Link>
  );
}
