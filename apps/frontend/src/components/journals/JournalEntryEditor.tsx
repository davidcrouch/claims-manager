'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EditText, EditTextarea } from '@/components/jobs/JobEditControls';
import {
  AUTOSAVE_DEBOUNCE_MS,
  SAVE_STATUS_CLEAR_MS,
  cloneJson,
} from '@/components/shared/detail-autosave';
import { HeaderSaveStatus } from '@/components/shared/HeaderSaveStatus';
import type { ApiClient } from '@/lib/api-client';
import type { JournalPage } from '@/types/api';
import {
  blocksWithNotesText,
  pageEntryDescription,
  pageEntryName,
  pageEntryNotesText,
} from './page-blocks';

type EntryDraft = {
  name: string;
  description: string;
  notes: string;
};

function draftFromPage(page: JournalPage): EntryDraft {
  return {
    name: pageEntryName(page),
    description: pageEntryDescription(page),
    notes: pageEntryNotesText(page),
  };
}

function draftsEqual(a: EntryDraft, b: EntryDraft): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.notes === b.notes
  );
}

export interface JournalEntryEditorProps {
  journalId: string;
  page: JournalPage;
  api: ApiClient;
  onPageUpdated: (page: JournalPage) => void;
  locked?: boolean;
}

export function JournalEntryEditor({
  journalId,
  page,
  api,
  onPageUpdated,
  locked = false,
}: JournalEntryEditorProps) {
  const [draft, setDraft] = useState<EntryDraft>(() => draftFromPage(page));
  const [savedBaseline, setSavedBaseline] = useState<EntryDraft>(() => draftFromPage(page));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const saveInFlightRef = useRef(false);
  const baselineRef = useRef(savedBaseline);
  baselineRef.current = savedBaseline;
  const pageRef = useRef(page);
  pageRef.current = page;

  const dirty = !draftsEqual(draft, savedBaseline);

  useEffect(() => {
    setDraft(draftFromPage(page));
    setSavedBaseline(draftFromPage(page));
    setSaveError(null);
    setJustSaved(false);
  }, [page.id]);

  useEffect(() => {
    if (dirty) return;
    const next = draftFromPage(page);
    setDraft(next);
    setSavedBaseline(next);
  }, [page, dirty]);

  const updateField = useCallback(
    <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => {
      if (locked) return;
      setDraft((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    },
    [locked],
  );

  const persistDraft = useCallback(
    async (nextDraft: EntryDraft) => {
      if (locked || saveInFlightRef.current) return;
      if (draftsEqual(nextDraft, baselineRef.current)) return;

      const currentPage = pageRef.current;
      saveInFlightRef.current = true;
      setSaving(true);
      setJustSaved(false);
      setSaveError(null);

      try {
        const snapshot = cloneJson(nextDraft);
        const blocks = blocksWithNotesText(currentPage, snapshot.notes);
        const description = snapshot.description.trim();
        const updated = await api.updateJournalPage(journalId, currentPage.id, {
          name: snapshot.name,
          body: snapshot.notes.trim(),
          blocks,
          metadata: {
            description,
          },
        });

        const meta = { ...(updated.metadata ?? {}) };
        if (description) meta.description = description;
        else delete meta.description;
        meta.blocks = blocks;
        if (snapshot.name.trim()) meta.name = snapshot.name.trim();
        else delete meta.name;

        const nextPage: JournalPage = {
          ...updated,
          body: snapshot.notes.trim() || null,
          metadata: meta,
          attachments: updated.attachments ?? currentPage.attachments,
        };

        const synced = draftFromPage(nextPage);
        setDraft(synced);
        setSavedBaseline(synced);
        onPageUpdated(nextPage);
        setJustSaved(true);
      } catch (err) {
        console.error('[journals/JournalEntryEditor.persistDraft] failed', err);
        setSaveError(err instanceof Error ? err.message : 'Failed to save entry');
      } finally {
        saveInFlightRef.current = false;
        setSaving(false);
      }
    },
    [api, journalId, onPageUpdated, locked],
  );

  useEffect(() => {
    if (locked || !dirty || saving) return;
    const timer = window.setTimeout(() => {
      void persistDraft(draft);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [locked, dirty, saving, draft, persistDraft]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), SAVE_STATUS_CLEAR_MS);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  return (
    <div className="space-y-3 border-b px-4 py-3">
      {!locked && (
        <HeaderSaveStatus
          saving={saving}
          saveError={saveError}
          justSaved={justSaved}
          dirty={dirty}
        />
      )}
      {saveError && !locked && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Name
          </label>
          {locked ? (
            <p className="text-sm font-medium">{draft.name || '—'}</p>
          ) : (
            <EditText
              value={draft.name}
              onChange={(value) => updateField('name', value)}
              disabled={saving}
              className="h-9 text-sm font-medium"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </label>
          {locked ? (
            <p className="whitespace-pre-wrap text-sm">{draft.description || '—'}</p>
          ) : (
            <EditTextarea
              value={draft.description}
              onChange={(value) => updateField('description', value)}
              disabled={saving}
              rows={2}
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </label>
          {locked ? (
            <p className="whitespace-pre-wrap text-sm">{draft.notes || '—'}</p>
          ) : (
            <EditTextarea
              value={draft.notes}
              onChange={(value) => updateField('notes', value)}
              disabled={saving}
              rows={5}
            />
          )}
        </div>
      </div>
    </div>
  );
}
