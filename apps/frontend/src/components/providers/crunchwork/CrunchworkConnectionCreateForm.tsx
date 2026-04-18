'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createConnectionAction } from '@/app/(app)/connections/actions';
import type { ProviderConnection, CreateConnectionPayload } from '@/types/api';

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'url';
  required?: boolean;
  hint?: string;
  mapTo:
    | 'baseUrl'
    | 'baseApi'
    | 'authUrl'
    | 'clientIdentifier'
    | 'providerTenantId'
    | 'webhookSecret'
    | `credentials.${string}`
    | `config.${string}`;
}

const CRUNCHWORK_FIELDS: FieldDef[] = [
  {
    key: 'baseUrl',
    label: 'API Hostname',
    placeholder: 'https://staging-iag.crunchwork.com',
    type: 'url',
    required: true,
    hint: 'Base host used for OAuth token exchange.',
    mapTo: 'baseUrl',
  },
  {
    key: 'baseApi',
    label: 'REST API Base URL',
    placeholder: 'https://staging-iag.crunchwork.com/rest/insurance-rest',
    type: 'url',
    required: true,
    hint: 'Prefix used for REST calls (e.g. /jobs/{id}). Per Insurance REST API §3.2.1.',
    mapTo: 'baseApi',
  },
  {
    key: 'authUrl',
    label: 'Auth Token URL',
    placeholder:
      'https://staging-iag.crunchwork.com/auth/token?grant_type=client_credentials',
    type: 'url',
    required: true,
    mapTo: 'authUrl',
  },
  {
    key: 'clientIdentifier',
    label: 'Client Identifier',
    placeholder: 'e.g. iag',
    required: true,
    hint: 'Short slug sent as "client" in webhook payloads.',
    mapTo: 'clientIdentifier',
  },
  {
    key: 'clientId',
    label: 'OAuth Client ID',
    placeholder: 'Client credentials UUID',
    required: true,
    mapTo: 'credentials.clientId',
  },
  {
    key: 'clientSecret',
    label: 'OAuth Client Secret',
    type: 'password',
    required: true,
    mapTo: 'credentials.clientSecret',
  },
  {
    key: 'vendorTenantId',
    label: 'Vendor Tenant ID',
    placeholder: 'Vendor tenant UUID',
    required: true,
    hint: 'Used to match inbound webhooks to this connection.',
    mapTo: 'providerTenantId',
  },
  {
    key: 'insureTenantId',
    label: 'Insure Tenant ID',
    placeholder: 'Insurer tenant UUID',
    required: true,
    mapTo: 'config.insureTenantId',
  },
  {
    key: 'hmacKey',
    label: 'HMAC Key',
    placeholder: 'Webhook HMAC verification key',
    type: 'password',
    required: true,
    mapTo: 'webhookSecret',
  },
];

export interface CrunchworkConnectionCreateFormProps {
  connectionName: string;
  environment: 'staging' | 'production';
  onCancel: () => void;
  onCreated: (connection: ProviderConnection) => void;
}

export function CrunchworkConnectionCreateForm({
  connectionName,
  environment,
  onCancel,
  onCreated,
}: CrunchworkConnectionCreateFormProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setFieldValue(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function buildPayload(): CreateConnectionPayload {
    const credentials: Record<string, string> = {};
    const config: Record<string, string> = {};
    const payload: CreateConnectionPayload = {
      name: connectionName || `Crunchwork ${environment}`,
      environment,
      baseUrl: '',
      authType: 'client_credentials',
      credentials,
      config,
    };

    for (const field of CRUNCHWORK_FIELDS) {
      const val = fieldValues[field.key] ?? '';
      if (!val) continue;

      if (field.mapTo.startsWith('credentials.')) {
        credentials[field.mapTo.slice('credentials.'.length)] = val;
      } else if (field.mapTo.startsWith('config.')) {
        config[field.mapTo.slice('config.'.length)] = val;
      } else {
        (payload as unknown as Record<string, string>)[field.mapTo] = val;
      }
    }

    return payload;
  }

  async function handleSubmit() {
    const errors: Record<string, string> = {};
    for (const f of CRUNCHWORK_FIELDS) {
      if (f.required && !fieldValues[f.key]?.trim()) {
        errors[f.key] = `${f.label} is required`;
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = buildPayload();
      const result = await createConnectionAction('crunchwork', payload);

      if (result.success && result.connection) {
        onCreated(result.connection);
      } else {
        setError(result.error ?? 'Failed to create connection');
      }
    } catch (err) {
      console.error('[CrunchworkConnectionCreateForm.handleSubmit]', err);
      setError(
        err instanceof Error ? err.message : 'Failed to create connection',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 p-6">
        <p className="mb-4 text-sm font-semibold text-slate-900">
          Crunchwork Configuration
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {CRUNCHWORK_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label>
                {field.label}
                {field.required && (
                  <span className="ml-0.5 text-rose-500">*</span>
                )}
              </Label>
              <Input
                type={field.type ?? 'text'}
                value={fieldValues[field.key] ?? ''}
                onChange={(e) => setFieldValue(field.key, e.target.value)}
                placeholder={field.placeholder ?? ''}
                className={
                  fieldErrors[field.key]
                    ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500'
                    : ''
                }
              />
              {field.hint && (
                <p className="text-xs text-slate-400">{field.hint}</p>
              )}
              {fieldErrors[field.key] && (
                <p className="text-xs text-red-500">
                  {fieldErrors[field.key]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating...
            </>
          ) : (
            'Create Crunchwork Connection'
          )}
        </button>
      </div>
    </div>
  );
}
