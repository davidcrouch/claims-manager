'use client';

import { cn } from '@/lib/utils';

export function entityDetailName(
  name?: string | null,
  secondaryLabel?: string | null,
  fallbackId?: string,
): string {
  return name?.trim() || secondaryLabel?.trim() || fallbackId || '—';
}

export function entityArchiveLabel(
  internalNumber?: string | null,
  name?: string | null,
  secondaryLabel?: string | null,
  fallbackId?: string,
): string {
  return (
    internalNumber?.trim() ||
    name?.trim() ||
    secondaryLabel?.trim() ||
    fallbackId ||
    'this record'
  );
}

type EntityDetailTitleProps = {
  internalNumber?: string | null;
  name?: string | null;
  secondaryLabel?: string | null;
  fallbackId?: string;
  nameClassName?: string;
  numberClassName?: string;
};

/**
 * Detail page title: internal record number above the entity display name.
 */
export function EntityDetailTitle({
  internalNumber,
  name,
  secondaryLabel,
  fallbackId,
  nameClassName,
  numberClassName,
}: EntityDetailTitleProps) {
  const number = internalNumber?.trim();
  const displayName = entityDetailName(name, secondaryLabel, fallbackId);

  return (
    <div className="min-w-0">
      {number ? (
        <p
          className={cn(
            'truncate font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground',
            numberClassName,
          )}
        >
          {number}
        </p>
      ) : null}
      <h1
        className={cn(
          'truncate text-lg font-semibold leading-tight',
          number ? 'mt-0.5' : undefined,
          nameClassName,
        )}
      >
        {displayName}
      </h1>
    </div>
  );
}
