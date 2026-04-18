'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConnectionWebhookEventsTable } from './ConnectionWebhookEventsTable';
import { fetchConnectionAction } from '@/app/(app)/connections/actions';
import { CrunchworkConnectionEditForm } from '@/components/providers/crunchwork/CrunchworkConnectionEditForm';
import type { ConnectionDetail, ProviderConnection } from '@/types/api';

type Tab = 'events' | 'details';

export interface ConnectionDetailContentProps {
  connectionId: string;
}

export function ConnectionDetailContent({
  connectionId,
}: ConnectionDetailContentProps) {
  const router = useRouter();
  const [connection, setConnection] = useState<ConnectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('events');

  const loadConnection = useCallback(async () => {
    setLoading(true);
    const result = await fetchConnectionAction(connectionId);
    setConnection(result);
    setLoading(false);
  }, [connectionId]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  if (loading || !connection) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/connections')}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
              <Unplug className="h-5 w-5 text-violet-600" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-2xl font-semibold text-slate-900">
                {connection.name || connection.providerName}
              </h2>
              <p className="text-xs text-slate-500">
                {connection.providerName} · {connection.environment}
              </p>
            </div>
            <StatusBadge
              status={connection.isActive ? 'Active' : 'Inactive'}
              variant={connection.isActive ? 'active' : 'inactive'}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-0 border-b border-slate-200 bg-white px-8">
        {(['events', 'details'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setEditing(false);
            }}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'events'
              ? `Webhook Events (${connection.totalWebhookEvents})`
              : 'Details'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-white px-12 py-8">
        <div className="max-w-4xl">
          {tab === 'events' && (
            <ConnectionWebhookEventsTable connectionId={connection.id} />
          )}
          {tab === 'details' && (
            <DetailsTab
              connection={connection}
              editing={editing}
              onEdit={() => setEditing(true)}
              onCancelEdit={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                void loadConnection();
                router.refresh();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailsTab({
  connection,
  editing,
  onEdit,
  onCancelEdit,
  onSaved,
}: {
  connection: ConnectionDetail;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
}) {
  if (editing) {
    if (connection.providerCode === 'crunchwork') {
      return (
        <CrunchworkConnectionEditForm
          connection={connectionDetailToProviderConnection(connection)}
          onCancel={onCancelEdit}
          onSaved={onSaved}
        />
      );
    }
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm text-amber-700">
          No edit form registered for provider &quot;{connection.providerCode}&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit Connection
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Field label="Connection Name" value={connection.name} />
        <Field label="Provider" value={connection.providerName} />
        <Field label="Environment" value={connection.environment} />
        <Field label="Active" value={connection.isActive ? 'Yes' : 'No'} />
        <Field label="API Hostname" value={connection.baseUrl} mono />
        <Field
          label="REST API Base URL"
          value={connection.baseApi ?? '—'}
          mono
        />
        <Field label="Auth URL" value={connection.authUrl ?? '—'} mono />
        <Field
          label="Client Identifier"
          value={connection.clientIdentifier ?? '—'}
          mono
        />
        <Field
          label="Vendor Tenant ID"
          value={connection.providerTenantId ?? '—'}
          mono
        />
        <Field
          label="Last Sync"
          value={
            connection.lastSyncAt
              ? new Date(connection.lastSyncAt).toLocaleString()
              : 'Never'
          }
        />
        <Field
          label="Last Event"
          value={
            connection.lastEventAt
              ? new Date(connection.lastEventAt).toLocaleString()
              : 'Never'
          }
        />
        <Field
          label="Errors (total)"
          value={String(connection.recentErrorCount)}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={
          mono
            ? 'font-mono text-xs text-slate-700 truncate'
            : 'text-sm text-slate-700'
        }
      >
        {value}
      </p>
    </div>
  );
}

function connectionDetailToProviderConnection(
  c: ConnectionDetail,
): ProviderConnection {
  return {
    id: c.id,
    tenantId: c.tenantId,
    providerCode: c.providerCode,
    name: c.name,
    environment: c.environment,
    authType: c.authType,
    baseUrl: c.baseUrl,
    baseApi: c.baseApi,
    authUrl: c.authUrl,
    clientIdentifier: c.clientIdentifier,
    providerTenantId: c.providerTenantId,
    credentials: c.credentials,
    webhookSecret: c.webhookSecret,
    config: c.config,
    isActive: c.isActive,
    lastSyncAt: c.lastSyncAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
