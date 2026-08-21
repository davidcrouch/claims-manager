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
    | 'docsUrl'
    | 'clientIdentifier'
    | 'providerTenantId'
    | 'webhookSecret'
    | `credentials.${string}`
    | `config.${string}`;
}

const MORE0_ENSURE_FIELDS: FieldDef[] = [
  {
    key: 'baseUrl',
    label: 'Gateway URL',
    placeholder: 'http://localhost:4510',
    type: 'url',
    required: true,
    hint: 'Base URL of the more0-ensure server. Invoke endpoint lives at /api/v1/invoke.',
    mapTo: 'baseUrl',
  },
  {
    key: 'webhookUrl',
    label: 'Webhook URL',
    placeholder: 'http://localhost:4510/api/v1/webhooks',
    type: 'url',
    required: true,
    hint: 'URL where claims-manager sends domain events.',
    mapTo: 'config.webhookUrl',
  },
  {
    key: 'authUrl',
    label: 'Auth Token URL',
    placeholder: 'https://your-auth-server.example.com/oauth/token',
    type: 'url',
    required: true,
    hint: 'OAuth2 token endpoint (same auth-server as claims-manager).',
    mapTo: 'authUrl',
  },
  {
    key: 'clientId',
    label: 'OAuth Client ID',
    placeholder: 'Client credentials ID',
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
    key: 'mcpServerUrl',
    label: 'MCP Server URL',
    placeholder: 'http://localhost:4502/mcp',
    type: 'url',
    required: false,
    hint: 'URL of the claims-mcp server that more0-ensure connects to (informational).',
    mapTo: 'config.mcpServerUrl',
  },
];

export interface More0EnsureConnectionCreateFormProps {
  connectionName: string;
  environment: 'staging' | 'production';
  onCancel: () => void;
  onCreated: (connection: ProviderConnection) => void;
}

export function More0EnsureConnectionCreateForm({
  connectionName,
  environment,
  onCancel,
  onCreated,
}: More0EnsureConnectionCreateFormProps) {
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
      name: connectionName || `More0 Ensure ${environment}`,
      environment,
      baseUrl: '',
      authType: 'client_credentials',
      credentials,
      config,
    };

    for (const field of MORE0_ENSURE_FIELDS) {
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
    for (const f of MORE0_ENSURE_FIELDS) {
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
      const result = await createConnectionAction('more0-ensure', payload);

      if (result.success && result.connection) {
        onCreated(result.connection);
      } else {
        setError(result.error ?? 'Failed to create connection');
      }
    } catch (err) {
      console.error('[More0EnsureConnectionCreateForm.handleSubmit]', err);
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
          More0 Ensure Configuration
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {MORE0_ENSURE_FIELDS.map((field) => (
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
            'Create More0 Ensure Connection'
          )}
        </button>
      </div>
    </div>
  );
}
