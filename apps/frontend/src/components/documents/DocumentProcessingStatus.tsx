'use client';

import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentPipelineProgress, PipelineProgressStep } from '@/hooks/useDocumentPipelineProgress';

export type ProcessingRowState = 'done' | 'active' | 'pending' | 'failed';

export interface ProcessingRow {
  id: string;
  label: string;
  state: ProcessingRowState;
  hint?: string;
}

export function rowStateFromStep(step: PipelineProgressStep): ProcessingRowState {
  if (step.status === 'completed') return 'done';
  if (step.status === 'failed') return 'failed';
  if (step.status === 'running') return 'active';
  return 'pending';
}

function RowIcon({ state }: { state: ProcessingRowState }) {
  if (state === 'done') return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />;
  if (state === 'failed') return <XCircle className="size-3.5 shrink-0 text-destructive" />;
  if (state === 'active') {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-blue-600" />;
  }
  return <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />;
}

export function ProcessingStepsList({
  rows,
  className,
}: {
  rows: ProcessingRow[];
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <ol className={cn('space-y-1.5', className)}>
      {rows.map((row) => (
        <li key={row.id} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5">
            <RowIcon state={row.state} />
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 leading-snug',
              row.state === 'pending' && 'text-muted-foreground',
              row.state === 'active' && 'font-medium text-foreground',
              row.state === 'done' && 'text-muted-foreground',
              row.state === 'failed' && 'text-destructive',
            )}
          >
            {row.label}
            {row.hint ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{row.hint}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DocumentProcessingStatus({
  progress,
  title = 'Processing',
  className,
}: {
  progress: DocumentPipelineProgress;
  title?: string;
  className?: string;
}) {
  if (progress.phase === 'none') return null;
  if (progress.phase === 'completed' && progress.steps.length === 0) return null;

  const rows: ProcessingRow[] =
    progress.steps.length > 0
      ? progress.steps.map((step) => ({
          id: step.agentId,
          label: step.label,
          state: rowStateFromStep(step),
        }))
      : progress.headline
        ? [{ id: 'headline', label: progress.headline, state: 'active' }]
        : [];

  return (
    <div
      className={cn(
        'rounded-lg border bg-muted/30 px-3 py-2.5',
        progress.phase === 'failed' && 'border-destructive/30 bg-destructive/5',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ProcessingStepsList rows={rows} />
      {progress.error ? (
        <p className="mt-2 text-xs text-destructive">{progress.error}</p>
      ) : null}
    </div>
  );
}
