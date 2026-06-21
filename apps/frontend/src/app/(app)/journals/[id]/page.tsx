import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { JournalDetailClient } from '@/components/journals/JournalDetailClient';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Journal | EnsureOS' };

  const journal = await api.getJournal(id).catch(() => null);
  const title = journal?.name ?? 'Journal';
  return { title: `${title} | EnsureOS` };
}

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const journal = await api.getJournal(id).catch((err: unknown) => {
    console.error(
      'frontend:JournalDetailPage - getJournal failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  if (!journal) notFound();

  const pagesResult = await api.getJournalPages(id, { limit: 50 }).catch(() => ({
    data: [],
    total: 0,
  }));

  return (
    <>
      <SetPageHeader>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{journal.name}</h1>
        </div>
      </SetPageHeader>
      <JournalDetailClient journal={journal} initialPages={pagesResult} />
    </>
  );
}
