'use client';

import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DetailSaveTone } from '@/components/shared/detail-autosave';

export function DetailSaveStatus({
  statusLabel,
  tone,
}: {
  statusLabel: string | null;
  tone: DetailSaveTone;
}) {
  if (!statusLabel) return null;
  return (
    <span
      className={`text-sm ${
        tone === 'error'
          ? 'text-red-600'
          : tone === 'busy'
            ? 'text-slate-500'
            : 'text-emerald-600'
      }`}
      aria-live="polite"
    >
      {statusLabel}
    </span>
  );
}

export function DetailUndoButton({
  canUndo,
  undoDisabled,
  onUndo,
}: {
  canUndo: boolean;
  undoDisabled?: boolean;
  onUndo: () => void;
}) {
  return (
    <Button
      size="icon-lg"
      variant="outline"
      onClick={onUndo}
      disabled={undoDisabled || !canUndo}
      title="Undo last edits"
      aria-label="Undo last edits"
    >
      <Undo2 className="h-4 w-4" />
    </Button>
  );
}

export function DetailAutosaveActions({
  statusLabel,
  tone,
  canUndo,
  undoDisabled,
  onUndo,
}: {
  statusLabel: string | null;
  tone: DetailSaveTone;
  canUndo: boolean;
  undoDisabled?: boolean;
  onUndo: () => void;
}) {
  return (
    <>
      <DetailSaveStatus statusLabel={statusLabel} tone={tone} />
      <DetailUndoButton
        canUndo={canUndo}
        undoDisabled={undoDisabled}
        onUndo={onUndo}
      />
    </>
  );
}
