'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  Workflow,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type {
  PipelineRunResponse,
  PipelineRunStepResponse,
} from '@/lib/api-client';

interface PipelineRunHistoryDrawerProps {
  documentId: string;
  documentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Completed' },
  running: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Running' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Pending' },
  skipped: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50', label: 'Skipped' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bg, cfg.color)}>
      <Icon className={cn('h-3 w-3', status === 'running' && 'animate-spin')} />
      {cfg.label}
    </span>
  );
}

export function PipelineRunHistoryDrawer({
  documentId,
  documentName,
  open,
  onOpenChange,
}: PipelineRunHistoryDrawerProps) {
  const [runs, setRuns] = useState<PipelineRunResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pipelines/document/${documentId}/runs`);
      const data: PipelineRunResponse[] = res.ok ? await res.json() : [];
      setRuns(data);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (open && documentId) refresh();
  }, [open, documentId, refresh]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0">
        <SheetHeader data-slot="drawer-header" className="border-b border-sidebar-border p-4 pr-12">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-sidebar-foreground/70" />
            <SheetTitle className="text-sidebar-foreground">Pipeline History</SheetTitle>
          </div>
          {documentName && (
            <SheetDescription className="text-sidebar-foreground/65">
              {documentName}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex items-center justify-end px-6 pt-4">
          <Button type="button" size="sm" variant="outline" onClick={refresh} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && runs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Workflow className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">No pipeline runs yet for this document.</p>
              <p className="max-w-[16rem] text-xs text-slate-400">
                Pipelines run automatically once configured for this filesystem or category.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RunCard({ run }: { run: PipelineRunResponse }) {
  const duration =
    run.startedAt && run.completedAt
      ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
      : null;

  const steps = run.steps ?? [];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={run.status} />
            {duration !== null && (
              <span className="text-[10px] text-slate-400">{duration}s</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {run.createdAt ? new Date(run.createdAt).toLocaleString() : ''}
          </p>
        </div>
      </div>

      {run.error && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2">
          <p className="text-xs text-red-700">{run.error}</p>
        </div>
      )}

      {steps.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/30 px-4 py-3">
          <div className="space-y-2">
            {steps
              .slice()
              .sort((a, b) => a.stepOrder - b.stepOrder)
              .map((step) => (
                <RunStepRow key={step.id} step={step} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RunStepRow({ step }: { step: PipelineRunStepResponse }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-100 bg-white px-3 py-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
        {step.stepOrder + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-700">{step.agentId}</span>
          <StatusBadge status={step.status} />
          {step.durationMs !== null && (
            <span className="text-[10px] text-slate-400">
              {step.durationMs < 1000 ? `${step.durationMs}ms` : `${(step.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}
        </div>
        {step.error && (
          <p className="mt-1 text-[11px] text-red-600">{step.error}</p>
        )}
      </div>
    </div>
  );
}
