'use client';

import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DetailSaveTone } from '@/components/shared/detail-autosave';

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
      {statusLabel && (
        <span
          className={`mr-2 text-sm ${
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
      )}
      <Button
        size="default"
        variant="outline"
        onClick={onUndo}
        disabled={undoDisabled || !canUndo}
        className="h-9 gap-1.5 px-4"
        title="Undo last edits"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </Button>
    </>
  );
}
