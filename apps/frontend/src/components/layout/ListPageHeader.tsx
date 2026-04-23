'use client';

import { Search, Filter } from 'lucide-react';
import type { ComponentType, ReactNode, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type ListPageAccent =
  | 'blue'
  | 'emerald'
  | 'violet'
  | 'amber'
  | 'orange'
  | 'teal'
  | 'indigo'
  | 'rose'
  | 'slate';

// Static Tailwind class maps (keep literals so JIT picks them up).
const ACCENT_CLASSES: Record<
  ListPageAccent,
  { iconBg: string; iconText: string; badgeBg: string; badgeText: string }
> = {
  blue: {
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
  },
  emerald: {
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
  },
  violet: {
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
  },
  amber: {
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  orange: {
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
  },
  teal: {
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-600',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-700',
  },
  indigo: {
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-600',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
  },
  rose: {
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-600',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
  },
  slate: {
    iconBg: 'bg-muted',
    iconText: 'text-muted-foreground',
    badgeBg: 'bg-muted',
    badgeText: 'text-muted-foreground',
  },
};

export interface ListStat {
  label: string;
  value: ReactNode;
}

export interface ListBreakdownItem {
  name: string;
  count: number;
}

export interface ListPageHeaderProps {
  /** Icon component for the page (e.g. lucide icon). */
  icon: IconComponent;
  /** Title shown next to the icon (e.g. "Claims"). */
  title: string;
  /** Total items matching the current filter. */
  total: number;
  /** Optional number of rows currently rendered after client-side filtering. */
  showing?: number;
  /** Active search query (if any). */
  search?: string;
  /** Active status filter: count of selected options. */
  statusSelectedCount?: number;
  /** Noun used to render the status filter count chip, e.g. "link state". */
  statusFilterNoun?: { singular: string; plural: string };
  /** Additional headline stats (label/value pairs). */
  stats?: ListStat[];
  /** Optional per-status (or other) breakdown chips. */
  breakdown?: ListBreakdownItem[];
  /**
   * Accent color applied to the icon badge and the "total" pill so each
   * domain (claims, jobs, invoices, ...) is visually distinguishable. Defaults
   * to a neutral slate tone.
   */
  accent?: ListPageAccent;
}

/**
 * Reusable compact header for list / summary pages. Designed to sit inside
 * the top title bar via `SetPageHeader`. Shows icon + title, total count,
 * active filters, and any custom stats/breakdowns provided by the caller.
 */
export function ListPageHeader({
  icon: Icon,
  title,
  total,
  showing,
  search,
  statusSelectedCount,
  statusFilterNoun = { singular: 'status', plural: 'statuses' },
  stats,
  breakdown,
  accent = 'slate',
}: ListPageHeaderProps) {
  const trimmedSearch = search?.trim();
  const hasStatusFilter =
    typeof statusSelectedCount === 'number' && statusSelectedCount > 0;
  const showShowing = typeof showing === 'number' && showing !== total;
  const accentCls = ACCENT_CLASSES[accent];

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${accentCls.iconBg}`}
        >
          <Icon className={`h-4 w-4 ${accentCls.iconText}`} />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">
          {title}
        </h1>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${accentCls.badgeBg} ${accentCls.badgeText}`}
        >
          {total.toLocaleString()} total
        </span>
        {showShowing && (
          <span className="text-xs text-muted-foreground">
            Showing {showing!.toLocaleString()}
          </span>
        )}
        {trimmedSearch && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Search className="h-3 w-3" />
            &ldquo;{trimmedSearch}&rdquo;
          </span>
        )}
        {hasStatusFilter && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />
            {statusSelectedCount}{' '}
            {statusSelectedCount === 1
              ? statusFilterNoun.singular
              : statusFilterNoun.plural}
          </span>
        )}
        {breakdown && breakdown.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            {breakdown.map((item) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {item.name}
                <span className="font-medium text-foreground">
                  {item.count}
                </span>
              </span>
            ))}
          </span>
        )}
      </div>
      {stats && stats.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1">
              <span className="text-muted-foreground">{s.label}:</span>
              <span className="font-medium">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compute a list of `{ name, count }` tuples grouping items by status name
 * (sorted descending by count, capped to `limit`). Useful to feed the
 * `breakdown` prop of `ListPageHeader`.
 */
export function computeStatusBreakdown<T>(
  items: T[],
  getStatusName: (item: T) => string | null | undefined,
  limit = 4,
): ListBreakdownItem[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = getStatusName(item)?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
