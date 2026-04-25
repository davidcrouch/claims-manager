'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Unplug,
  Loader2,
  Globe,
  KeyRound,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { BackButton } from '@/components/layout/BackButton';
import {
  DefRow,
  SectionCard,
  BoolPill,
  formatDateTime,
} from '@/components/shared/detail';
import { ConnectionWebhookEventsTable } from './ConnectionWebhookEventsTable';
import { ConnectionEditDrawer } from './ConnectionEditDrawer';
import { fetchConnectionAction } from '@/app/(app)/connections/actions';
import type { ConnectionDetail, ProviderConnection } from '@/types/api';

function ConnectionPageHeader({
  connection,
}: {
  connection: ConnectionDetail;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
      <BackButton href="/connections" label="Back to connections" />
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
        <Unplug className="h-4 w-4 text-violet-600" />
      </span>
      <h1 className="truncate text-lg font-semibold leading-tight">
        {connection.name || connection.providerName}
      </h1>
      <span className="text-xs text-muted-foreground">
        {connection.providerName} · {connection.environment}
      </span>
      <StatusBadge
        status={connection.isActive ? 'Active' : 'Inactive'}
        variant={connection.isActive ? 'active' : 'inactive'}
      />
    </div>
  );
}

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
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
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
      <SetPageHeader>
        <ConnectionPageHeader connection={connection} />
      </SetPageHeader>

      <div className="flex gap-0 border-b border-slate-200 bg-white px-8">
        {(['events', 'details'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
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

      <div className="flex-1 overflow-y-auto bg-white">
        {tab === 'events' && (
          <div className="px-6 pb-6 pt-4">
            <ConnectionWebhookEventsTable connectionId={connection.id} />
          </div>
        )}
        {tab === 'details' && (
          <div className="px-8 py-6">
            <DetailsTab
              connection={connection}
              onEdit={() => setEditDrawerOpen(true)}
            />
          </div>
        )}
      </div>

      <ConnectionEditDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        connection={connectionDetailToProviderConnection(connection)}
        onSaved={() => {
          setEditDrawerOpen(false);
          void loadConnection();
          router.refresh();
        }}
      />
    </div>
  );
}

function DetailsTab({
  connection,
  onEdit,
}: {
  connection: ConnectionDetail;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={onEdit}>
          Edit Connection
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium">
              {connection.isActive ? 'Active' : 'Inactive'}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Environment</p>
            <p className="mt-1 text-sm font-medium capitalize">
              {connection.environment}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Last Sync</p>
            <p className="mt-1 text-sm font-medium">
              {connection.lastSyncAt
                ? formatDateTime(connection.lastSyncAt)
                : 'Never'}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Errors (total)</p>
            <p className="mt-1 text-sm font-medium">
              {connection.recentErrorCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Connection"
          icon={<Unplug className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Connection name" value={connection.name || '—'} />
          <DefRow label="Provider" value={connection.providerName} />
          <DefRow
            label="Environment"
            value={
              <span className="capitalize">{connection.environment}</span>
            }
          />
          <DefRow label="Auth type" value={connection.authType ?? '—'} />
          <DefRow label="Active" value={<BoolPill value={connection.isActive} />} />
        </SectionCard>

        <SectionCard
          title="API Endpoints"
          icon={<Globe className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="API hostname" value={<Mono value={connection.baseUrl} />} />
          <DefRow
            label="REST API base URL"
            value={<Mono value={connection.baseApi} />}
          />
          <DefRow
            label="Auth token URL"
            value={<Mono value={connection.authUrl} />}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Identifiers"
          icon={<KeyRound className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Client identifier"
            value={<Mono value={connection.clientIdentifier} />}
          />
          <DefRow
            label="Vendor tenant ID"
            value={<Mono value={connection.providerTenantId} />}
          />
        </SectionCard>

        <SectionCard
          title="Activity"
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Last sync"
            value={
              connection.lastSyncAt
                ? formatDateTime(connection.lastSyncAt)
                : 'Never'
            }
          />
          <DefRow
            label="Last event"
            value={
              connection.lastEventAt
                ? formatDateTime(connection.lastEventAt)
                : 'Never'
            }
          />
          <DefRow
            label="Errors (total)"
            value={
              connection.recentErrorCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {connection.recentErrorCount}
                </span>
              ) : (
                '0'
              )
            }
          />
        </SectionCard>
      </div>
    </div>
  );
}

function Mono({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="font-mono text-xs break-all text-foreground">
      {value}
    </span>
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
