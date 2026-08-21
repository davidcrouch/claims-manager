'use client';

import { useState } from 'react';
import {
  Send,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  MessageSquare,
  FileText,
  Activity,
  User,
  Bot,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EntityActivity } from '@/lib/api-client';

function getActionIcon(action: string) {
  switch (action) {
    case 'published':
      return <Send className="h-4 w-4" />;
    case 'publish_failed':
      return <AlertCircle className="h-4 w-4" />;
    case 'status_changed':
      return <RefreshCw className="h-4 w-4" />;
    case 'line_scope_updated':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'approved':
      return <ThumbsUp className="h-4 w-4" />;
    case 'comment_added':
      return <MessageSquare className="h-4 w-4" />;
    case 'document_generated':
      return <FileText className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case 'published':
      return 'text-blue-600 bg-blue-100';
    case 'publish_failed':
      return 'text-red-600 bg-red-100';
    case 'status_changed':
      return 'text-amber-600 bg-amber-100';
    case 'line_scope_updated':
      return 'text-purple-600 bg-purple-100';
    case 'approved':
      return 'text-green-600 bg-green-100';
    default:
      return 'text-slate-600 bg-slate-100';
  }
}

function getActorIcon(actorType: string) {
  switch (actorType) {
    case 'provider':
      return <Shield className="h-3 w-3" />;
    case 'system':
      return <Bot className="h-3 w-3" />;
    default:
      return <User className="h-3 w-3" />;
  }
}

