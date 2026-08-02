import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { QuotesPageClient } from '@/components/quotes/QuotesPageClient';
import { buildJobNameById, toJobOptions } from '@/components/shared/job-label';
import type { Job, PaginatedResponse, Quote } from '@/types/api';

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; jobId?: string; status?: string; quoteType?: string; sort?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Quote> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const [initialQuotes, statusLookupsRes, typeLookupsRes, jobsRes] = await Promise.all([
    api
      .getQuotes({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        jobId: params.jobId,
        status: params.status,
        quoteType: params.quoteType,
        sort: params.sort,
      })
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
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const quoteTypes = (Array.isArray(typeLookupsRes) ? typeLookupsRes : []).map((row) => ({
    id: row.id,
    name: row.name?.trim() ? row.name : 'Unknown',
  }));
  const jobs = jobsRes?.data ?? [];
  const jobNameById = buildJobNameById(jobs);

  return (
    <QuotesPageClient
      initialData={initialQuotes}
      statusOptions={statusOptions}
      quoteTypes={quoteTypes}
      jobNameById={jobNameById}
      jobs={toJobOptions(jobs)}
    />
  );
}
