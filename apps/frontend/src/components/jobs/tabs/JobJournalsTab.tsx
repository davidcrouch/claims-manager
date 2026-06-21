'use client';

import { JournalList } from '@/components/journals/JournalList';
import { useApiClient } from '@/hooks/useApiClient';

export function JobJournalsTab({ jobId }: { jobId: string }) {
  const api = useApiClient();
  return <JournalList parentType="job" parentId={jobId} api={api} />;
}
