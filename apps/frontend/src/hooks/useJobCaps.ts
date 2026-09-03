import { useMemo } from 'react';
import type { Job } from '@/types/api';
import { resolveJobKindCaps, type JobKindCapabilities } from '@/lib/job-kind-registry';

/**
 * Resolve job-kind capabilities for a Job, memoised on provider + job type.
 */
export function useJobCaps(job: Job | null | undefined): JobKindCapabilities {
  return useMemo(
    () =>
      resolveJobKindCaps({
        provider: job?.provider,
        jobType: job?.jobType,
      }),
    [job?.provider, job?.jobType?.name, job?.jobType?.externalReference],
  );
}
