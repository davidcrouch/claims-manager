'use client';

import { useMemo } from 'react';
import {
  mergeJobLabelsFromRows,
  mergeJobTypesFromRows,
  type JobLabelSource,
} from '@/components/shared/job-label';

export function useResolvedJobLabels(
  jobNameById: Record<string, string> | undefined,
  jobTypeById: Record<string, string> | undefined,
  rows: Array<{ jobId?: string | null; job?: JobLabelSource | null }>,
) {
  const resolvedJobNameById = useMemo(
    () => mergeJobLabelsFromRows(jobNameById, rows),
    [jobNameById, rows],
  );
  const resolvedJobTypeById = useMemo(
    () => mergeJobTypesFromRows(jobTypeById, rows),
    [jobTypeById, rows],
  );
  return { resolvedJobNameById, resolvedJobTypeById };
}
