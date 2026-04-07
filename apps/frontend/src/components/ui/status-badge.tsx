'use client';

import { cn } from '@/lib/utils';

export type StatusBadgeVariant = 'active' | 'inactive' | 'custom';

export interface StatusBadgeProps {
  status: string;
  variant?: StatusBadgeVariant;
  className?: string;
}

export function StatusBadge({ status, variant = 'custom', className }: StatusBadgeProps) {
  const variantStyles: Record<StatusBadgeVariant, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    custom: 'bg-primary/10 text-primary',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {status}
    </span>
  );
}