function getActorColor(actorType: string): string {
  switch (actorType) {
    case 'provider':
      return 'text-purple-700 bg-purple-50 border-purple-200';
    case 'system':
      return 'text-slate-600 bg-slate-50 border-slate-200';
    default:
      return 'text-blue-700 bg-blue-50 border-blue-200';
  }
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

interface ActivityFeedProps {
  activities: EntityActivity[];
  loading?: boolean;
  total?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
}

export function ActivityFeed({
  activities,
  loading,
  total,
  page = 1,
  onPageChange,
  emptyMessage = 'No activity yet',
}: ActivityFeedProps) {
  const rows = Array.isArray(activities) ? activities : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading activities…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  // Group by day
  const grouped: { day: string; items: EntityActivity[] }[] = [];
  for (const act of rows) {
    const day = formatDay(
      typeof act.createdAt === 'string'
        ? act.createdAt
        : new Date(act.createdAt as unknown as string).toISOString(),
    );
    const last = grouped[grouped.length - 1];
    if (last?.day === day) {
      last.items.push(act);
    } else {
      grouped.push({ day, items: [act] });
    }
  }

  const hasMore = total != null && total > page * 50;

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.day}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {group.day}
          </p>
          <div className="space-y-2">
            {group.items.map((activity) => (
              <ActivityEntry key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      ))}

      {hasMore && onPageChange && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function ActivityEntry({ activity }: { activity: EntityActivity }) {
  const [expanded, setExpanded] = useState(false);
  const detail =
    activity.detail && typeof activity.detail === 'object' && !Array.isArray(activity.detail)
      ? activity.detail
      : {};
  const hasDetail = Object.keys(detail).length > 0;
  const createdAt =
    typeof activity.createdAt === 'string'
      ? activity.createdAt
      : activity.createdAt
        ? new Date(activity.createdAt as unknown as string).toISOString()
        : new Date().toISOString();

  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border p-3 transition-colors',
        hasDetail && 'cursor-pointer hover:bg-slate-50',
      )}
      onClick={hasDetail ? () => setExpanded(!expanded) : undefined}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', getActionColor(activity.action))}>
        {getActionIcon(activity.action)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', getActorColor(activity.actorType))}>
            {getActorIcon(activity.actorType)}
            {activity.actorName ?? activity.actorType}
          </span>
          <span className="text-xs text-muted-foreground">{relativeTime(createdAt)}</span>
        </div>
        <p className="mt-1 text-sm text-slate-800">{activity.summary}</p>
        {expanded && hasDetail && (
          <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">
            <ActivityDetail detail={detail} action={activity.action} />
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityDetail({ detail, action }: { detail: Record<string, unknown>; action: string }) {
  if (action === 'line_scope_updated' && Array.isArray(detail.changes)) {
    const changes = detail.changes as Array<{ lineType: string; lineName?: string; newStatus?: string }>;
    return (
      <ul className="space-y-0.5">
        {changes.slice(0, 20).map((ch, i) => (
          <li key={i} className="flex items-center gap-2">
            {ch.newStatus?.toLowerCase() === 'accepted' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
            {ch.newStatus?.toLowerCase() === 'rejected' && <XCircle className="h-3 w-3 text-red-600" />}
            {ch.newStatus?.toLowerCase() !== 'accepted' && ch.newStatus?.toLowerCase() !== 'rejected' && <RefreshCw className="h-3 w-3 text-slate-400" />}
            <span className="font-medium">{ch.lineName ?? `${ch.lineType}`}</span>
            <span className="text-muted-foreground">→ {ch.newStatus ?? 'Unknown'}</span>
          </li>
        ))}
        {changes.length > 20 && (
          <li className="text-muted-foreground italic">…and {changes.length - 20} more</li>
        )}
      </ul>
    );
  }

  if (action === 'published' || action === 'publish_failed') {
    const excludedItemNames = Array.isArray(detail.excludedItemNames) ? detail.excludedItemNames as string[] : [];
    const excludedScopeNames = Array.isArray(detail.excludedScopeNames)
      ? (detail.excludedScopeNames as Array<{ name: string; kind: string }>)
      : [];

    return (
      <div className="space-y-2">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          {detail.publishMode != null ? (
            <><dt className="text-muted-foreground">Mode</dt><dd>{String(detail.publishMode)}</dd></>
          ) : null}
          {detail.providerReference != null ? (
            <><dt className="text-muted-foreground">Provider ref</dt><dd className="font-mono">{String(detail.providerReference)}</dd></>
          ) : null}
          {detail.sentGroups != null ? (
            <><dt className="text-muted-foreground">Groups</dt><dd>{String(detail.sentGroups)}</dd></>
          ) : null}
          {detail.sentItems != null ? (
            <><dt className="text-muted-foreground">Items sent</dt><dd>{String(detail.sentItems)}</dd></>
          ) : null}
          {detail.excludedItems != null && Number(detail.excludedItems) > 0 ? (
            <><dt className="text-amber-700">Items excluded</dt><dd className="text-amber-700">{String(detail.excludedItems)}</dd></>
          ) : null}
          {detail.previousStatus != null ? (
            <><dt className="text-muted-foreground">Previous status</dt><dd>{String(detail.previousStatus)}</dd></>
          ) : null}
          {detail.newStatus != null ? (
            <><dt className="text-muted-foreground">New status</dt><dd>{String(detail.newStatus)}</dd></>
          ) : null}
          {detail.error != null ? (
            <><dt className="text-muted-foreground col-span-2">Error</dt><dd className="col-span-2 text-red-600">{String(detail.error)}</dd></>
          ) : null}
        </dl>
        {excludedItemNames.length > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            <p className="font-medium text-amber-800 mb-1">Items not sent (not tagged for provider):</p>
            <ul className="list-disc pl-4 text-amber-700 space-y-0.5">
              {excludedItemNames.map((name, i) => <li key={i}>{String(name)}</li>)}
            </ul>
          </div>
        )}
        {excludedScopeNames.length > 0 && (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <p className="font-medium text-slate-600 mb-1">Scopes stripped (structural — not sent):</p>
            <ul className="list-disc pl-4 text-slate-500 space-y-0.5">
              {excludedScopeNames.map((s, i) => <li key={i}>{String(s.name)} <span className="text-slate-400">({s.kind})</span></li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (action === 'status_changed') {
    return (
      <p>
        <span className="text-muted-foreground">{String(detail.previousStatus ?? '—')}</span>
        {' → '}
        <span className="font-medium">{String(detail.newStatus ?? '—')}</span>
      </p>
    );
  }

  return (
    <pre className="whitespace-pre-wrap wrap-break-word">
      {JSON.stringify(detail, null, 2)}
    </pre>
  );
}
