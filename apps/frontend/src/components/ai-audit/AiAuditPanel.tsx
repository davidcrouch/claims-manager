'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { AiAuditRecord } from '@/lib/ai/types';
import { getAiAuditLogAction } from '@/app/(app)/admin/ai-audit/actions';

interface AuditFilters {
  userId?: string;
  model?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AiAuditPanel() {
  const [rows, setRows] = useState<AiAuditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({
    page: 1,
    limit: 25,
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAiAuditLogAction({
        ...filters,
      });
      setRows(result.rows ?? []);
      setTotal(result.total ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const safeRows = rows ?? [];
  const successCount = safeRows.filter((r) => r.status === 'success').length;
  const successRate =
    safeRows.length > 0 ? Math.round((successCount / safeRows.length) * 100) : 0;
  const avgDuration =
    safeRows.length > 0
      ? Math.round(
          safeRows.reduce((sum, r) => sum + (r.requestDurationMs ?? 0), 0) /
            safeRows.length,
        )
      : 0;
  const totalToolCalls = safeRows.reduce(
    (sum, r) => sum + (r.toolsInvoked?.length ?? 0),
    0,
  );
  const totalPages = Math.ceil(total / filters.limit);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Audit Log</h1>
          <p className="text-sm text-slate-500">
            Monitor AI model usage, token consumption, and tool calls
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Activity className="h-5 w-5 text-blue-600" />}
          label="Total Records"
          value={String(total)}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          label="Success Rate"
          value={`${successRate}%`}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Avg Duration"
          value={formatDuration(avgDuration)}
        />
        <SummaryCard
          icon={<Wrench className="h-5 w-5 text-violet-600" />}
          label="Tool Calls"
          value={String(totalToolCalls)}
        />
      </div>

      {/* Filters Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
        </button>
        {(filters.status || filters.model || filters.dateFrom) && (
          <button
            onClick={() => setFilters({ page: 1, limit: 25 })}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              value={filters.status ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value || undefined, page: 1 })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Model
            </label>
            <input
              type="text"
              placeholder="e.g. gemini-2.5-flash"
              value={filters.model ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, model: e.target.value || undefined, page: 1 })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              From
            </label>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, dateFrom: e.target.value || undefined, page: 1 })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              To
            </label>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, dateTo: e.target.value || undefined, page: 1 })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Time</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Agent</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Model</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Tokens</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Tools</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Duration</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && safeRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : safeRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No audit records found
                  </td>
                </tr>
              ) : (
                safeRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.agentName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">
                        {row.model}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                      {row.totalTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {row.toolsInvoked?.length ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatDuration(row.requestDurationMs)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          <XCircle className="h-3 w-3" /> {row.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Page {filters.page} of {totalPages} ({total} records)
            </p>
            <div className="flex gap-2">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={filters.page >= totalPages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="rounded-lg bg-slate-50 p-2">{icon}</div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
