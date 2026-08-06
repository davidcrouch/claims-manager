'use client';

/**
 * Column visibility preferences for entity list tables.
 * Persists per-table toggles in localStorage and renders a settings
 * control in the table header.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface ColumnVisibilityDef {
  key: string;
  label: string;
  /** When true, the column cannot be hidden. Defaults to false. */
  locked?: boolean;
}

const STORAGE_PREFIX = 'ensureos:table-columns:';

function readStoredVisibility(
  storageKey: string,
  columns: ColumnVisibilityDef[],
): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const col of columns) {
    defaults[col.key] = true;
  }
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...defaults };
    for (const col of columns) {
      if (col.locked) {
        next[col.key] = true;
        continue;
      }
      if (typeof parsed[col.key] === 'boolean') {
        next[col.key] = parsed[col.key] as boolean;
      }
    }
    // Never allow all columns hidden.
    if (!Object.values(next).some(Boolean)) return defaults;
    return next;
  } catch {
    return defaults;
  }
}

function writeStoredVisibility(
  storageKey: string,
  visibility: Record<string, boolean>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + storageKey,
      JSON.stringify(visibility),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function useColumnVisibility(
  storageKey: string,
  columns: ColumnVisibilityDef[],
) {
  const columnSignature = columns.map((c) => `${c.key}:${c.locked ? 1 : 0}`).join(',');

  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const col of columns) defaults[col.key] = true;
    return defaults;
  });

  useEffect(() => {
    setVisibility(readStoredVisibility(storageKey, columns));
    // Only re-hydrate when the table identity / column set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- columns captured via signature
  }, [storageKey, columnSignature]);

  const isVisible = useCallback(
    (key: string) => visibility[key] !== false,
    [visibility],
  );

  const toggle = useCallback(
    (key: string, next?: boolean) => {
      setVisibility((prev) => {
        const col = columns.find((c) => c.key === key);
        if (col?.locked) return prev;
        const enabled = next ?? !prev[key];
        const updated = { ...prev, [key]: enabled };
        // Keep at least one column visible.
        if (!Object.values(updated).some(Boolean)) return prev;
        writeStoredVisibility(storageKey, updated);
        return updated;
      });
    },
    [columns, storageKey],
  );

  const visibleColumns = useMemo(
    () => columns.filter((col) => visibility[col.key] !== false),
    [columns, visibility],
  );

  const visibleCount = visibleColumns.length;

  return {
    visibility,
    isVisible,
    toggle,
    visibleColumns,
    visibleCount,
  };
}

export function ColumnSettingsMenu(props: {
  columns: ColumnVisibilityDef[];
  isVisible: (key: string) => boolean;
  onToggle: (key: string, next: boolean) => void;
  className?: string;
}) {
  const { columns, isVisible, onToggle, className } = props;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400/40',
          className,
        )}
        aria-label="Column settings"
      >
        <Settings className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 p-1" sideOffset={6}>
        <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          Columns
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[320px] overflow-y-auto py-0.5">
          {columns.map((col) => {
            const checked = isVisible(col.key);
            return (
              <div
                key={col.key}
                role="menuitemcheckbox"
                aria-checked={checked}
                aria-disabled={col.locked || undefined}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50',
                  col.locked && 'cursor-default opacity-70',
                )}
                onClick={() => {
                  if (!col.locked) onToggle(col.key, !checked);
                }}
              >
                <span className={cn(!checked && !col.locked && 'text-slate-400')}>
                  {col.label}
                </span>
                <Switch
                  checked={checked}
                  disabled={col.locked}
                  onCheckedChange={(next) => onToggle(col.key, next)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Trailing header cell with the column-settings gear. */
export function ColumnSettingsHeaderCell(props: {
  columns: ColumnVisibilityDef[];
  isVisible: (key: string) => boolean;
  onToggle: (key: string, next: boolean) => void;
}) {
  return (
    <th scope="col" className="w-8 px-1 py-3 text-right">
      <div className="flex justify-end">
        <ColumnSettingsMenu {...props} />
      </div>
    </th>
  );
}
