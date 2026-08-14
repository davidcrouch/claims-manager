'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Cable,
  Loader2,
  Plug2,
  Plus,
  RefreshCw,
  Unplug,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { cn } from '@/lib/utils';
import type { McpConnection, McpIntegration } from '@/types/api';
import type { McpToolGroupResponse } from '@/lib/ai/types';
import {
  createMcpConnectionAction,
  disconnectMcpConnectionAction,
  initiateMcpOAuthAction,
  listMcpConnectionsAction,
  listMcpIntegrationsAction,
  listMcpToolsAction,
  refreshMcpToolsAction,
  testMcpConnectionAction,
} from '@/app/(app)/admin/mcp-servers/actions';

const STATUS_STYLES: Record<string, string> = {
  connected: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  reauth_required: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  error: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export function McpConnectionsPanel() {
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [integrations, setIntegrations] = useState<McpIntegration[]>([]);
  const [tools, setTools] = useState<McpToolGroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [authType, setAuthType] = useState('none');
  const [apiKey, setApiKey] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const integrationById = useMemo(
    () => new Map(integrations.map((i) => [i.id, i])),
    [integrations],
  );

  const toolsByConnection = useMemo(
    () => new Map(tools.map((t) => [t.connectionId, t])),
    [tools],
  );

  const loadData = useCallback(() => {
    startTransition(async () => {
      try {
        const [connRows, intRows, toolRows] = await Promise.all([
          listMcpConnectionsAction(),
          listMcpIntegrationsAction(),
          listMcpToolsAction(),
        ]);
        setConnections(connRows);
        setIntegrations(intRows);
        setTools(toolRows);
      } catch (err) {
        console.error('[frontend:McpConnectionsPanel.loadData]', err);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedIntegration = integrations.find((i) => i.id === selectedIntegrationId);

  async function handleConnect() {
    if (!selectedIntegrationId) return;
    setSubmitError(null);
    setActionLoading('connect');
    try {
      if (authType === 'oauth') {
        const redirectUri = `${window.location.origin}/mcp-connections`;
        const { authorizeUrl } = await initiateMcpOAuthAction({
          integrationId: selectedIntegrationId,
          redirectUri,
        });
        window.open(authorizeUrl, '_blank', 'noopener,noreferrer,width=600,height=700');
      } else {
        await createMcpConnectionAction({
          integrationId: selectedIntegrationId,
          authType,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        });
      }
      setConnectOpen(false);
      setApiKey('');
      loadData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Connect failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTest(id: string) {
    setActionLoading(`test:${id}`);
    try {
      await testMcpConnectionAction(id);
      loadData();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefreshTools(id: string) {
    setActionLoading(`refresh:${id}`);
    try {
      await refreshMcpToolsAction(id);
      loadData();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDisconnect(id: string) {
    if (!window.confirm('Disconnect this MCP connection?')) return;
    setActionLoading(`disconnect:${id}`);
    try {
      await disconnectMcpConnectionAction(id);
      if (detailId === id) setDetailId(null);
      loadData();
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => {
    function onOAuthMessage(event: MessageEvent) {
      if (event.data?.type === 'mcp-oauth-callback' && event.data.success) {
        loadData();
      }
    }
    window.addEventListener('message', onOAuthMessage);
    return () => window.removeEventListener('message', onOAuthMessage);
  }, [loadData]);

  const detailConnection = connections.find((c) => c.id === detailId);
  const detailTools = detailId ? toolsByConnection.get(detailId) : null;

  return (
    <>
      <SetHeaderActions>
        <Button
          type="button"
          size="default"
          onClick={() => setConnectOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Connect Server
        </Button>
      </SetHeaderActions>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-12 text-center">
          <Cable className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No MCP connections yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Connect to a registered MCP server to expose its tools to agents.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Integration</th>
                <th className="px-4 py-3 font-medium text-slate-600">Auth</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">Last tested</th>
                <th className="px-4 py-3 font-medium text-slate-600">Tools</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {connections.map((conn) => {
                const integration = integrationById.get(conn.integrationId);
                const toolGroup = toolsByConnection.get(conn.id);
                return (
                  <tr
                    key={conn.id}
                    className="cursor-pointer hover:bg-slate-50/50"
                    onClick={() => setDetailId(conn.id)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {integration?.name ?? conn.integrationId}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{conn.authType}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                          STATUS_STYLES[conn.status] ?? 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
                        )}
                      >
                        {conn.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(conn.lastTestedAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{toolGroup?.tools.length ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={actionLoading === `test:${conn.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleTest(conn.id);
                          }}
                          title="Test connection"
                        >
                          <RefreshCw className={cn('h-4 w-4', actionLoading === `test:${conn.id}` && 'animate-spin')} />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={actionLoading === `disconnect:${conn.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDisconnect(conn.id);
                          }}
                          title="Disconnect"
                        >
                          <Unplug className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BottomFormDrawer
        open={!!detailConnection}
        onOpenChange={(open) => !open && setDetailId(null)}
        title={integrationById.get(detailConnection?.integrationId ?? '')?.name ?? 'Connection'}
        description="Connection details and discovered tools."
        icon={<Wrench className="h-5 w-5" />}
        widthClassName="w-[60%]"
      >
        {detailConnection && (
          <>
            <BottomFormDrawerBody>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium capitalize">{detailConnection.status.replace(/_/g, ' ')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Auth type</dt>
                  <dd className="font-medium capitalize">{detailConnection.authType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Last tested</dt>
                  <dd>{formatDateTime(detailConnection.lastTestedAt)}</dd>
                </div>
                {detailConnection.lastError && (
                  <div>
                    <dt className="text-slate-500">Last error</dt>
                    <dd className="mt-1 rounded bg-red-50 p-2 text-xs text-red-700">{detailConnection.lastError}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-6">
                <h4 className="mb-2 text-sm font-semibold text-slate-800">
                  Tools ({detailTools?.tools.length ?? 0})
                </h4>
                {detailTools?.tools.length ? (
                  <ul className="max-h-64 space-y-2 overflow-auto rounded border border-slate-200 p-3">
                    {detailTools.tools.map((tool) => (
                      <li key={tool.namespacedId} className="text-xs">
                        <p className="font-medium text-slate-800">{tool.originalName}</p>
                        <p className="text-slate-500">{tool.description}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">No tools cached yet.</p>
                )}
              </div>
            </BottomFormDrawerBody>
            <BottomFormDrawerFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={actionLoading === `refresh:${detailConnection.id}`}
                onClick={() => void handleRefreshTools(detailConnection.id)}
              >
                Refresh tools
              </Button>
              <Button type="button" variant="destructive" onClick={() => void handleDisconnect(detailConnection.id)}>
                Disconnect
              </Button>
            </BottomFormDrawerFooter>
          </>
        )}
      </BottomFormDrawer>

      <BottomFormDrawer
        open={connectOpen}
        onOpenChange={setConnectOpen}
        title="Connect MCP Server"
        description="Create a connection to an existing MCP integration."
        icon={<Plug2 className="h-5 w-5" />}
        widthClassName="w-[50%]"
      >
        <BottomFormDrawerBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="integration-select">Integration</Label>
              <select
                id="integration-select"
                value={selectedIntegrationId}
                onChange={(e) => {
                  setSelectedIntegrationId(e.target.value);
                  const integration = integrations.find((i) => i.id === e.target.value);
                  const types = integration?.supportedAuthTypes ?? ['none'];
                  setAuthType(types[0] ?? 'none');
                }}
                className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Select integration…</option>
                {integrations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedIntegration && (
              <div>
                <Label>Auth type</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedIntegration.supportedAuthTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAuthType(type)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm capitalize',
                        authType === type
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 text-slate-600',
                      )}
                    >
                      {type.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {authType === 'api_key' && (
              <div>
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key"
                />
              </div>
            )}

            {submitError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </p>
            )}
          </div>
        </BottomFormDrawerBody>
        <BottomFormDrawerFooter>
          <Button type="button" variant="secondary" onClick={() => setConnectOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedIntegrationId || actionLoading === 'connect'}
            onClick={() => void handleConnect()}
          >
            {authType === 'oauth' ? 'Authorize with OAuth' : 'Connect'}
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
    </>
  );
}
