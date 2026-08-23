'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { GroupDimensions } from './lib/types';

function dimToInput(value?: number): string {
  return value === undefined || value === null || Number.isNaN(value) ? '' : String(value);
}

function parseDimInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

interface GroupDimensionFieldsProps {
  groupId: string;
  length?: number;
  width?: number;
  height?: number;
  perimeter?: number;
  disabled?: boolean;
  onSave?: (groupId: string, dimensions: GroupDimensions) => void;
}

export function GroupDimensionFields({
  groupId,
  length,
  width,
  height,
  perimeter,
  disabled,
  onSave,
}: GroupDimensionFieldsProps) {
  const [draft, setDraft] = useState({
    length: dimToInput(length),
    width: dimToInput(width),
    height: dimToInput(height),
    perimeter: dimToInput(perimeter),
  });

  useEffect(() => {
    setDraft({
      length: dimToInput(length),
      width: dimToInput(width),
      height: dimToInput(height),
      perimeter: dimToInput(perimeter),
    });
  }, [groupId, length, width, height, perimeter]);

  function commit() {
    if (!onSave || disabled) return;
    const next: GroupDimensions = {};
    const parsedLength = parseDimInput(draft.length);
    const parsedWidth = parseDimInput(draft.width);
    const parsedHeight = parseDimInput(draft.height);
    const parsedPerimeter = parseDimInput(draft.perimeter);
    if (parsedLength !== undefined) next.length = parsedLength;
    if (parsedWidth !== undefined) next.width = parsedWidth;
    if (parsedHeight !== undefined) next.height = parsedHeight;
    if (parsedPerimeter !== undefined) next.perimeter = parsedPerimeter;

    const same =
      dimToInput(length) === dimToInput(next.length) &&
      dimToInput(width) === dimToInput(next.width) &&
      dimToInput(height) === dimToInput(next.height) &&
      dimToInput(perimeter) === dimToInput(next.perimeter);
    if (same) return;
    onSave(groupId, next);
  }

  const fields: Array<{ key: 'length' | 'width' | 'height' | 'perimeter'; label: string; short: string }> = [
    { key: 'length', label: 'Length', short: 'L' },
    { key: 'width', label: 'Width', short: 'W' },
    { key: 'height', label: 'Height', short: 'H' },
    { key: 'perimeter', label: 'Perimeter', short: 'P' },
  ];

  return (
    <div
      className="ml-8 flex shrink-0 items-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {fields.map(({ key, label, short }) => (
        <label
          key={key}
          title={label}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700"
        >
          <span aria-hidden>{short}</span>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            disabled={disabled || !onSave}
            value={draft[key]}
            aria-label={label}
            placeholder="—"
            className="h-8 w-24 border-blue-200 bg-white/80 px-2 text-sm tabular-nums text-blue-950 placeholder:text-blue-300 focus-visible:border-blue-400 focus-visible:ring-blue-400/30"
            onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </label>
      ))}
    </div>
  );
}
