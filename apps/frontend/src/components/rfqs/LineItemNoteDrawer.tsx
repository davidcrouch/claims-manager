'use client';

import { useEffect, useState } from 'react';
import { Loader2, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';

export type LineNoteTargetType = 'group' | 'combo' | 'item';

export interface LineNoteTarget {
  targetType: LineNoteTargetType;
  targetId: string;
  label: string;
  note?: string | null;
}

interface LineItemNoteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: LineNoteTarget | null;
  onSave: (note: string | null) => Promise<{ success: boolean; error?: string }>;
}

export function LineItemNoteDrawer({
  open,
  onOpenChange,
  target,
  onSave,
}: LineItemNoteDrawerProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && target) {
      setDraft(target.note ?? '');
      setError(null);
      setBusy(false);
    }
  }, [open, target]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = draft.trim();
      const result = await onSave(trimmed.length > 0 ? draft : null);
      if (!result.success) {
        setError(result.error ?? 'Failed to save note');
        return;
      }
      onOpenChange(false);
    } catch (err) {
      console.error(
        'frontend:LineItemNoteDrawer.handleSubmit - save failed:',
        err instanceof Error ? err.message : err,
      );
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setBusy(false);
    }
  }

  const title = target ? `Notes — ${target.label}` : 'Notes';

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Add a long note for this line item. Hover the row later to preview it."
      icon={<StickyNote className="h-5 w-5" />}
      preventClose={busy}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <BottomFormDrawerBody>
          <div className="space-y-2">
            <Label htmlFor="line-item-note">Note</Label>
            <Textarea
              id="line-item-note"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Enter notes…"
              rows={14}
              className="min-h-[16rem] resize-y"
              disabled={busy || !target}
            />
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>
        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !target}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save note'
            )}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
