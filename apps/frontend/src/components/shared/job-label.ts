import type { Job } from '@/types/api';

type JobLabelSource = Pick<
  Job,
  'id' | 'name' | 'externalJobId' | 'externalReference'
>;

export type JobOption = {
  id: string;
  label: string;
  claimId?: string | null;
};

export function jobDisplayName(job: JobLabelSource): string {
  return (
    job.name?.trim() ||
    job.externalJobId?.trim() ||
    job.externalReference?.trim() ||
    job.id
  );
}

export function buildJobNameById(jobs: JobLabelSource[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const job of jobs) {
    map[job.id] = jobDisplayName(job);
  }
  return map;
}

export function resolveJobName(
  jobId: string | null | undefined,
  jobNameById?: Record<string, string>,
): string {
  if (!jobId) return '';
  return jobNameById?.[jobId] ?? '';
}

/** Server-safe helper for Create drawers that need a job picker. */
export function toJobOptions(
  jobs: Array<JobLabelSource & { claimId?: string | null }>,
): JobOption[] {
  return jobs.map((job) => ({
    id: job.id,
    label: jobDisplayName(job),
    claimId: job.claimId,
  }));
}
