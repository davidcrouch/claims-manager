'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';

interface ProvisioningStep {
  step: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  error?: string;
}

interface ProvisioningStatus {
  provisioningStatus: 'pending' | 'provisioning' | 'complete' | 'failed';
  steps: ProvisioningStep[];
  startedAt: string | null;
  completedAt: string | null;
}

export function ProvisioningScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ProvisioningStatus | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/provisioning/status');
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
      const data = (await res.json()) as ProvisioningStatus;
      setStatus(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status');
      return null;
    }
  }, []);

  const startProvisioning = useCallback(async () => {
    try {
      setStarted(true);
      const res = await fetch('/api/provisioning/start', { method: 'POST' });
      if (!res.ok) throw new Error(`Provisioning start failed: ${res.status}`);
      const data = (await res.json()) as ProvisioningStatus;
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start provisioning');
    }
  }, []);

  useEffect(() => {
    fetchStatus().then((data) => {
      if (data && data.provisioningStatus === 'pending' && !started) {
        startProvisioning();
      }
    });
  }, [fetchStatus, startProvisioning, started]);

  useEffect(() => {
    if (!status) return;
    if (status.provisioningStatus === 'complete') {
      const timeout = setTimeout(() => router.push('/dashboard'), 1200);
      return () => clearTimeout(timeout);
    }
    if (
      status.provisioningStatus === 'provisioning' ||
      status.provisioningStatus === 'pending'
    ) {
      const interval = setInterval(fetchStatus, 2500);
      return () => clearInterval(interval);
    }
  }, [status, router, fetchStatus]);

  function getStepIcon(stepStatus: ProvisioningStep['status']) {
    switch (stepStatus) {
      case 'done':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'skipped':
        return <Circle className="h-5 w-5 text-muted-foreground/40" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/30" />;
    }
  }

  const isComplete = status?.provisioningStatus === 'complete';
  const isFailed = status?.provisioningStatus === 'failed';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isComplete
              ? 'Ready to go'
              : isFailed
                ? 'Setup encountered an issue'
                : 'Setting up your workspace'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isComplete
              ? 'Your workspace is ready. Redirecting...'
              : isFailed
                ? 'Some steps could not complete. You can continue with limited functionality.'
                : "We're preparing everything for you. This only takes a moment."}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            {(status?.steps ?? []).map((step) => (
              <div
                key={step.step}
                className="flex items-center gap-3"
              >
                {getStepIcon(step.status)}
                <span
                  className={
                    step.status === 'done'
                      ? 'text-sm text-foreground'
                      : step.status === 'running'
                        ? 'text-sm text-foreground font-medium'
                        : step.status === 'failed'
                          ? 'text-sm text-destructive'
                          : 'text-sm text-muted-foreground'
                  }
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isFailed && (
          <div className="text-center">
            <button
              onClick={() => {
                setError(null);
                startProvisioning();
              }}
              className="text-sm font-medium text-primary hover:underline"
            >
              Retry setup
            </button>
            <span className="mx-2 text-muted-foreground">or</span>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm font-medium text-muted-foreground hover:underline"
            >
              Skip for now
            </button>
          </div>
        )}

        {isComplete && (
          <div className="flex justify-center">
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
