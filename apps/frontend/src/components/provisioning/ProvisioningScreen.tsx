'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';

/** Match auth-server LoginPage / AuthLayout brand tokens. */
const BRAND_950 = '#06122a';
const BRAND_900 = '#0b1d3d';
const BRAND_500 = '#2a58a3';
const BRAND_200 = '#aec2e6';

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

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  kind?: string;
  isDefault: boolean;
}

export function ProvisioningScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ProvisioningStatus | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyTemplates, setCompanyTemplates] = useState<TemplateOption[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<TemplateOption[]>([]);
  const [companyTemplateId, setCompanyTemplateId] = useState('');
  const [projectTemplateId, setProjectTemplateId] = useState('');
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

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

  const loadTemplates = useCallback(async () => {
    const fetchKind = async (kind: 'company' | 'project') => {
      const res = await fetch(`/api/filesystem-templates?kind=${kind}`);
      if (!res.ok) {
        throw new Error(`Failed to load ${kind} filesystem templates (${res.status})`);
      }
      const json = (await res.json()) as { data?: TemplateOption[] };
      return json.data ?? [];
    };

    const attempt = async () => {
      const [company, project] = await Promise.all([
        fetchKind('company'),
        fetchKind('project'),
      ]);
      setCompanyTemplates(company);
      setProjectTemplates(project);
      setCompanyTemplateId(company.find((t) => t.isDefault)?.id ?? company[0]?.id ?? '');
      setProjectTemplateId(project.find((t) => t.isDefault)?.id ?? project[0]?.id ?? '');
    };

    try {
      try {
        await attempt();
      } catch {
        await attempt();
      }
      setTemplatesLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load filesystem templates',
      );
      setTemplatesLoaded(true);
    }
  }, []);

  const startProvisioning = useCallback(
    async (opts?: { companyFilesystemTemplateId?: string; defaultProjectFilesystemTemplateId?: string }) => {
      try {
        setStarted(true);
        setError(null);
        const res = await fetch('/api/provisioning/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyFilesystemTemplateId: opts?.companyFilesystemTemplateId,
            defaultProjectFilesystemTemplateId: opts?.defaultProjectFilesystemTemplateId,
          }),
        });
        if (!res.ok) throw new Error(`Provisioning start failed: ${res.status}`);
        const data = (await res.json()) as ProvisioningStatus;
        setStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start provisioning');
        setStarted(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchStatus().then((data) => {
      if (!data) return;
      if (data.provisioningStatus === 'pending') {
        void loadTemplates();
      } else if (
        data.provisioningStatus === 'provisioning' ||
        data.provisioningStatus === 'failed'
      ) {
        setStarted(true);
      }
    });
  }, [fetchStatus, loadTemplates]);

  useEffect(() => {
    if (!status) return;
    if (status.provisioningStatus === 'complete') {
      const timeout = setTimeout(() => {
        window.location.assign('/dashboard');
      }, 800);
      return () => clearTimeout(timeout);
    }
    if (
      status.provisioningStatus === 'provisioning' ||
      (status.provisioningStatus === 'pending' && started)
    ) {
      const interval = setInterval(fetchStatus, 2500);
      return () => clearInterval(interval);
    }
  }, [status, fetchStatus, started]);

  function getStepIcon(stepStatus: ProvisioningStep['status']) {
    switch (stepStatus) {
      case 'done':
        return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />;
      case 'running':
        return (
          <Loader2
            className="h-5 w-5 shrink-0 animate-spin"
            style={{ color: BRAND_500 }}
          />
        );
      case 'failed':
        return <XCircle className="h-5 w-5 shrink-0 text-red-500" />;
      case 'skipped':
        return <Circle className="h-5 w-5 shrink-0 text-slate-300" />;
      default:
        return <Circle className="h-5 w-5 shrink-0 text-slate-300" />;
    }
  }

  const isComplete = status?.provisioningStatus === 'complete';
  const isFailed = status?.provisioningStatus === 'failed';
  const showTemplatePicker =
    status?.provisioningStatus === 'pending' && !started && templatesLoaded;

  const title = isComplete
    ? 'Ready to go'
    : isFailed
      ? 'Setup encountered an issue'
      : showTemplatePicker
        ? 'Choose your document structure'
        : 'Setting up your workspace';

  const subtitle = isComplete
    ? 'Your workspace is ready. Redirecting…'
    : isFailed
      ? 'Some steps could not complete. You can retry or continue with limited functionality.'
      : showTemplatePicker
        ? 'Pick a company folder template and a default project template used when new jobs are created.'
        : "We're preparing everything for you. This only takes a moment.";

  return (
    <main className="relative flex min-h-screen grow flex-col bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${BRAND_900} 1px, transparent 1px),
            linear-gradient(to bottom, ${BRAND_900} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          opacity: 0.18,
          maskImage:
            'radial-gradient(ellipse 100% 90% at 50% 40%, black 55%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 100% 90% at 50% 40%, black 55%, transparent 100%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div
          className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl md:flex-row md:items-stretch"
          style={{ borderColor: BRAND_200 }}
        >
          <div
            className="relative flex min-h-[200px] w-full flex-1 basis-0 flex-col items-center justify-center overflow-hidden px-5 py-8 sm:px-6 md:min-h-0"
            style={{ backgroundColor: BRAND_950 }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(42,88,163,0.25), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 80%, rgba(42,88,163,0.12), transparent 50%)',
              }}
            />
            <div className="relative z-10 flex w-full max-w-[min(100%,320px)] flex-col items-center justify-center">
              <Image
                src="/ensure_logo_text_dark.png"
                alt="EnsureOS"
                width={640}
                height={400}
                className="h-auto w-full object-contain drop-shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
                priority
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 basis-0 flex-col justify-center px-8 py-10 sm:px-10">
            <div className="mb-8 text-center md:text-left">
              <div className="mb-3 flex items-center justify-center gap-3 md:justify-start">
                <span
                  className="h-px w-8 shrink-0"
                  style={{ backgroundColor: BRAND_500 }}
                />
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: BRAND_500 }}
                >
                  Workspace setup
                </span>
                <span
                  className="h-px w-8 shrink-0"
                  style={{ backgroundColor: BRAND_500 }}
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                {title}
              </h1>
              <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {showTemplatePicker ? (
              <div className="space-y-5">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-800">Company folders</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={companyTemplateId}
                    onChange={(e) => setCompanyTemplateId(e.target.value)}
                  >
                    {companyTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs text-slate-500">
                    Applied now for organisation-wide documents.
                  </span>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-800">
                    Default project folders
                  </span>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={projectTemplateId}
                    onChange={(e) => setProjectTemplateId(e.target.value)}
                  >
                    {projectTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs text-slate-500">
                    Used when creating jobs; each job gets its own copy.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!companyTemplateId || !projectTemplateId}
                  onClick={() =>
                    startProvisioning({
                      companyFilesystemTemplateId: companyTemplateId,
                      defaultProjectFilesystemTemplateId: projectTemplateId,
                    })
                  }
                  className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                  style={{ backgroundColor: BRAND_500 }}
                >
                  Continue setup
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {(status?.steps ?? []).map((step) => (
                  <div key={step.step} className="flex items-start gap-3">
                    {getStepIcon(step.status)}
                    <div className="min-w-0 flex-1">
                      <span
                        className={
                          step.status === 'done'
                            ? 'text-sm text-slate-900'
                            : step.status === 'running'
                              ? 'text-sm font-medium text-slate-900'
                              : step.status === 'failed'
                                ? 'text-sm text-red-600'
                                : 'text-sm text-slate-400'
                        }
                      >
                        {step.label}
                      </span>
                      {step.error && (
                        <p className="mt-0.5 text-xs text-red-600">{step.error}</p>
                      )}
                    </div>
                  </div>
                ))}

                {!status?.steps?.length && !error && (
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <Loader2
                      className="h-5 w-5 animate-spin"
                      style={{ color: BRAND_500 }}
                    />
                    Loading…
                  </div>
                )}
              </div>
            )}

            {isFailed && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    startProvisioning({
                      companyFilesystemTemplateId: companyTemplateId || undefined,
                      defaultProjectFilesystemTemplateId: projectTemplateId || undefined,
                    });
                  }}
                  className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                  style={{ backgroundColor: BRAND_500 }}
                >
                  Retry setup
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline"
                >
                  Skip for now
                </button>
              </div>
            )}

            {isComplete && (
              <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting to dashboard…
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
