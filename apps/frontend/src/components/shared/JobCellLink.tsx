'use client';

import Link from 'next/link';
import { resolveJobName } from '@/components/shared/job-label';

type JobCellLinkProps = {
  jobId?: string | null;
  jobNameById?: Record<string, string>;
  label?: string;
  className?: string;
  emptyLabel?: string;
};

export function JobCellLink({
  jobId,
  jobNameById,
  label,
  className = 'text-primary hover:underline',
  emptyLabel = '—',
}: JobCellLinkProps) {
  const resolved = (label ?? resolveJobName(jobId, jobNameById)).trim();
  if (!jobId?.trim() || !resolved) {
    return <>{emptyLabel}</>;
  }

  return (
    <Link
      href={`/jobs/${jobId}`}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {resolved}
    </Link>
  );
}
