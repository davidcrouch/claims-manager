'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2, Server } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { cn } from '@/lib/utils';
import type { McpIntegration } from '@/types/api';
import {
  createMcpIntegrationAction,
  discoverMcpServerAction,
  updateMcpIntegrationAction,
} from '@/app/(app)/admin/mcp-servers/actions';

const AUTH_TYPE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'bearer_passthrough', label: 'Bearer (session)' },
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth', label: 'OAuth 2.0' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'org', label: 'Organisation' },
  { value: 'private', label: 'Private' },
] as const;

type DiscoveryState = 'idle' | 'discovering' | 'done' | 'error';

export interface AddIntegrationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  editing?: McpIntegration | null;
}

export function AddIntegrationDrawer({
  open,
  onOpenChange,
  onCreated,
  editing,
}: AddIntegrationDrawerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [visibility, setVisibility] = useState('org');
  const [transportType, setTransportType] = useState('http');
  const [sharedConnectionPolicy, setSharedConnectionPolicy] = useState('user_required');
  const [selectedAuthTypes, setSelectedAuthTypes] = useState<Set<string>>(new Set(['none']));
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>('idle');
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveredToolCount, setDiscoveredToolCount] = useState<number | undefined>();
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && editing) {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setUrl(editing.url);
      setVisibility(editing.visibility);
      setTransportType(editing.transportType ?? 'http');
      setSharedConnectionPolicy(editing.sharedConnectionPolicy ?? 'user_required');
      setSelectedAuthTypes(new Set(editing.supportedAuthTypes ?? ['none']));
      setDiscoveryState('done');
    } else if (open) {
      setName('');
      setDescription('');
      setUrl('');
      setVisibility('org');
      setTransportType('http');
      setSharedConnectionPolicy('user_required');
      setSelectedAuthTypes(new Set(['none']));
      setDiscoveryState('idle');
      setDiscoveryError(null);
      setDiscoveredToolCount(undefined);
      setRequiresAuth(false);
    }
    setErrors({});
    setSubmitError(null);
  }, [open, editing]);

  async function handleDiscover() {
    if (!url.trim()) return;
    setDiscoveryState('discovering');
    setDiscoveryError(null);
    try {
      const result = await discoverMcpServerAction({ url: url.trim() });
      setRequiresAuth(Boolean(result.requiresAuth));
      setDiscoveredToolCount(result.toolCount as number | undefined);
      const authTypes = new Set<string>(
        (result.supportedAuthTypes as string[] | undefined) ??
          (result.requiresAuth ? ['api_key'] : ['none']),
      );
      setSelectedAuthTypes(authTypes);
      setDiscoveryState('done');
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'Discovery failed');
      setDiscoveryState('error');
    }
  }

  function toggleAuthType(type: string) {
    setSelectedAuthTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!url.trim()) {
      errs.url = 'Server URL is required';
    } else {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          errs.url = 'Must be an HTTP or HTTPS URL';
        }
      } catch {
        errs.url = 'Must be a valid URL';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    setSubmitError(null);

    const supportedAuthTypes = [...selectedAuthTypes];
    if (supportedAuthTypes.length === 0) supportedAuthTypes.push('none');

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      url: url.trim(),
      transportType,
      visibility,
      sharedConnectionPolicy,
      supportedAuthTypes,
      authConfig: {},
    };

    startTransition(async () => {
      try {
        if (editing) {
          const result = await updateMcpIntegrationAction(editing.id, payload);
          if (!result.success) throw new Error(result.error);
        } else {
          const result = await createMcpIntegrationAction(payload);
          if (!result.success) throw new Error(result.error);
        }
        onOpenChange(false);
        onCreated();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to save');
      }
    });
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit MCP Server' : 'Add MCP Server'}
      description="Register an MCP server integration for your organisation."
      icon={<Server className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mcp-name">Name</Label>
              <Input
                id="mcp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Notion MCP"
                className={errors.name ? 'border-destructive' : undefined}
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>
            <div>
              <Label>Transport</Label>
              <div className="mt-2 flex gap-2">
                {(['http', 'sse'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setTransportType(opt)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium',
                      transportType === opt
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 text-slate-600',
                    )}
                  >
                    {opt === 'http' ? 'Streamable HTTP' : 'SSE'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="mcp-url">Server URL</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="mcp-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setDiscoveryState('idle');
                }}
                placeholder="https://mcp.example.com/mcp"
                className={errors.url ? 'border-destructive' : undefined}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleDiscover()}
                disabled={!url.trim() || discoveryState === 'discovering'}
              >
                {discoveryState === 'discovering' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Discover'
                )}
              </Button>
            </div>
            {errors.url && <p className="mt-1 text-xs text-destructive">{errors.url}</p>}
          </div>

          {discoveryState === 'done' && (
            <div
              className={cn(
                'rounded-lg border px-4 py-3 text-sm',
                requiresAuth
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800',
              )}
            >
              {requiresAuth ? 'Authentication required' : 'No authentication required'}
              {discoveredToolCount !== undefined && (
                <span className="ml-2 text-slate-600">
                  · {discoveredToolCount} tool{discoveredToolCount === 1 ? '' : 's'} discovered
                </span>
              )}
            </div>
          )}

          {discoveryState === 'error' && discoveryError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Discovery failed: {discoveryError}. You can configure auth manually.
            </div>
          )}

          <div>
            <Label htmlFor="mcp-desc">Description (optional)</Label>
            <Textarea
              id="mcp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this server provide?"
            />
          </div>

          <div>
            <Label>Auth types</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AUTH_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleAuthType(opt.value)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm font-medium',
                    selectedAuthTypes.has(opt.value)
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 text-slate-600',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Visibility</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {VISIBILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={cn(
                    'rounded-lg border px-2.5 py-2 text-left text-xs font-semibold',
                    visibility === opt.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 text-slate-700',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {submitError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}
        </div>
      </BottomFormDrawerBody>
      <BottomFormDrawerFooter>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Server'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
