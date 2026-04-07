'use client';

import { cn } from '@/lib/utils';

export interface EntityPanelProps {
  children: React.ReactNode;
  searchSlot?: React.ReactNode;
  sortSlot?: React.ReactNode;
  filterSlot?: React.ReactNode;
  headerAction?: React.ReactNode;
  paginationSlot?: React.ReactNode;
  className?: string;
}

export function EntityPanel({
  children,
  searchSlot,
  sortSlot,
  filterSlot,
  headerAction,
  paginationSlot,
  className,
}: EntityPanelProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {searchSlot}
          {sortSlot}
          {filterSlot}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
      <div className="flex-1">{children}</div>
      {paginationSlot && (
        <div className="flex justify-center pt-4">{paginationSlot}</div>
      )}
    </div>
  );
}
