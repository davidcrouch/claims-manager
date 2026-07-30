import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { JournalsPageClient } from '@/components/journals/JournalsPageClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Journals | EnsureOS',
};

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const result = await api.getJournals({
    page: parseInt(params.page ?? '1', 10),
    limit: 20,
    status: params.status,
  }).catch((err: unknown) => {
    console.error(
      'frontend:JournalsPage - getJournals failed:',
      err instanceof Error ? err.message : err,
    );
    return { data: [], total: 0 };
  });

  return <JournalsPageClient initialData={result} />;
}
