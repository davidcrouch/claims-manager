'use client';

import Link from 'next/link';
import { ClipboardList, ExternalLink, Lock } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/components/shared/list-filters';
import { jobDisplayName } from '@/components/shared/job-label';
import { isAssessmentLocked } from '@/components/assessments/assessment-sections';
import type { Assessment, Job } from '@/types/api';

export function AssessmentPageHeader({
  assessment,
  job,
  backHref,
}: {
  assessment: Assessment;
  job?: Job | null;
  backHref: string;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-y-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href={backHref} label="Back to assessments" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
          <ClipboardList className="h-4 w-4 text-slate-600" />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">{assessment.name}</h1>
        {isAssessmentLocked(assessment.status) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            <Lock className="h-3 w-3" />
            Locked
          </span>
        )}
        {job && (
          <Link
            href={`/jobs/${job.id}`}
            className="inline-flex items-center gap-1 text-xs uppercase text-primary hover:underline"
          >
            {jobDisplayName(job)}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-20 text-xs">
        <div className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">Status:</span>
          <StatusBadge status={assessment.status} />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Created:</span>
          <span className="font-medium">{formatDate(assessment.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
