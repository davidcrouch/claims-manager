'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Cable, Check, Loader2, Plug2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listMcpConnectionsAction,
  listMcpIntegrationsAction,
} from '@/app/(app)/admin/mcp-servers/actions';
import type { Agent } from '@/lib/ai/types';
import type { McpConnection, McpIntegration } from '@/types/api';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  connected: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  reauth_required: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  expired: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  revoked: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  error: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};

interface ConnectionSelectionStepProps {
  agent: Agent;
  onChange: (updated: Agent) => void;
  readOnly?: boolean;
}

export function ConnectionSelectionStep({ agent, onChange, readOnly }: ConnectionSelectionStepProps) {
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [integrations, setIntegrations] = useState<McpIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selectedIds = new Set(agent.connectionIds ?? []);

  const loadData = useCallback(() => {
    startTransition(async () => {
      setLoadError(null);
      try {
        const [conns, integs] = await Promise.all([
          listMcpConnectionsAction(),
          listMcpIntegrationsAction(),
        ]);
        setConnections(conns);
        setIntegrations(integs);
      } catch (err) {
        setConnections([]);
        setIntegrations([]);
        setLoadError(err instanceof Error ? err.message : 'Failed to load connections');
      } finally {
        setLoading(false);
      }
    });
  }, [startTransition]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getIntegrationName = (integrationId: string) => {
    return integrations.find((i) => i.id === integrationId)?.name ?? 'Unknown';
  };

  const toggleConnection = (connectionId: string) => {
    if (readOnly) return;
    const current = new Set(agent.connectionIds ?? []);
    if (current.has(connectionId)) {
      current.delete(connectionId);
    } else {
      current.add(connectionId);
    }
    onChange({ ...agent, connectionIds: [...current] });
  };

  const selectAll = () => {
    if (readOnly) return;
    onChange({ ...agent, connectionIds: connections.map((c) => c.id) });
  };

  const selectNone = () => {
    if (readOnly) return;
    onChange({ ...agent, connectionIds: [] });
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
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
        <p>Could not load MCP connections.</p>
        <p className="text-xs text-red-600/80">{loadError}</p>
        <Button type="button" variant="secondary" onClick={() => { setLoading(true); loadData(); }}>
          Retry
        </Button>
      </div>
    );
  }

  const activeConnections = connections.filter((c) => c.enabled);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Select which MCP server connections this agent can use.
        </p>
        {activeConnections.length > 0 && !readOnly && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <button type="button" onClick={selectAll} className="underline hover:text-slate-700">
              All
            </button>
            <span>/</span>
            <button type="button" onClick={selectNone} className="underline hover:text-slate-700">
              None
            </button>
          </div>
        )}
      </div>

      {activeConnections.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-10 text-center">
          <Cable className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No connections available</p>
          <p className="mt-1 text-xs text-slate-400">
            Create a connection to an MCP server to give this agent access to external tools.
          </p>
          <Link
            href="/mcp-connections"
            className="mt-4 inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Manage Connections
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {activeConnections.map((conn) => {
            const isSelected = selectedIds.has(conn.id);
            return (
              <button
                key={conn.id}
                type="button"
                disabled={readOnly}
                onClick={() => toggleConnection(conn.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <div
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                    isSelected
                      ? 'border-emerald-600 bg-emerald-600'
                      : 'border-slate-300 bg-white',
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100">
                  <Plug2 className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {getIntegrationName(conn.integrationId)}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">
                    {conn.authType.replace(/_/g, ' ')} auth
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                    STATUS_STYLES[conn.status] ?? STATUS_STYLES.error,
                  )}
                >
                  {conn.status.replace(/_/g, ' ')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
