'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listMcpToolsAction,
  refreshMcpToolsAction,
} from '@/app/(app)/admin/mcp-servers/actions';
import type { Agent, McpToolGroupResponse } from '@/lib/ai/types';
import { cn } from '@/lib/utils';

interface ToolSelectionPanelProps {
  agent: Agent;
  connectionIds?: string[];
  onChange: (agent: Agent) => void;
  readOnly?: boolean;
}

export function ToolSelectionPanel({
  agent,
  connectionIds,
  onChange,
  readOnly,
}: ToolSelectionPanelProps) {
  const [groups, setGroups] = useState<McpToolGroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [refreshingConnections, setRefreshingConnections] = useState<Set<string>>(new Set());

  const loadTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await listMcpToolsAction();
      const filtered =
        connectionIds && connectionIds.length > 0
          ? fetched.filter((g) => connectionIds.includes(g.connectionId))
          : fetched;
      setGroups(filtered);
      setExpandedGroups(new Set(filtered.map((g) => g.integrationId)));
    } catch {
      setError('Unable to load available tools.');
    } finally {
      setLoading(false);
    }
  }, [connectionIds]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const allTools = useMemo(
    () => groups.flatMap((g) => g.tools.map((t) => t.namespacedId)),
    [groups],
  );

  const totalToolCount = allTools.length;
  const allEnabled = agent.enabledTools === undefined;
  const enabledSet = useMemo(
    () => new Set(agent.enabledTools ?? allTools),
    [agent.enabledTools, allTools],
  );

  const enabledCount = allEnabled ? totalToolCount : (agent.enabledTools?.length ?? 0);

  const toggleTool = useCallback(
    (namespacedId: string) => {
      if (readOnly) return;
      let next: string[];
      if (allEnabled) {
        next = allTools.filter((n) => n !== namespacedId);
      } else {
        const current = new Set(agent.enabledTools ?? []);
        if (current.has(namespacedId)) {
          current.delete(namespacedId);
        } else {
          current.add(namespacedId);
        }
        next = [...current];
      }
      if (next.length === totalToolCount) {
        onChange({ ...agent, enabledTools: undefined });
      } else {
        onChange({ ...agent, enabledTools: next });
      }
    },
    [agent, allEnabled, allTools, onChange, readOnly, totalToolCount],
  );

  const toggleGroup = useCallback(
    (group: McpToolGroupResponse, enabled: boolean) => {
      if (readOnly) return;
      const groupToolIds = new Set(group.tools.map((t) => t.namespacedId));
      const currentEnabled = new Set(agent.enabledTools ?? allTools);

      if (enabled) {
        for (const id of groupToolIds) currentEnabled.add(id);
      } else {
        for (const id of groupToolIds) currentEnabled.delete(id);
      }

      const next = [...currentEnabled];
      if (next.length === totalToolCount) {
        onChange({ ...agent, enabledTools: undefined });
      } else {
        onChange({ ...agent, enabledTools: next });
      }
    },
    [agent, allTools, onChange, readOnly, totalToolCount],
  );

  const toggleAll = useCallback(
    (enabled: boolean) => {
      if (readOnly) return;
      if (enabled) {
        onChange({ ...agent, enabledTools: undefined });
      } else {
        onChange({ ...agent, enabledTools: [] });
      }
    },
    [agent, onChange, readOnly],
  );

  const handleRefresh = useCallback(
    async (connectionId: string) => {
      if (readOnly) return;
      setRefreshingConnections((prev) => new Set([...prev, connectionId]));
      try {
        await refreshMcpToolsAction(connectionId);
        await loadTools();
      } catch {
        // Best effort
      } finally {
        setRefreshingConnections((prev) => {
          const next = new Set(prev);
          next.delete(connectionId);
          return next;
        });
      }
    },
    [loadTools, readOnly],
  );

  const toggleExpanded = useCallback((integrationId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(integrationId)) {
        next.delete(integrationId);
      } else {
        next.add(integrationId);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Loader2 className="mb-3 h-6 w-6 animate-spin" />
        <p className="text-sm">Loading available tools…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
        No tools available. Select connections on the{' '}
        <span className="font-medium text-slate-700">Connections</span> tab, or ensure MCP
        servers are connected.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Tool Access</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {groups.length} integration{groups.length !== 1 ? 's' : ''} · {totalToolCount} tools
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-slate-400">
              {enabledCount} of {totalToolCount} enabled
            </span>
            {!readOnly && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => toggleAll(true)}
                  className="underline hover:text-slate-700"
                >
                  All
                </button>
                <span>/</span>
                <button
                  type="button"
                  onClick={() => toggleAll(false)}
                  className="underline hover:text-slate-700"
                >
                  None
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {groups.map((group) => {
        const expanded = expandedGroups.has(group.integrationId);
        const groupEnabledCount = group.tools.filter((t) => enabledSet.has(t.namespacedId)).length;
        const groupAllEnabled = groupEnabledCount === group.tools.length;
        const isRefreshing = refreshingConnections.has(group.connectionId);

        return (
          <div
            key={`${group.integrationId}-${group.connectionId}`}
            className="rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => toggleExpanded(group.integrationId)}
                className="flex items-center gap-2 text-left"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
                <span className="text-sm font-semibold text-slate-800">{group.integrationName}</span>
              </button>
              {group.stale && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                  Stale
                </span>
              )}
              <div className="flex-1" />
              <span className="text-xs text-slate-400">{group.tools.length} tools</span>
              {!readOnly && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleRefresh(group.connectionId)}
                    disabled={isRefreshing}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                    title="Refresh tools"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group, !groupAllEnabled)}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      groupAllEnabled
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {groupAllEnabled ? 'On' : 'Off'}
                  </button>
                </>
              )}
            </div>

            {expanded && (
              <div className="divide-y divide-slate-50">
                {group.tools.map((tool) => {
                  const enabled = enabledSet.has(tool.namespacedId);
                  const label = tool.originalName
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                  return (
                    <label
                      key={tool.namespacedId}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-slate-50',
                        readOnly && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={readOnly}
                        onChange={() => toggleTool(tool.namespacedId)}
                        className="mt-0.5 rounded border-slate-300"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{label}</p>
                        {tool.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {tool.description}
                          </p>
                        )}
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {tool.namespacedId}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
