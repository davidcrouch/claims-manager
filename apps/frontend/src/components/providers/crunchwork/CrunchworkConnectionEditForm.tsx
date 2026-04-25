'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateConnectionAction } from '@/app/(app)/connections/actions';
import type { ProviderConnection, UpdateConnectionPayload } from '@/types/api';

export interface CrunchworkConnectionEditFormProps {
  connection: ProviderConnection;
  onCancel: () => void;
  onSaved: () => void;
}

export function CrunchworkConnectionEditForm({
  connection,
  onCancel,
  onSaved,
}: CrunchworkConnectionEditFormProps) {
  const existingInsureTenantId =
    (connection.config as Record<string, unknown>)?.insureTenantId?.toString() ??
    '';

  const [name, setName] = useState(connection.name);
  const [environment, setEnvironment] = useState(connection.environment);
  const [baseUrl, setBaseUrl] = useState(connection.baseUrl);
  const [baseApi, setBaseApi] = useState(connection.baseApi ?? '');
  const [authUrl, setAuthUrl] = useState(connection.authUrl ?? '');
  const [clientIdentifier, setClientIdentifier] = useState(
    connection.clientIdentifier ?? '',
  );
  const [providerTenantId, setProviderTenantId] = useState(
    connection.providerTenantId ?? '',
  );
  const [insureTenantId, setInsureTenantId] = useState(existingInsureTenantId);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload: UpdateConnectionPayload = {
      name,
      environment,
      baseUrl,
      baseApi: baseApi || undefined,
      authUrl: authUrl || undefined,
      clientIdentifier: clientIdentifier || undefined,
      providerTenantId: providerTenantId || undefined,
      config: {
        ...(connection.config ?? {}),
        ...(insureTenantId ? { insureTenantId } : {}),
      },
    };

    if (clientId || clientSecret) {
      const credentials: Record<string, unknown> = {
        ...(connection.credentials ?? {}),
      };
      if (clientId) credentials.clientId = clientId;
      if (clientSecret) credentials.clientSecret = clientSecret;
      payload.credentials = credentials;
    }

    if (webhookSecret) {
      payload.webhookSecret = webhookSecret;
    }

    const result = await updateConnectionAction(connection.id, payload);

    if (result.success) {
      onSaved();
    } else {
      setError(result.error ?? 'Failed to save connection');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Environment</Label>
          <Select
            value={environment}
            onValueChange={(v) => v && setEnvironment(v)}
          >
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
          <Label>API Hostname</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
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
          <Label>Auth Token URL</Label>
          <Input value={authUrl} onChange={(e) => setAuthUrl(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Client Identifier</Label>
          <Input
            value={clientIdentifier}
            onChange={(e) => setClientIdentifier(e.target.value)}
          />
          <p className="text-xs text-slate-400">
            Short slug sent as &quot;client&quot; in webhook payloads.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>OAuth Client ID</Label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="••••••••"
          />
          <p className="text-xs text-slate-400">
            Leave blank to keep the existing value.
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
          <p className="text-xs text-slate-400">
            Leave blank to keep the existing value.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Vendor Tenant ID</Label>
          <Input
            value={providerTenantId}
            onChange={(e) => setProviderTenantId(e.target.value)}
          />
          <p className="text-xs text-slate-400">
            Used to match inbound webhooks to this connection.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Insure Tenant ID</Label>
          <Input
            value={insureTenantId}
            onChange={(e) => setInsureTenantId(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>HMAC Key</Label>
          <Input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="••••••••"
          />
          <p className="text-xs text-slate-400">
            Leave blank to keep the existing value.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving...
            </>
          ) : (
            'Save Connection'
          )}
        </button>
      </div>
    </div>
  );
}
