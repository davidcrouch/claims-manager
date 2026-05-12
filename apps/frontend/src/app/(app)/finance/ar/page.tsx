import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { FinanceArClient } from '@/components/finance/FinanceArClient';

export const metadata = { title: 'Accounts Receivable — EnsureOS' };

export default async function AccountsReceivablePage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const summary = await api.getFinanceAr().catch((err: unknown) => {
    console.error(
      'frontend:AccountsReceivablePage - getFinanceAr failed:',
      err instanceof Error ? err.message : err,
    );
    return { buckets: [], totalOutstanding: 0, totalOverdue: 0, totalPaid: 0 };
  });

  return <FinanceArClient summary={summary} />;
}
