import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { QuotesPageClient } from '@/components/quotes/QuotesPageClient';
import {buildJobAssigneeNameById,
  buildJobNameById,
  buildJobTypeById,
  toJobOptions,
  mergeCurrentJobIntoNameById,
  mergeCurrentJobIntoTypeById,
  mergeCurrentJobIntoOptions,
  mergeJobLabelsFromRows,
  mergeJobTypesFromRows } from '@/components/shared/job-label';
import type { Job, PaginatedResponse, Quote, Claim } from '@/types/api';

export default async function QuotesPage({
  searchParams }: {
  searchParams: Promise<{ page?: string; search?: string; jobId?: string; jobIds?: string; status?: string; quoteType?: string; sort?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Quote> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const jobIds = params.jobIds
    ? params.jobIds.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;
  const [initialQuotes, statusLookupsRes, typeLookupsRes, jobsRes, filterJobsRes] = await Promise.all([
    api
      .getQuotes({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        jobId: params.jobId,
        jobIds,
        status: params.status,
        quoteType: params.quoteType,
        sort: params.sort })
      .catch((err: unknown) => {
        console.error(
          'frontend:QuotesPage - getQuotes failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('quote_status').catch(() => []),
    api.getLookupsByDomain('quote_type', { providerCode: 'direct' }).catch(() => []),
    api.getJobs({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:QuotesPage - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyJobs;
    }),
    api.getQuoteFilterJobs().catch((err: unknown) => {
      console.error(
        'frontend:QuotesPage - getQuoteFilterJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return [];
    }),
  ]);

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:QuotesPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown' }),
  );
  const quoteTypes = (Array.isArray(typeLookupsRes) ? typeLookupsRes : []).map((row) => ({
    id: row.id,
    name: row.name?.trim() ? row.name : 'Unknown' }));
  const jobs = jobsRes?.data ?? [];
  const jobNameById = mergeJobLabelsFromRows(
    mergeCurrentJobIntoNameById(buildJobNameById(jobs), job),
    initialQuotes.data,
  );
  const jobTypeById = mergeJobTypesFromRows(
    mergeCurrentJobIntoTypeById(buildJobTypeById(jobs), job),
    initialQuotes.data,
  );
  const jobAssigneeNameById = buildJobAssigneeNameById(jobs);
  if (job?.id) {
    const scopedName = job.assigneeName?.trim();
    if (scopedName) jobAssigneeNameById[job.id] = scopedName;
  }

  return (
    <QuotesPageClient
      initialData={initialQuotes}
      statusOptions={statusOptions}
      quoteTypes={quoteTypes}
      jobNameById={jobNameById}
      jobTypeById={jobTypeById}
      jobAssigneeNameById={jobAssigneeNameById}
      jobs={mergeCurrentJobIntoOptions(toJobOptions(jobs), job)}
      filterJobs={filterJobsRes}
      job={job}
      parentClaim={parentClaim}
    />
  );
}
