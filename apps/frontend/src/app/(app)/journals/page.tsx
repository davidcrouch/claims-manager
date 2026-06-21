import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { JournalsPageClient } from '@/components/journals/JournalsPageClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Journals | EnsureOS',
};

export default async function JournalsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const result = await api.getJournals({ page: 1, limit: 50 }).catch((err: unknown) => {
    console.error(
      'frontend:JournalsPage - getJournals failed:',
      err instanceof Error ? err.message : err,
    );
    return { data: [], total: 0 };
  });

  return (
    <>
      <SetPageHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Journals</h1>
        </div>
      </SetPageHeader>
      <JournalsPageClient initialData={result} />
    </>
  );
}
