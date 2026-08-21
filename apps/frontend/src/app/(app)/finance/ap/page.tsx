import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { FinanceApClient } from '@/components/finance/FinanceApClient';

export const metadata = { title: 'Accounts Payable — EnsureOS' };

export default async function AccountsPayablePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sort?: string; status?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;

  const [summary, billsRes, statusLookupsRes] = await Promise.all([
    api.getFinanceAp().catch((err: unknown) => {
      console.error(
        'frontend:AccountsPayablePage - getFinanceAp failed:',
        err instanceof Error ? err.message : err,
      );
      return { buckets: [], totalOutstanding: 0, totalOverdue: 0, totalPaid: 0 };
    }),
    api
      .getBills({
        limit: 100,
        search: params.search,
        sort: params.sort ?? 'due_date_asc',
        status: params.status,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:AccountsPayablePage - getBills failed:',
          err instanceof Error ? err.message : err,
        );
        return { data: [], total: 0, page: 1, limit: 100 };
      }),
    api.getLookupsByDomain('bill_status').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <FinanceApClient
      summary={summary}
      initialBills={billsRes}
      statusOptions={statusOptions}
    />
  );
}
