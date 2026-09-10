import type { JobsRepository } from '../database/repositories';

export type ListJobSummary = {
  id: string;
  internalNumber: string | null;
  name: string | null;
  externalJobId: string | null;
  externalReference: string | null;
  jobType: { name: string } | null;
};

function toListJobSummary(job: {
  id: string;
  internalNumber: string | null;
  name: string | null;
  externalJobId: string | null;
  externalReference: string | null;
  jobTypeName: string | null;
}): ListJobSummary {
  return {
    id: job.id,
    internalNumber: job.internalNumber,
    name: job.name,
    externalJobId: job.externalJobId,
    externalReference: job.externalReference,
    jobType: job.jobTypeName ? { name: job.jobTypeName } : null,
  };
}

/** Attach nested `job` summaries so list cells work when getJobs is capped. */
export async function attachJobSummaries<T>(params: {
  tenantId: string;
  rows: T[];
  jobsRepo: JobsRepository;
  jobIdOf?: (row: T) => string | null | undefined;
}): Promise<Array<T & { job?: ListJobSummary }>> {
  const jobIdOf =
    params.jobIdOf ?? ((row: T) => (row as { jobId?: string | null }).jobId);
  const jobIds = [
    ...new Set(params.rows.map((row) => jobIdOf(row)).filter((id): id is string => !!id)),
  ];
  const jobs = await params.jobsRepo.findByIds({
    tenantId: params.tenantId,
    ids: jobIds,
  });
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  return params.rows.map((row): T & { job?: ListJobSummary } => {
    const jobId = jobIdOf(row);
    const job = jobId ? jobById.get(jobId) : undefined;
    if (!job) return row as T & { job?: ListJobSummary };
    return { ...row, job: toListJobSummary(job) };
  });
}
