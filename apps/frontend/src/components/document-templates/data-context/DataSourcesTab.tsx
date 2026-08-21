'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Loader2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataEnvelopePreview } from './DataEnvelopePreview';

export interface EntityFieldDef {
  key: string;
  label: string;
  type: string;
  description?: string;
}

export interface RelatedEntityDef {
  entityType: string;
  slug: string;
  label: string;
  description: string;
  cardinality: 'one' | 'many';
  traversalPath: string[];
  fields: EntityFieldDef[];
  defaultEnabled: boolean;
}

export interface DataContextDefinition {
  documentType: string;
  primaryEntity: {
    entityType: string;
    label: string;
    fields: EntityFieldDef[];
  };
  relatedEntities: RelatedEntityDef[];
}

interface DataContextResponse {
  documentType: string;
  available: boolean;
  definition: DataContextDefinition | null;
  enabledSlugs: string[];
  isCustom: boolean;
}

interface DataSourcesTabProps {
  documentType: string;
  label: string;
}

export function DataSourcesTab({ documentType, label }: DataSourcesTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [definition, setDefinition] = useState<DataContextDefinition | null>(null);
  const [enabledSlugs, setEnabledSlugs] = useState<string[]>([]);
  const [savedSlugs, setSavedSlugs] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ primary: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/document-templates/data-context/${encodeURIComponent(documentType)}`,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { message?: string }).message ?? `Failed to load (${res.status})`,
          );
        }
        const data = (await res.json()) as DataContextResponse;
        if (cancelled) return;
        setAvailable(data.available);
        setDefinition(data.definition);
        setEnabledSlugs(data.enabledSlugs ?? []);
        setSavedSlugs(data.enabledSlugs ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data sources');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [documentType]);

  const dirty = useMemo(() => {
    const a = [...enabledSlugs].sort().join(',');
    const b = [...savedSlugs].sort().join(',');
    return a !== b;
  }, [enabledSlugs, savedSlugs]);

  function toggleSlug(slug: string, next: boolean) {
    setEnabledSlugs((prev) =>
      next ? (prev.includes(slug) ? prev : [...prev, slug]) : prev.filter((s) => s !== slug),
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/document-templates/data-context/${encodeURIComponent(documentType)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabledSlugs }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message ?? `Save failed (${res.status})`,
        );
      }
      setSavedSlugs(enabledSlugs);
      toast.success('Data sources saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading data sources…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3">
        <AlertCircle className="size-4 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!available || !definition) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-6">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Data sources</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          {label} uses the built-in data mapper. Data context configuration is not yet
          available for this document type.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Data sources</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Choose which related entities are included when generating {label}{' '}
              documents. Expanding an entity lists the documented fields available
              under <code className="rounded bg-slate-100 px-1">_context</code> for
              JSONata and merge tags.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={!dirty || saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            Save
          </Button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <EntityBlock
            title={definition.primaryEntity.label}
            subtitle="Primary entity"
            fields={definition.primaryEntity.fields}
            expanded={!!expanded.primary}
            onToggleExpand={() =>
              setExpanded((prev) => ({ ...prev, primary: !prev.primary }))
            }
          />

          <div className="pt-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Related entities
            </p>
            <div className="space-y-2">
              {definition.relatedEntities.map((related) => {
                const checked = enabledSlugs.includes(related.slug);
                const pathLabel =
                  related.traversalPath.length > 0
                    ? related.traversalPath.join(' → ')
                    : 'self';
                return (
                  <div
                    key={related.slug}
                    className="rounded-md border border-slate-200 bg-slate-50/60"
                  >
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleSlug(related.slug, v === true)}
                        className="mt-0.5"
                        aria-label={`Include ${related.label}`}
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="flex w-full items-center gap-1 text-left"
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [related.slug]: !prev[related.slug],
                            }))
                          }
                        >
                          {expanded[related.slug] ? (
                            <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight className="size-3.5 shrink-0 text-slate-400" />
                          )}
                          <span className="text-sm font-medium text-slate-800">
                            {related.label}
                          </span>
                          <span className="ml-2 rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600">
                            {related.cardinality}
                          </span>
                        </button>
                        <p className="mt-0.5 pl-4 text-xs text-slate-500">
                          {related.description}
                          <span className="text-slate-400"> · via {pathLabel}</span>
                        </p>
                        {expanded[related.slug] && (
                          <FieldList fields={related.fields} className="mt-2 pl-4" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <DataEnvelopePreview
        documentType={documentType}
        enabledSlugs={enabledSlugs}
      />
    </div>
  );
}

function EntityBlock(props: {
  title: string;
  subtitle: string;
  fields: EntityFieldDef[];
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/40">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={props.onToggleExpand}
      >
        {props.expanded ? (
          <ChevronDown className="size-3.5 text-emerald-600" />
        ) : (
          <ChevronRight className="size-3.5 text-emerald-600" />
        )}
        <div>
          <p className="text-sm font-medium text-slate-800">{props.title}</p>
          <p className="text-xs text-slate-500">{props.subtitle}</p>
        </div>
      </button>
      {props.expanded && <FieldList fields={props.fields} className="border-t border-emerald-100 px-3 pb-3 pt-2" />}
    </div>
  );
}

function FieldList({
  fields,
  className = '',
}: {
  fields: EntityFieldDef[];
  className?: string;
}) {
  return (
    <ul className={`grid gap-1 sm:grid-cols-2 ${className}`}>
      {fields.map((field) => (
        <li key={field.key} className="text-xs text-slate-600">
          <span className="font-medium text-slate-700">{field.label}</span>
          <span className="ml-1 font-mono text-[11px] text-slate-400">{field.key}</span>
          <span className="ml-1 text-slate-400">({field.type})</span>
        </li>
      ))}
    </ul>
  );
}
