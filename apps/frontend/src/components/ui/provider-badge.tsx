'use client';

import { cn } from '@/lib/utils';
import { resolveJobKindCaps } from '@/lib/job-kind-registry';

export function jobProviderLabel(provider?: string | null): string {
  return resolveJobKindCaps({ provider }).providerLabel;
}

export function isCrunchworkProvider(provider?: string | null): boolean {
  return (provider ?? '').trim().toLowerCase() === 'crunchwork';
}

export interface ProviderBadgeProps {
  provider?: string | null;
  className?: string;
}

export function ProviderBadge({ provider, className }: ProviderBadgeProps) {
  const label = jobProviderLabel(provider);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        isCrunchworkProvider(provider)
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        className,
      )}
    >
      {label}
    </span>
  );
}
