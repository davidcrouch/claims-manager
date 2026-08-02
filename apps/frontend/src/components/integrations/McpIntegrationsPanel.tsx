'use client';

import { useEffect, useState, useTransition } from 'react';
import { Globe, Loader2, Lock, Pencil, Plus, Server, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { McpIntegration } from '@/types/api';
import {
  deleteMcpIntegrationAction,
  listMcpIntegrationsAction,
} from '@/app/(app)/admin/mcp-servers/actions';
import { AddIntegrationDrawer } from './AddIntegrationDrawer';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  draft: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  const Icon = visibility === 'private' ? Lock : visibility === 'org' ? Users : Globe;
  return (
    <span className="inline-flex items-center gap-1 text-slate-600">
      <Icon className="h-3.5 w-3.5" />
      <span className="capitalize">{visibility}</span>
    </span>
  );
}

export function McpIntegrationsPanel() {
  const [integrations, setIntegrations] = useState<McpIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<McpIntegration | null>(null);
  const [, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      setLoadError(null);
      try {
        const rows = await listMcpIntegrationsAction();
        setIntegrations(rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[frontend:McpIntegrationsPanel.loadData]', msg);
        setLoadError(msg);
        setIntegrations([]);
      } finally {
        setLoading(false);
      }
    });
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const handleEdit = (row: McpIntegration) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const handleDelete = async (row: McpIntegration) => {
    if (!window.confirm(`Delete "${row.name}"? Connections using this server will stop working.`)) {
      return;
    }
    const result = await deleteMcpIntegrationAction(row.id);
    if (result.success) {
      setIntegrations((current) => current.filter((r) => r.id !== row.id));
    } else {
      alert(result.error ?? 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-white px-5 py-12 text-center">
        <Server className="mx-auto h-10 w-10 text-red-300" />
        <p className="mt-3 text-sm font-medium text-slate-700">Failed to load MCP servers</p>
        <p className="mt-1 text-xs text-slate-500">{loadError}</p>
        <Button type="button" size="sm" onClick={loadData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" size="sm" onClick={handleAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add MCP Server
        </Button>
      </div>

      {integrations.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-12 text-center">
          <Server className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No MCP servers registered</p>
          <p className="mt-1 text-xs text-slate-400">
            Add an MCP server to make its tools available for connections and agents.
          </p>
          <Button type="button" size="sm" onClick={handleAdd} className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" />
            Add MCP Server
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 font-medium text-slate-600">URL</th>
                <th className="px-4 py-3 font-medium text-slate-600">Visibility</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">Created</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {integrations.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-slate-50/50"
                  onClick={() => handleEdit(row)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                        <Server className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-slate-900">{row.name}</span>
                        {row.description && (
                          <p className="truncate text-xs text-slate-400">{row.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[14rem] px-4 py-3">
                    <span className="truncate font-mono text-xs text-slate-500">{row.url}</span>
                  </td>
                  <td className="px-4 py-3">
                    <VisibilityBadge visibility={row.visibility} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                        STATUS_STYLES[row.status] ?? 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(row);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-primary"
                        title="Edit integration"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(row);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-500"
                        title="Delete integration"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddIntegrationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCreated={loadData}
        editing={editing}
      />
    </>
  );
}
