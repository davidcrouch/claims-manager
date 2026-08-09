'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PipelineRunResponse } from '@/lib/api-client';
import { agentDisplayName } from '@/lib/system-agents';

export type PipelineProgressPhase =
  | 'idle'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'none';

export interface PipelineProgressStep {
  agentId: string;
  label: string;
  status: string;
}

export interface DocumentPipelineProgress {
  phase: PipelineProgressPhase;
  headline: string;
  steps: PipelineProgressStep[];
  error: string | null;
  settled: boolean;
}

const LOG = '[useDocumentPipelineProgress]';

function idsKey(ids: string[]): string {
  return [...ids].sort().join('|');
}

export function useDocumentPipelineProgress(
  documentIds: string[],
  options?: {
    enabled?: boolean;
    pollMs?: number;
    /** Treat “no runs yet” as finished after this wait (no pipeline configured). */
    assumeNoneAfterMs?: number;
    /** Show a “starting…” state before the first run appears. Drawer: true. History: false. */
    showIdle?: boolean;
  },
): DocumentPipelineProgress {
  const enabled = Boolean(options?.enabled) && documentIds.length > 0;
  const pollMs = options?.pollMs ?? 2000;
  const assumeNoneAfterMs = options?.assumeNoneAfterMs ?? 12_000;
  const showIdle = options?.showIdle ?? true;
  const key = idsKey(documentIds);

  const [runs, setRuns] = useState<PipelineRunResponse[]>([]);
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      startedAtRef.current = null;
      setRuns([]);
      setFetched(false);
      setFetchError(null);
      return;
    }

    startedAtRef.current = Date.now();
    setFetched(false);
    let cancelled = false;
    let pollHandle = 0;
    let clockHandle = 0;

    const stop = () => {
      window.clearInterval(pollHandle);
      window.clearInterval(clockHandle);
    };

    const tick = async () => {
      try {
        const batches = await Promise.all(
          documentIds.map(async (id) => {
            const res = await fetch(`/api/pipelines/document/${id}/runs`);
            if (!res.ok) return [] as PipelineRunResponse[];
            return (await res.json()) as PipelineRunResponse[];
          }),
        );
        if (cancelled) return;
        const flat = batches.flat();
        setRuns(flat);
        setFetched(true);
        setFetchError(null);
        setNow(Date.now());
        const waited = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
        const allTerminal =
          flat.length > 0 &&
          flat.every((r) => r.status === 'completed' || r.status === 'failed');
        if (allTerminal || (flat.length === 0 && waited >= assumeNoneAfterMs)) {
          stop();
        }
      } catch (err) {
        if (cancelled) return;
        console.error(`${LOG} poll failed`, err);
        setFetched(true);
        setFetchError(err instanceof Error ? err.message : 'Failed to load processing status');
        setNow(Date.now());
      }
    };

    void tick();
    pollHandle = window.setInterval(() => void tick(), pollMs);
    clockHandle = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      stop();
    };
    // documentIds captured via key; list identity is not stable from callers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, pollMs]);

  return useMemo((): DocumentPipelineProgress => {
    if (!enabled) {
      return { phase: 'none', headline: '', steps: [], error: null, settled: true };
    }

    const active = runs.filter((r) => r.status === 'pending' || r.status === 'running');
    const failed = runs.filter((r) => r.status === 'failed');
    const latest = [...runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

    if (!fetched || runs.length === 0) {
      const waited = startedAtRef.current ? now - startedAtRef.current : 0;
      if (fetched && waited >= assumeNoneAfterMs) {
        return { phase: 'none', headline: '', steps: [], error: null, settled: true };
      }
      if (!showIdle) {
        return {
          phase: 'none',
          headline: '',
          steps: [],
          error: fetchError,
          settled: false,
        };
      }
      return {
        phase: 'idle',
        headline: 'Starting document processing…',
        steps: [],
        error: fetchError,
        settled: false,
      };
    }

    const focus = active[0] ?? failed[0] ?? latest;
    const steps = (focus?.steps ?? [])
      .slice()
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) => ({
        agentId: step.agentId,
        label: agentDisplayName(step.agentId),
        status: step.status,
      }));

    const runningStep = steps.find((s) => s.status === 'running');
    const pendingStep = steps.find((s) => s.status === 'pending');

    if (active.length > 0) {
      return {
        phase: runningStep ? 'running' : 'pending',
        headline: runningStep?.label ?? pendingStep?.label ?? 'Processing document…',
        steps,
        error: null,
        settled: false,
      };
    }

    if (failed.length > 0) {
      return {
        phase: 'failed',
        headline: 'Document processing failed',
        steps,
        error: failed[0]?.error ?? fetchError,
        settled: true,
      };
    }

    return {
      phase: 'completed',
      headline: 'Document processing complete',
      steps,
      error: null,
      settled: true,
    };
  }, [enabled, fetched, runs, fetchError, assumeNoneAfterMs, showIdle, now]);
}
