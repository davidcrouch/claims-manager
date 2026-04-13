'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug, X, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createProviderAction } from '@/app/(app)/providers/actions';
import type { ProviderSummary } from '@/types/api';

interface ProviderTemplate {
  code: string;
  name: string;
  description: string;
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'url';
  required?: boolean;
  hint?: string;
  mapTo: 'baseUrl' | 'authUrl' | 'clientIdentifier' | 'providerTenantId' | 'webhookSecret' | `credentials.${string}` | `config.${string}`;
}

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    code: 'crunchwork',
    name: 'Crunchwork',
    description: 'Crunchwork Insurance claims management platform',
    fields: [
      { key: 'baseUrl', label: 'API Hostname', placeholder: 'https://staging-iag.crunchwork.com', type: 'url', required: true, mapTo: 'baseUrl' },
      { key: 'authUrl', label: 'Auth Token URL', placeholder: 'https://staging-iag.crunchwork.com/auth/token?grant_type=client_credentials', type: 'url', required: true, mapTo: 'authUrl' },
      { key: 'clientId', label: 'Client ID', placeholder: 'Client identifier (UUID)', required: true, mapTo: 'clientIdentifier' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, mapTo: 'credentials.clientSecret' },
      { key: 'insureTenantId', label: 'Insure Tenant ID', placeholder: 'Insurer tenant UUID', required: true, mapTo: 'providerTenantId' },
      { key: 'vendorTenantId', label: 'Vendor Tenant ID', placeholder: 'Vendor tenant UUID', required: true, mapTo: 'credentials.vendorTenantId' },
      { key: 'hmacKey', label: 'HMAC Key', placeholder: 'Webhook HMAC verification key', type: 'password', required: true, mapTo: 'webhookSecret' },
      { key: 'clientIdentifier', label: 'Client Identifier', placeholder: 'e.g. iag', required: true, mapTo: 'config.clientIdentifier' },
    ],
  },
];

export interface ProviderFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProviders: ProviderSummary[];
}

export function ProviderFormDrawer({
  open,
  onOpenChange,
  existingProviders,
}: ProviderFormDrawerProps) {
  const router = useRouter();
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [connectionName, setConnectionName] = useState('');
  const [environment, setEnvironment] = useState('staging');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = PROVIDER_TEMPLATES.find((t) => t.code === selectedCode);
  const alreadyConfigured = existingProviders.some((p) => p.code === selectedCode);

  function reset() {
    setSelectedCode('');
    setConnectionName('');
    setEnvironment('staging');
    setFieldValues({});
    setFieldErrors({});
    setError(null);
  }

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

  function buildConnectionPayload() {
    if (!template) return null;

    const conn: Record<string, unknown> = {
      name: connectionName || `${template.name} ${environment}`,
      environment,
      baseUrl: '',
      authType: 'client_credentials',
      credentials: {} as Record<string, string>,
      config: {} as Record<string, string>,
    };

    for (const field of template.fields) {
      const val = fieldValues[field.key] ?? '';
      if (!val) continue;

      if (field.mapTo.startsWith('credentials.')) {
        const credKey = field.mapTo.slice('credentials.'.length);
        (conn.credentials as Record<string, string>)[credKey] = val;
      } else if (field.mapTo.startsWith('config.')) {
        const cfgKey = field.mapTo.slice('config.'.length);
        (conn.config as Record<string, string>)[cfgKey] = val;
      } else {
        conn[field.mapTo] = val;
      }
    }

    return conn;
  }

  async function handleSubmit() {
    if (!template) return;

    const errors: Record<string, string> = {};
    for (const f of template.fields) {
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
      const connection = buildConnectionPayload();

      const result = await createProviderAction({
        code: template.code,
        name: template.name,
        connection: connection as {
          name: string;
          environment: string;
          baseUrl: string;
          authUrl?: string;
          authType?: string;
          clientIdentifier?: string;
          providerTenantId?: string;
          credentials?: Record<string, unknown>;
          webhookSecret?: string;
          config?: Record<string, unknown>;
        },
      });

      if (result.success) {
        onOpenChange(false);
        reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create provider connection');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create provider connection',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto w-[65%]! h-[90vh]! flex flex-col overflow-hidden rounded-t-xl border-x border-t p-0 data-starting-style:translate-y-full! data-ending-style:translate-y-full! transition-transform! duration-300! ease-out!"
      >
        {/* ── Header ── */}
        <div className="border-b border-slate-100 bg-slate-50/50 px-12 py-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                <Unplug className="h-5 w-5 text-violet-600" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Add Provider Connection
              </h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 outline-none focus:ring-2 focus:ring-slate-900"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Select a provider and configure connection credentials.
          </p>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto bg-white px-16 py-8">
          <div className="space-y-6">
            {/* Connection Name, Provider, Environment */}
            <div className="grid grid-cols-3 gap-x-4">
              <div className="space-y-1.5">
                <Label>Connection Name</Label>
                <Input
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder={template ? `e.g. ${template.name} Production` : ''}
                  disabled={!template}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Provider <span className="text-rose-500">*</span>
                </Label>
                <Select value={selectedCode} onValueChange={(v) => v && setSelectedCode(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TEMPLATES.map((t) => (
                      <SelectItem key={t.code} value={t.code}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {alreadyConfigured && (
                  <p className="text-xs text-amber-600">
                    Already configured — this adds another connection.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select value={environment} onValueChange={(v) => v && setEnvironment(v)} disabled={!template}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {template && (
              <>

                {/* Provider-specific fields */}
                <div className="rounded-lg border border-slate-200 p-6">
                  <p className="mb-4 text-sm font-semibold text-slate-900">
                    {template.name} Configuration
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                    {template.fields.map((field) => (
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
              </>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-12 py-6">
          <button
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !template}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              'Create Connection'
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
