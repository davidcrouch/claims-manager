'use client';

import { cn } from '@/lib/utils';

const TYPE_BADGE_PALETTE = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
] as const;

function hashTypeName(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getTypeBadgeClassName(type: string): string {
  const normalized = type.trim().toLowerCase();
  const index = hashTypeName(normalized) % TYPE_BADGE_PALETTE.length;
  return TYPE_BADGE_PALETTE[index];
}

export interface TypeBadgeProps {
  type: string | null | undefined;
  className?: string;
  fallback?: string;
}

export function TypeBadge({ type, className, fallback = '—' }: TypeBadgeProps) {
  const label = type?.trim();
  if (!label) {
    return <span className={className}>{fallback}</span>;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        getTypeBadgeClassName(label),
        className,
      )}
    >
      {label}
    </span>
  );
}
