export const AUTOSAVE_DEBOUNCE_MS = 600;
export const MAX_UNDO = 20;
export const SAVE_STATUS_CLEAR_MS = 2000;

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function pushUndoEntry<T>(prev: T[], entry: T, max = MAX_UNDO): T[] {
  const next = [...prev, entry];
  return next.length > max ? next.slice(next.length - max) : next;
}

export type DetailSaveTone = 'error' | 'busy' | 'success';

export function detailSaveStatus(opts: {
  saving?: boolean;
  publishing?: boolean;
  saveError?: string | null;
  justSaved?: boolean;
  justPublished?: boolean;
  dirty?: boolean;
}): { label: string | null; tone: DetailSaveTone } {
  if (opts.publishing) return { label: 'Publishing…', tone: 'busy' };
  if (opts.saving) return { label: 'Saving…', tone: 'busy' };
  if (opts.saveError) return { label: 'Save failed', tone: 'error' };
  if (opts.justPublished) return { label: 'Published', tone: 'success' };
  if (opts.justSaved) return { label: 'Saved', tone: 'success' };
  if (opts.dirty) return { label: 'Unsaved changes', tone: 'busy' };
  return { label: null, tone: 'busy' };
}
