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
import type { Assessment, Job } from '@/types/api';

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
  const [focusedJob, setFocusedJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      const [jobsRes, fetchedJob] = await Promise.all([
        fetchJobsAction({ limit: 100 }),
        resolvedJobId ? fetchJobByIdAction(resolvedJobId) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      const options = toJobOptions(jobsRes?.data ?? []);
      if (fetchedJob && !options.some((j) => j.id === fetchedJob.id)) {
        options.unshift(...toJobOptions([fetchedJob]));
      }
      setJobs(options);
      setFocusedJob(fetchedJob ?? null);
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
      job={focusedJob}
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
