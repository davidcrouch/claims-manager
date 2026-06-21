'use client';

import { useCallback } from 'react';
import { JournalList } from '@/components/journals/JournalList';
import {
  fetchJournalsByEntityAction,
  fetchJournalsListAction,
  createJournalAction,
  linkJournalAction,
  unlinkJournalAction,
} from '@/app/(app)/journals/actions';

export function JobJournalsTab({ jobId }: { jobId: string }) {
  const entityType = 'Job';

  const fetchJournals = useCallback(
    () => fetchJournalsByEntityAction(entityType, jobId),
    [jobId],
  );

  const fetchAllJournals = useCallback(
    () => fetchJournalsListAction(),
    [],
  );

  const createJournal = useCallback(
    (data: { name: string; description?: string }) => createJournalAction(data),
    [],
  );

  const linkJournal = useCallback(
    (journalId: string) => linkJournalAction(journalId, entityType, jobId),
    [jobId],
  );

  const unlinkJournal = useCallback(
    (journalId: string) => unlinkJournalAction(journalId, entityType, jobId),
    [jobId],
  );

  return (
    <JournalList
      entityType={entityType}
      entityId={jobId}
      fetchJournals={fetchJournals}
      fetchAllJournals={fetchAllJournals}
      createJournal={createJournal}
      linkJournal={linkJournal}
      unlinkJournal={unlinkJournal}
    />
  );
}
