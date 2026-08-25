'use client';

import Link from 'next/link';
import { ClipboardList, ExternalLink, Lock } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import {
  PageHeaderField,
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
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
    <PageHeaderLayout
      leading={<BackButton href={backHref} label="Back to assessments" />}
      icon={
        <PageHeaderIcon
          icon={ClipboardList}
          className="bg-slate-100"
          iconClassName="text-slate-600"
        />
      }
      title={assessment.name}
      topRow={
        <>
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
        </>
      }
      bottomRow={
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground">Status:</span>
            <StatusBadge status={assessment.status} />
          </div>
          <PageHeaderField label="Created">{formatDate(assessment.createdAt)}</PageHeaderField>
        </>
      }
    />
  );
}
