'use client';

import { useCallback, useEffect, useState } from 'react';
import { AssessmentFormDrawer } from '../AssessmentFormDrawer';
import { createAssessmentAction } from '@/app/(app)/assessments/actions';
import {
  fetchJobByIdAction,
  fetchJobsAction,
} from '@/app/(app)/jobs/actions';
import { usePageContext } from '@/lib/ai/use-page-context';
import { toJobOptions, type JobOption } from '@/components/shared/job-label';
import type { Assessment } from '@/types/api';

export interface AssessmentCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  name?: string;
  claimRecommendation?: string;
  makeSafe?: boolean;
  makeSafeType?: string;
  designType?: string;
  construction?: string;
  roofType?: string;
  buildingType?: string;
  comments?: string;
  companionChatOpen?: boolean;
  [key: string]: unknown;
}

export function AssessmentCreateDrawer({
  open,
  onOpenChange,
  jobId: jobIdProp,
  name,
  claimRecommendation,
  makeSafe,
  makeSafeType,
  designType,
  construction,
  roofType,
  buildingType,
  comments,
}: AssessmentCreateDrawerProps) {
  const pageContext = usePageContext();
  const resolvedJobId = jobIdProp?.trim() || pageContext.jobId || undefined;
  const [jobs, setJobs] = useState<JobOption[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      const [jobsRes, focusedJob] = await Promise.all([
        fetchJobsAction({ limit: 100 }),
        resolvedJobId ? fetchJobByIdAction(resolvedJobId) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      const options = toJobOptions(jobsRes?.data ?? []);
      if (focusedJob && !options.some((j) => j.id === focusedJob.id)) {
        options.unshift(...toJobOptions([focusedJob]));
      }
      setJobs(options);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, resolvedJobId]);

  const handleCreate = useCallback(
    async (data: Partial<Assessment> & { name: string }) => {
      try {
        return await createAssessmentAction(data);
      } catch (err) {
        console.error(
          '[AssessmentCreateDrawer.handleCreate]',
          err instanceof Error ? err.message : err,
        );
        throw err;
      }
    },
    [],
  );

  return (
    <AssessmentFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      createAssessment={handleCreate}
      jobId={resolvedJobId}
      jobs={jobs}
      name={name}
      claimRecommendation={claimRecommendation}
      makeSafe={makeSafe}
      makeSafeType={makeSafeType}
      designType={designType}
      construction={construction}
      roofType={roofType}
      buildingType={buildingType}
      comments={comments}
    />
  );
}
