import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { FinanceArClient } from '@/components/finance/FinanceArClient';

export const metadata = { title: 'Accounts Receivable — EnsureOS' };

export default async function AccountsReceivablePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sort?: string; status?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;

  const [summary, invoicesRes, statusLookupsRes] = await Promise.all([
    api.getFinanceAr().catch((err: unknown) => {
      console.error(
        'frontend:AccountsReceivablePage - getFinanceAr failed:',
        err instanceof Error ? err.message : err,
      );
      return { buckets: [], totalOutstanding: 0, totalOverdue: 0, totalPaid: 0 };
    }),
    api
      .getInvoices({
        limit: 100,
        search: params.search,
        sort: params.sort ?? 'issue_date_asc',
        status: params.status,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:AccountsReceivablePage - getInvoices failed:',
          err instanceof Error ? err.message : err,
        );
        return { data: [], total: 0, page: 1, limit: 100 };
      }),
    api.getLookupsByDomain('invoice_status').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <FinanceArClient
      summary={summary}
      initialInvoices={invoicesRes}
      statusOptions={statusOptions}
    />
  );
}
