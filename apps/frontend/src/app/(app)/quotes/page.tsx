import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { QuotesPageClient } from '@/components/quotes/QuotesPageClient';
import {
  isQuotesMineTab,
  parseQuotesListTab,
  resolveQuotesListStatusParam,
} from '@/components/quotes/quotes-list-helpers';
import { getSession } from '@/lib/auth';
import { resolveCurrentOrgUserId } from '@/lib/current-org-user';
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
  searchParams: Promise<{ page?: string; search?: string; jobId?: string; jobIds?: string; status?: string; quoteType?: string; sort?: string; tab?: string; archiveState?: string; assignedToUserId?: string; assignedToUserIds?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Quote> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const tab = parseQuotesListTab(params.tab ?? null);
  const jobIds = params.jobIds
    ? params.jobIds.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;

  const [orgUsers, session, statusLookupsRes, typeLookupsRes, jobsRes, filterJobsRes] =
    await Promise.all([
      api.listOrgUsersForSelect().catch(() => [] as { id: string; email?: string }[]),
      getSession(),
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

  const currentUserId = resolveCurrentOrgUserId(orgUsers, session.identity);
  const effectiveTab =
    tab === 'active' && params.assignedToUserId && params.assignedToUserId === currentUserId
      ? 'mine'
      : tab;
  const mineTab = isQuotesMineTab(effectiveTab);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const initialStatus = resolveQuotesListStatusParam({
    tab: effectiveTab,
    statusOptions,
    explicitStatus: params.status,
    archiveState: mineTab ? params.archiveState : undefined,
  });
  const initialAssignedToUserId = mineTab && currentUserId ? currentUserId : undefined;
  const initialAssignedToUserIds = mineTab ? undefined : params.assignedToUserIds;

  const [initialQuotes] = await Promise.all([
    api
      .getQuotes({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        jobId: params.jobId,
        jobIds,
        status: initialStatus,
        quoteType: params.quoteType,
        sort: params.sort,
        assignedToUserId: initialAssignedToUserId,
        assignedToUserIds: initialAssignedToUserIds,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:QuotesPage - getQuotes failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
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

  const quoteTypes = (Array.isArray(typeLookupsRes) ? typeLookupsRes : []).map((row) => ({    id: row.id,
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
      currentUserId={currentUserId}
    />
  );
}
