import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { JournalDetailClient } from '@/components/journals/JournalDetailClient';
import { JournalPageHeader } from '@/components/journals/JournalHeader';
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

  const jobLink = journal.entityLinks?.find((l) => l.entityType.toLowerCase() === 'job');
  const jobId = jobLink?.entityId ?? journal.jobId ?? null;
  const job = jobId ? await api.getJob(jobId).catch(() => null) : null;

  const pagesResult = await api.getJournalPages(id, { limit: 50 }).catch(() => ({
    data: [],
    total: 0,
  }));

  return (
    <>
      <SetPageHeader>
        <JournalPageHeader journal={journal} job={job} entryCount={pagesResult.total} />
      </SetPageHeader>
      <JournalDetailClient journal={journal} initialPages={pagesResult} job={job} />
    </>
  );
}
