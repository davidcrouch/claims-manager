import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { QuotesListClient } from '@/components/quotes/QuotesListClient';
import type { PaginatedResponse, Quote } from '@/types/api';

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; jobId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Quote> = { data: [], total: 0 };
  const [initialQuotes, statusLookupsRes] = await Promise.all([
    api
      .getQuotes({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        jobId: params.jobId,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:QuotesPage - getQuotes failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('quote_status').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Quotes', href: '/quotes' }]} />
      <QuotesListClient initialData={initialQuotes} statusOptions={statusOptions} />
    </>
  );
}
