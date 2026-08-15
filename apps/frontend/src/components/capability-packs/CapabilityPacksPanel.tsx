'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Package, RefreshCw, Upload } from 'lucide-react';
import type {
  CapabilityPackCatalogEntry,
  CapabilityPackDriftItem,
  CapabilityPackPreview,
} from '@/lib/api-client';
import {
  getCapabilityPackDriftAction,
  installCapabilityPackAction,
  listCapabilityPacksAction,
  previewCapabilityPackAction,
  uninstallCapabilityPackAction,
  upgradeCapabilityPackAction,
  uploadCapabilityPackAction,
} from '@/app/(app)/admin/capability-packs/actions';
import { CapabilityPackDetailDrawer } from '@/components/capability-packs/CapabilityPackDetailDrawer';
import { Button } from '@/components/ui/button';

export function CapabilityPacksPanel() {
  const [packs, setPacks] = useState<CapabilityPackCatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drift, setDrift] = useState<CapabilityPackDriftItem[] | null>(null);
  const [driftPack, setDriftPack] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<CapabilityPackPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const next = await listCapabilityPacksAction();
      setPacks(next);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function runInstall(pack: CapabilityPackCatalogEntry) {
    startTransition(async () => {
      setError(null);
      const result = await installCapabilityPackAction(
        pack.source === 'upload' && pack.uploadId
          ? { uploadId: pack.uploadId }
          : { packId: pack.packId, version: pack.version },
      );
      if (!result.success) setError(result.error ?? 'Install failed');
      reload();
    });
  }

  function runUpgrade(installId: string) {
    startTransition(async () => {
      setError(null);
      const result = await upgradeCapabilityPackAction(installId);
      if (!result.success) setError(result.error ?? 'Upgrade failed');
      reload();
    });
  }

  function runUninstall(installId: string, force = false) {
    startTransition(async () => {
      setError(null);
      const result = await uninstallCapabilityPackAction(installId, force);
      if (!result.success) setError(result.error ?? 'Uninstall failed');
      setDrift(null);
      reload();
    });
  }

  function runDrift(installId: string, packName: string) {
    startTransition(async () => {
      setError(null);
      const result = await getCapabilityPackDriftAction(installId);
      if (!result.success) {
        setError(result.error ?? 'Drift check failed');
        return;
      }
      setDriftPack(packName);
      setDrift(result.drift ?? []);
    });
  }

  function runPreview(pack: CapabilityPackCatalogEntry) {
    setPreviewOpen(true);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    startTransition(async () => {
      const result = await previewCapabilityPackAction(
        pack.source === 'upload' && pack.uploadId
          ? { uploadId: pack.uploadId }
          : { packId: pack.packId, version: pack.version },
      );
      setPreviewLoading(false);
      if (!result.success) {
        setPreviewError(result.error ?? 'Preview failed');
        return;
      }
      setPreview(result.preview ?? null);
    });
  }

  function onUpload(file: File | null) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    startTransition(async () => {
      setError(null);
      const result = await uploadCapabilityPackAction(form);
      if (!result.success) setError(result.error ?? 'Upload failed');
      reload();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Install workflow packs of agents, skills, and MCP tool selections.
        </p>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Upload className="h-4 w-4" />
            Upload pack
            <input
              type="file"
              accept=".zip,.json,application/json,application/zip"
              className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={reload} disabled={pending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Pack</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Contents</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((pack) => {
              const installed = pack.installed;
              return (
                <tr key={`${pack.source}-${pack.packId}-${pack.uploadId ?? ''}`} className="border-t">
                  <td className="px-3 py-3 align-top">
                    <button
                      type="button"
                      className="flex items-start gap-2 text-left hover:opacity-80"
                      onClick={() => runPreview(pack)}
                    >
                      <Package className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium underline-offset-2 hover:underline">
                          {pack.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {pack.packId} @ {pack.version}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{pack.description}</div>
                        {pack.integrationRefs.length ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            MCP: {pack.integrationRefs.join(', ')}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-3 align-top capitalize">{pack.source}</td>
                  <td className="px-3 py-3 align-top text-xs text-muted-foreground">
                    {pack.agentCount} agents · {pack.skillCount} skills · {pack.promptCount} prompts
                  </td>
                  <td className="px-3 py-3 align-top">
                    {installed ? (
                      <span className="text-xs">
                        {installed.status} ({installed.version})
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not installed</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => runPreview(pack)}
                      >
                        Details
                      </Button>
                      {!installed ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => runInstall(pack)}
                        >
                          Install
                        </Button>
                      ) : (
                        <>
                          {installed.version !== pack.version ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => runUpgrade(installed.installId)}
                            >
                              Upgrade
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => runDrift(installed.installId, pack.name)}
                          >
                            Drift
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => runUninstall(installed.installId, false)}
                          >
                            Uninstall
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => runUninstall(installed.installId, true)}
                          >
                            Force
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!packs.length && !pending ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No capability packs found. Ensure `apps/api/packs` is present.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {drift && driftPack ? (
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Drift — {driftPack}</h2>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDrift(null)}>
              Close
            </Button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">Type</th>
                <th className="py-1">Key</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {drift.map((item, idx) => (
                <tr key={`${item.sourceKey}-${idx}`} className="border-t">
                  <td className="py-1">{item.artefactType}</td>
                  <td className="py-1">{item.sourceKey ?? item.artefactId}</td>
                  <td className="py-1">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <CapabilityPackDetailDrawer
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        loading={previewLoading}
        error={previewError}
      />
    </div>
  );
}
