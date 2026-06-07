import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { FinanceApClient } from '@/components/finance/FinanceApClient';

export const metadata = { title: 'Accounts Payable — EnsureOS' };

export default async function AccountsPayablePage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const [summary, billsRes] = await Promise.all([
    api.getFinanceAp().catch((err: unknown) => {
      console.error(
        'frontend:AccountsPayablePage - getFinanceAp failed:',
        err instanceof Error ? err.message : err,
      );
      return { buckets: [], totalOutstanding: 0, totalOverdue: 0, totalPaid: 0 };
    }),
    api.getBills({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:AccountsPayablePage - getBills failed:',
        err instanceof Error ? err.message : err,
      );
      return { data: [], total: 0, page: 1, limit: 100 };
    }),
  ]);

  return <FinanceApClient summary={summary} bills={billsRes.data} />;
}
