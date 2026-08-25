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
 * CW title (external / document number) and record title (internal number)
 * for the shared two-row page header.
 */
export function entityDetailHeaderTitles({
  internalNumber,
  name,
  secondaryLabel,
  fallbackId,
}: Omit<EntityDetailTitleProps, 'nameClassName' | 'numberClassName'>): {
  topTitle?: string;
  title: string;
  titleMono: boolean;
} {
  const rec = internalNumber?.trim();
  const cw = secondaryLabel?.trim() || name?.trim() || undefined;
  if (rec) {
    return {
      topTitle: cw && cw !== rec ? cw : undefined,
      title: rec,
      titleMono: true,
    };
  }
  return { title: cw || fallbackId || '—', titleMono: false };
}

/**
 * Detail page title: CW / external label above the internal record number.
 */
export function EntityDetailTitle({
  internalNumber,
  name,
  secondaryLabel,
  fallbackId,
  nameClassName,
  numberClassName,
}: EntityDetailTitleProps) {
  const { topTitle, title, titleMono } = entityDetailHeaderTitles({
    internalNumber,
    name,
    secondaryLabel,
    fallbackId,
  });

  return (
    <div className="min-w-0">
      {topTitle ? (
        <p
          className={cn(
            'truncate text-xs font-medium uppercase tracking-wide text-muted-foreground',
            nameClassName,
          )}
        >
          {topTitle}
        </p>
      ) : null}
      <h1
        className={cn(
          'truncate text-lg font-semibold leading-tight',
          titleMono && 'font-mono uppercase',
          topTitle ? 'mt-0.5' : undefined,
          numberClassName,
        )}
      >
        {title}
      </h1>
    </div>
  );
}
