'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug, X, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WebhookEventsTable } from './WebhookEventsTable';
import {
  fetchProviderAction,
  updateProviderAction,
  createConnectionAction,
  updateConnectionAction,
} from '@/app/(app)/providers/actions';
import type { Provider, ProviderConnection } from '@/types/api';

type Tab = 'details' | 'connections' | 'events';

export interface ProviderEditDrawerProps {
  providerId: string | null;
  onClose: () => void;
}

export function ProviderEditDrawer({
  providerId,
  onClose,
}: ProviderEditDrawerProps) {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('details');

  const open = providerId !== null;

  const loadProvider = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    const result = await fetchProviderAction(providerId);
    setProvider(result);
    setLoading(false);
  }, [providerId]);

  useEffect(() => {
    if (providerId) {
      setTab('details');
      void loadProvider();
    } else {
      setProvider(null);
    }
  }, [providerId, loadProvider]);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto w-[65%]! h-[90vh]! flex flex-col overflow-hidden rounded-t-xl border-x border-t p-0 data-starting-style:translate-y-full! data-ending-style:translate-y-full! transition-transform! duration-300! ease-out!"
      >
        {loading || !provider ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="border-b border-slate-100 bg-slate-50/50 px-12 py-6">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                    <Unplug className="h-5 w-5 text-violet-600" />
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {provider.name}
                  </h2>
                  <StatusBadge
                    status={provider.isActive ? 'Active' : 'Inactive'}
                    variant={provider.isActive ? 'active' : 'inactive'}
                  />
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-slate-500">
                Manage provider settings, connections, and monitor webhook events.
              </p>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-0 border-b border-slate-200 bg-white px-12">
              {(['details', 'connections', 'events'] as const).map((t) => (
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
                  {t === 'details'
                    ? 'Details'
                    : t === 'connections'
                      ? `Connections (${provider.connections.length})`
                      : 'Webhook Events'}
                </button>
              ))}
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto bg-white px-16 py-8">
              <div>
                {tab === 'details' && (
                  <DetailsTab
                    provider={provider}
                    onSaved={() => {
                      void loadProvider();
                      router.refresh();
                    }}
                  />
                )}
                {tab === 'connections' && (
                  <ConnectionsTab
                    provider={provider}
                    onSaved={() => {
                      void loadProvider();
                      router.refresh();
                    }}
                  />
                )}
                {tab === 'events' && (
                  <WebhookEventsTable providerId={provider.id} />
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Details Tab                                                  */
/* ─────────────────────────────────────────────────────────── */

function DetailsTab({
  provider,
  onSaved,
}: {
  provider: Provider;
  onSaved: () => void;
}) {
  const [name, setName] = useState(provider.name);
  const [isActive, setIsActive] = useState(provider.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(provider.name);
    setIsActive(provider.isActive);
  }, [provider]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateProviderAction(provider.id, { name, isActive });
    if (result.success) {
      onSaved();
    } else {
      setError(result.error ?? 'Failed to save');
    }
    setSaving(false);
  }

  const dirty = name !== provider.name || isActive !== provider.isActive;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <div className="space-y-1.5">
          <Label>Provider Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Code</Label>
          <Input value={provider.code} disabled className="font-mono text-sm" />
          <p className="text-xs text-slate-400">
            Unique identifier. Cannot be changed after creation.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="isActive"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <Label htmlFor="isActive" className="cursor-pointer">
          Active
        </Label>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Connections Tab                                              */
/* ─────────────────────────────────────────────────────────── */

function ConnectionsTab({
  provider,
  onSaved,
}: {
  provider: Provider;
  onSaved: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-4">
      {provider.connections.length === 0 && !showAdd && (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <p className="text-sm text-slate-400">No connections configured.</p>
        </div>
      )}

      {provider.connections.map((conn) => (
        <ConnectionCard
          key={conn.id}
          providerId={provider.id}
          connection={conn}
          onSaved={onSaved}
        />
      ))}

      {showAdd ? (
        <AddConnectionForm
          providerId={provider.id}
          onCancel={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            onSaved();
          }}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
        >
          + Add Connection
        </Button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Connection Card                                              */
/* ─────────────────────────────────────────────────────────── */

function ConnectionCard({
  providerId,
  connection,
  onSaved,
}: {
  providerId: string;
  connection: ProviderConnection;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(connection.name);
  const [baseUrl, setBaseUrl] = useState(connection.baseUrl);
  const [baseApi, setBaseApi] = useState(connection.baseApi ?? '');
  const [authUrl, setAuthUrl] = useState(connection.authUrl ?? '');
  const [environment, setEnvironment] = useState(connection.environment);
  const [clientIdentifier, setClientIdentifier] = useState(
    connection.clientIdentifier ?? '',
  );
  const [providerTenantId, setProviderTenantId] = useState(
    connection.providerTenantId ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateConnectionAction(providerId, connection.id, {
      name,
      baseUrl,
      baseApi: baseApi || undefined,
      authUrl: authUrl || undefined,
      environment,
      clientIdentifier: clientIdentifier || undefined,
      providerTenantId: providerTenantId || undefined,
    });
    if (result.success) {
      setEditing(false);
      onSaved();
    } else {
      setError(result.error ?? 'Failed to save');
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-900">{connection.name}</span>
          <StatusBadge
            status={connection.environment}
            variant={connection.isActive ? 'active' : 'inactive'}
          />
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Base URL</p>
            <p className="font-mono text-xs text-slate-700 truncate">{connection.baseUrl}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">REST API Base URL</p>
            <p className="font-mono text-xs text-slate-700 truncate">
              {connection.baseApi ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Client Identifier</p>
            <p className="font-mono text-xs text-slate-700">
              {connection.clientIdentifier ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Vendor Tenant ID</p>
            <p className="font-mono text-xs text-slate-700">
              {connection.providerTenantId ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Last Sync</p>
            <p className="text-xs text-slate-700">
              {connection.lastSyncAt
                ? new Date(connection.lastSyncAt).toLocaleString()
                : 'Never'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={(v) => v && setEnvironment(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              <p className="text-xs text-slate-400">
                Host used for OAuth token exchange.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>REST API Base URL</Label>
              <Input
                value={baseApi}
                onChange={(e) => setBaseApi(e.target.value)}
                placeholder="https://staging-iag.crunchwork.com/rest/insurance-rest"
              />
              <p className="text-xs text-slate-400">
                Prefix used for REST calls per Insurance REST API §3.2.1.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Auth URL</Label>
              <Input value={authUrl} onChange={(e) => setAuthUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Client Identifier</Label>
              <Input
                value={clientIdentifier}
                onChange={(e) => setClientIdentifier(e.target.value)}
                placeholder="e.g. iag"
              />
              <p className="text-xs text-slate-400">
                Short slug sent as <code>client</code> in webhook payloads.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Vendor Tenant ID</Label>
              <Input
                value={providerTenantId}
                onChange={(e) => setProviderTenantId(e.target.value)}
                placeholder="Vendor tenant UUID"
              />
              <p className="text-xs text-slate-400">
                UUID sent as <code>tenantId</code> in webhook payloads.
              </p>
            </div>
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Connection'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/* Add Connection Form                                          */
/* ─────────────────────────────────────────────────────────── */

function AddConnectionForm({
  providerId,
  onCancel,
  onSaved,
}: {
  providerId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState('staging');
  const [baseUrl, setBaseUrl] = useState('');
  const [baseApi, setBaseApi] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [clientIdentifier, setClientIdentifier] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [providerTenantId, setProviderTenantId] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !baseUrl.trim()) {
      setError('Name and Base URL are required');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createConnectionAction(providerId, {
      name,
      environment,
      baseUrl,
      baseApi: baseApi || undefined,
      authUrl: authUrl || undefined,
      authType: 'client_credentials',
      clientIdentifier: clientIdentifier || undefined,
      providerTenantId: providerTenantId || undefined,
      credentials: clientSecret ? { clientSecret } : undefined,
      webhookSecret: webhookSecret || undefined,
    });
    if (result.success) {
      onSaved();
    } else {
      setError(result.error ?? 'Failed to create connection');
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-slate-200 p-6 space-y-5">
      <p className="text-sm font-semibold text-slate-900">New Connection</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div className="space-y-1.5">
          <Label>
            Name <span className="text-rose-500">*</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label>Environment</Label>
          <Select value={environment} onValueChange={(v) => v && setEnvironment(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>
            Base URL <span className="text-rose-500">*</span>
          </Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://staging-iag.crunchwork.com"
          />
          <p className="text-xs text-slate-400">
            Host used for OAuth token exchange.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>REST API Base URL</Label>
          <Input
            value={baseApi}
            onChange={(e) => setBaseApi(e.target.value)}
            placeholder="https://staging-iag.crunchwork.com/rest/insurance-rest"
          />
          <p className="text-xs text-slate-400">
            Prefix used for REST calls per Insurance REST API §3.2.1.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Auth URL</Label>
          <Input
            value={authUrl}
            onChange={(e) => setAuthUrl(e.target.value)}
            placeholder="Token endpoint URL"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Client Identifier</Label>
          <Input
            value={clientIdentifier}
            onChange={(e) => setClientIdentifier(e.target.value)}
            placeholder="e.g. iag"
          />
          <p className="text-xs text-slate-400">
            Short slug sent as <code>client</code> in webhook payloads.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>OAuth Client Secret</Label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Vendor Tenant ID</Label>
          <Input
            value={providerTenantId}
            onChange={(e) => setProviderTenantId(e.target.value)}
            placeholder="Vendor tenant UUID"
          />
          <p className="text-xs text-slate-400">
            UUID sent as <code>tenantId</code> in webhook payloads.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Webhook Secret</Label>
          <Input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={saving}>
          {saving ? (
            <>
              <Loader2 size={14} className="mr-1.5 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Connection'
          )}
        </Button>
      </div>
    </div>
  );
}
