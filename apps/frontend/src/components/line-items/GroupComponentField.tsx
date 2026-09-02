'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface GroupComponentFieldProps {
  groupId: string;
  component?: string | null;
  disabled?: boolean;
  onSave?: (groupId: string, component: string) => void;
}

export function GroupComponentField({
  groupId,
  component,
  disabled,
  onSave,
}: GroupComponentFieldProps) {
  const [draft, setDraft] = useState(component ?? '');

  useEffect(() => {
    setDraft(component ?? '');
  }, [groupId, component]);

  function commit() {
    if (!onSave || disabled) return;
    const next = draft.trim();
    const prev = (component ?? '').trim();
    if (next === prev) return;
    onSave(groupId, next);
  }

  return (
    <label
      className="ml-3 flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span aria-hidden>Component</span>
      <Input
        type="text"
        disabled={disabled || !onSave}
        value={draft}
        aria-label="Component"
        placeholder="—"
        className="h-8 w-40 border-blue-200 bg-white/80 px-2 text-sm font-normal normal-case tracking-normal text-blue-950 placeholder:text-blue-300 focus-visible:border-blue-400 focus-visible:ring-blue-400/30"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}
