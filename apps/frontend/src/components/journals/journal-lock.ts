import { isArchivedStatus } from '@/components/shared/archive-list';

/** Journals cannot be edited when archived, deleted, or explicitly locked. */
export function isJournalLocked(status?: string | null): boolean {
  const value = (status ?? '').trim().toLowerCase();
  if (!value) return false;
  if (value === 'locked' || value === 'deleted') return true;
  return isArchivedStatus(value);
}
