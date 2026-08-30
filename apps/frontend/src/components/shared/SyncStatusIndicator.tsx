'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type SyncStatus = 'pending' | 'synced' | 'failed' | null | undefined;

interface SyncStatusIndicatorProps {
  syncStatus: SyncStatus;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
  lastError?: string | null;
}

export function SyncStatusIndicator({
  syncStatus,
  onRetry,
  compact = false,
  className,
  lastError,
}: SyncStatusIndicatorProps) {
  if (!syncStatus) return null;

  if (compact) {
    return <CompactIndicator syncStatus={syncStatus} className={className} />;
  }

  return (
    <FullIndicator
      syncStatus={syncStatus}
      onRetry={onRetry}
      className={className}
      lastError={lastError}
    />
  );
}

function CompactIndicator({
  syncStatus,
  className,
}: {
  syncStatus: NonNullable<SyncStatus>;
  className?: string;
}) {
  switch (syncStatus) {
    case 'pending':
      return (
        <Tooltip>
          <TooltipTrigger className="inline-flex shrink-0">
            <Loader2
              className={cn('h-3.5 w-3.5 animate-spin text-muted-foreground', className)}
            />
          </TooltipTrigger>
          <TooltipContent>Syncing with provider…</TooltipContent>
        </Tooltip>
      );
    case 'synced':
      return (
        <Tooltip>
          <TooltipTrigger className="inline-flex shrink-0">
            <Check
              className={cn('h-3.5 w-3.5 text-muted-foreground/60', className)}
            />
          </TooltipTrigger>
          <TooltipContent>Synced</TooltipContent>
        </Tooltip>
      );
    case 'failed':
      return (
        <Tooltip>
          <TooltipTrigger className="inline-flex shrink-0">
            <AlertTriangle
              className={cn('h-3.5 w-3.5 text-destructive', className)}
            />
          </TooltipTrigger>
          <TooltipContent>Sync failed — open record to retry</TooltipContent>
        </Tooltip>
      );
    default:
      return null;
  }
}

function FullIndicator({
  syncStatus,
  onRetry,
  className,
  lastError,
}: {
  syncStatus: NonNullable<SyncStatus>;
  onRetry?: () => void;
  className?: string;
  lastError?: string | null;
}) {
  switch (syncStatus) {
    case 'pending':
      return (
        <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Syncing with provider…</span>
        </div>
      );
    case 'synced':
      return (
        <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
          <Check className="h-4 w-4" />
          <span>Synced</span>
        </div>
      );
    case 'failed':
      return (
        <div className={cn('space-y-1.5', className)}>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>Sync failed</span>
          </div>
          {lastError && (
            <p className="text-xs text-muted-foreground pl-6">{lastError}</p>
          )}
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-6"
            >
              Retry sync
            </Button>
          )}
        </div>
      );
    default:
      return null;
  }
}
