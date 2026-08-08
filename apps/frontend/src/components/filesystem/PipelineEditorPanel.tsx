'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  PipelineResponse,
  PipelineStepResponse,
  PipelineStepInput,
} from '@/lib/api-client';

/**
 * Pipeline steps reference a system agent by id. claims-manager currently only
 * ships built-in system agents (no user-defined agent catalog), so the choices
 * are hardcoded here to mirror apps/api/src/modules/system-agents/agent-roles.ts.
 */
const SYSTEM_AGENTS: { id: string; name: string; avatarColor: string }[] = [
  { id: 'document-classifier', name: 'Document Classifier', avatarColor: '#2563eb' },
  { id: 'category-description-gen', name: 'Category Description Generator', avatarColor: '#7c3aed' },
];

type PipelineEditorPanelProps =
  | {
      filesystemId: string;
      templateId?: never;
      categoryId?: string;
      readOnly?: boolean;
      isPlatformTemplate?: never;
      onTemplateCloned?: never;
    }
  | {
      filesystemId?: never;
      templateId: string;
      categoryId?: string;
      readOnly?: boolean;
      /** Platform templates must be cloned before mutations. */
      isPlatformTemplate?: boolean;
      onTemplateCloned?: (cloned: { id: string; name: string }) => void;
    };

export function PipelineEditorPanel(props: PipelineEditorPanelProps) {
  const filesystemId = 'filesystemId' in props ? props.filesystemId : undefined;
  const templateId = 'templateId' in props ? props.templateId : undefined;
  const categoryId = props.categoryId;
  const readOnly = props.readOnly ?? false;
  const isPlatformTemplate =
    'isPlatformTemplate' in props ? Boolean(props.isPlatformTemplate) : false;
  const onTemplateCloned =
    'onTemplateCloned' in props ? props.onTemplateCloned : undefined;

  const [activeTemplateId, setActiveTemplateId] = useState(templateId);
  const [pipelines, setPipelines] = useState<PipelineResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    setActiveTemplateId(templateId);
  }, [templateId]);

  const listUrl = filesystemId
    ? `/api/pipelines/filesystem/${filesystemId}`
    : activeTemplateId
      ? `/api/filesystem-templates/${activeTemplateId}/pipelines`
      : null;

  const refresh = useCallback(async () => {
    if (!listUrl) return;
    const res = await fetch(listUrl);
    const all: PipelineResponse[] = res.ok ? await res.json() : [];
    const filtered = categoryId
      ? all.filter((p) => p.categoryId === categoryId)
      : all.filter((p) => !p.categoryId);
    setPipelines(filtered);
    setExpandedId((prev) => prev ?? filtered[0]?.id ?? null);
    setLoading(false);
  }, [listUrl, categoryId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const ensureEditableTemplate = useCallback(async (): Promise<{
    templateId: string;
    pipelineIdMap: Map<string, string>;
  } | null> => {
    if (filesystemId) return null;
    if (!activeTemplateId) return null;
    if (!isPlatformTemplate) {
      return { templateId: activeTemplateId, pipelineIdMap: new Map() };
    }

    setCloning(true);
    try {
      const res = await fetch(`/api/filesystem-templates/${activeTemplateId}/clone`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message || 'Failed to customize template',
        );
      }
      const cloned = (await res.json()) as {
        id: string;
        name: string;
        pipelines?: Array<{
          id: string;
          name: string;
          templateCategoryId?: string | null;
        }>;
      };
      setActiveTemplateId(cloned.id);
      onTemplateCloned?.(cloned);

      // Remap filesystem-root pipelines by name so in-flight edits keep working.
      const pipelineIdMap = new Map<string, string>();
      const clonedRoots = (cloned.pipelines ?? []).filter((p) => !p.templateCategoryId);
      const currentRoots = pipelines.filter((p) => !p.categoryId);
      for (const old of currentRoots) {
        const match = clonedRoots.find((p) => p.name === old.name);
        if (match) pipelineIdMap.set(old.id, match.id);
      }

      const listRes = await fetch(`/api/filesystem-templates/${cloned.id}/pipelines`);
      const all: PipelineResponse[] = listRes.ok ? await listRes.json() : [];
      const filtered = categoryId
        ? all.filter((p) => p.categoryId === categoryId)
        : all.filter((p) => !p.categoryId);
      setPipelines(filtered);
      setExpandedId(filtered[0]?.id ?? null);

      toast.success(`Created editable copy “${cloned.name}”`);
      return { templateId: cloned.id, pipelineIdMap };
    } finally {
      setCloning(false);
    }
  }, [
    filesystemId,
    activeTemplateId,
    isPlatformTemplate,
    onTemplateCloned,
    pipelines,
    categoryId,
  ]);

  const pipelineBase = useCallback(
    (id: string, tid?: string) => {
      if (filesystemId) return `/api/pipelines/${id}`;
      const t = tid ?? activeTemplateId;
      return `/api/filesystem-templates/${t}/pipelines/${id}`;
    },
    [filesystemId, activeTemplateId],
  );

  const resolvePipelineId = (
    originalId: string,
    map: Map<string, string> | undefined,
  ) => map?.get(originalId) ?? originalId;

  const handleCreate = useCallback(async () => {
    if (readOnly) return;
    try {
      const ensured = await ensureEditableTemplate();
      const tid = ensured?.templateId ?? activeTemplateId;
      const name = categoryId ? 'Category Pipeline' : 'Document Pipeline';
      const res = filesystemId
        ? await fetch('/api/pipelines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filesystemId,
              categoryId,
              name,
              isActive: true,
              triggerOn: 'upload_complete',
            }),
          })
        : await fetch(`/api/filesystem-templates/${tid}/pipelines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryId,
              name,
              isActive: true,
              triggerOn: 'upload_complete',
            }),
          });
      if (res.ok) {
        const pipeline: PipelineResponse = await res.json();
        setPipelines((prev) => [...prev, pipeline]);
        setExpandedId(pipeline.id);
      } else {
        toast.error('Failed to create pipeline');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create pipeline');
    }
  }, [
    readOnly,
    ensureEditableTemplate,
    categoryId,
    filesystemId,
    activeTemplateId,
  ]);

  const handleToggleActive = useCallback(
    async (pipeline: PipelineResponse) => {
      if (readOnly) return;
      try {
        const ensured = await ensureEditableTemplate();
        const tid = ensured?.templateId ?? activeTemplateId;
        const pid = resolvePipelineId(pipeline.id, ensured?.pipelineIdMap);
        const res = await fetch(pipelineBase(pid, tid ?? undefined), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !pipeline.isActive }),
        });
        if (res.ok) {
          const updated: PipelineResponse = await res.json();
          setPipelines((prev) =>
            prev.map((p) => (p.id === pipeline.id || p.id === pid ? updated : p)),
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update pipeline');
      }
    },
    [readOnly, ensureEditableTemplate, pipelineBase, activeTemplateId],
  );

  const handleNameChange = useCallback(
    async (pipeline: PipelineResponse, name: string) => {
      if (readOnly) return;
      try {
        const ensured = await ensureEditableTemplate();
        const tid = ensured?.templateId ?? activeTemplateId;
        const pid = resolvePipelineId(pipeline.id, ensured?.pipelineIdMap);
        const res = await fetch(pipelineBase(pid, tid ?? undefined), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (res.ok) {
          const updated: PipelineResponse = await res.json();
          setPipelines((prev) =>
            prev.map((p) => (p.id === pipeline.id || p.id === pid ? updated : p)),
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to rename pipeline');
      }
    },
    [readOnly, ensureEditableTemplate, pipelineBase, activeTemplateId],
  );

  const handleDescriptionChange = useCallback(
    async (pipeline: PipelineResponse, description: string) => {
      if (readOnly) return;
      const next = description.trim() || null;
      if ((pipeline.description ?? null) === next) return;
      try {
        const ensured = await ensureEditableTemplate();
        const tid = ensured?.templateId ?? activeTemplateId;
        const pid = resolvePipelineId(pipeline.id, ensured?.pipelineIdMap);
        const res = await fetch(pipelineBase(pid, tid ?? undefined), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: next }),
        });
        if (res.ok) {
          const updated: PipelineResponse = await res.json();
          setPipelines((prev) =>
            prev.map((p) => (p.id === pipeline.id || p.id === pid ? updated : p)),
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update description');
      }
    },
    [readOnly, ensureEditableTemplate, pipelineBase, activeTemplateId],
  );

  const handleDelete = useCallback(
    async (pipeline: PipelineResponse) => {
      if (readOnly) return;
      if (
        !confirm(
          `Delete pipeline "${pipeline.name}"? This will also delete all steps and cannot be undone.`,
        )
      ) {
        return;
      }
      setDeleting(pipeline.id);
      try {
        const ensured = await ensureEditableTemplate();
        const tid = ensured?.templateId ?? activeTemplateId;
        const pid = resolvePipelineId(pipeline.id, ensured?.pipelineIdMap);
        const res = await fetch(pipelineBase(pid, tid ?? undefined), {
          method: 'DELETE',
        });
        if (res.ok) {
          setPipelines((prev) => prev.filter((p) => p.id !== pipeline.id && p.id !== pid));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete pipeline');
      } finally {
        setDeleting(null);
      }
    },
    [readOnly, ensureEditableTemplate, pipelineBase, activeTemplateId],
  );

  if (loading || cloning) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const lockedPlatform = Boolean(templateId && isPlatformTemplate && !readOnly);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-800">
            {categoryId ? 'Category Pipelines' : 'Filesystem Pipelines'}
          </h4>
        </div>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={cloning}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Pipeline
          </Button>
        )}
      </div>

      {lockedPlatform && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This is a platform template. Editing pipelines creates an organisation copy so
          shared seeds stay unchanged.
        </p>
      )}

      {pipelines.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          No pipelines configured. Add one to automate document processing.
        </p>
      )}

      {pipelines.map((pipeline) => {
        const isExpanded = expandedId === pipeline.id;
        return (
          <div
            key={pipeline.id}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : pipeline.id)}
                className="text-slate-400 hover:text-slate-600"
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              <div className="min-w-0 flex-1 space-y-0.5">
                <input
                  type="text"
                  value={pipeline.name}
                  disabled={readOnly}
                  onChange={(e) =>
                    setPipelines((prev) =>
                      prev.map((p) => (p.id === pipeline.id ? { ...p, name: e.target.value } : p)),
                    )
                  }
                  onBlur={(e) => {
                    if (!readOnly && e.target.value !== pipeline.name) {
                      handleNameChange(pipeline, e.target.value);
                    }
                  }}
                  className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-800 focus:outline-none focus:ring-0 disabled:opacity-70"
                />
                <input
                  type="text"
                  value={pipeline.description ?? ''}
                  disabled={readOnly}
                  placeholder="Optional description"
                  onChange={(e) =>
                    setPipelines((prev) =>
                      prev.map((p) =>
                        p.id === pipeline.id ? { ...p, description: e.target.value } : p,
                      ),
                    )
                  }
                  onBlur={(e) => {
                    if (!readOnly) handleDescriptionChange(pipeline, e.target.value);
                  }}
                  className="w-full border-0 bg-transparent p-0 text-xs text-slate-500 placeholder:text-slate-300 focus:outline-none focus:ring-0 disabled:opacity-70"
                />
              </div>

              <span
                className={
                  pipeline.isActive
                    ? 'rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700'
                    : 'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500'
                }
              >
                {pipeline.isActive ? 'Active' : 'Inactive'}
              </span>

              <button
                type="button"
                role="switch"
                aria-checked={pipeline.isActive}
                disabled={readOnly}
                onClick={() => handleToggleActive(pipeline)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  pipeline.isActive ? 'bg-green-500' : 'bg-slate-200',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                    pipeline.isActive ? 'translate-x-4' : 'translate-x-0',
                  )}
                />
              </button>

              <span className="text-[10px] text-slate-400">
                {pipeline.triggerOn === 'upload_complete' ? 'On upload' : pipeline.triggerOn}
              </span>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDelete(pipeline)}
                  disabled={deleting === pipeline.id}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Delete ${pipeline.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                <PipelineStepsEditor
                  pipelineId={pipeline.id}
                  filesystemId={filesystemId}
                  templateId={activeTemplateId}
                  readOnly={readOnly}
                  isPlatformTemplate={isPlatformTemplate}
                  ensureEditableTemplate={ensureEditableTemplate}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PipelineStepsEditor({
  pipelineId,
  filesystemId,
  templateId,
  readOnly,
  isPlatformTemplate,
  ensureEditableTemplate,
}: {
  pipelineId: string;
  filesystemId?: string;
  templateId?: string;
  readOnly?: boolean;
  isPlatformTemplate?: boolean;
  ensureEditableTemplate: () => Promise<{
    templateId: string;
    pipelineIdMap: Map<string, string>;
  } | null>;
}) {
  const [steps, setSteps] = useState<PipelineStepResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState(templateId);
  const [activePipelineId, setActivePipelineId] = useState(pipelineId);

  useEffect(() => {
    setActiveTemplateId(templateId);
  }, [templateId]);

  useEffect(() => {
    setActivePipelineId(pipelineId);
  }, [pipelineId]);

  const detailUrl = filesystemId
    ? `/api/pipelines/${activePipelineId}`
    : activeTemplateId
      ? `/api/filesystem-templates/${activeTemplateId}/pipelines/${activePipelineId}`
      : null;

  useEffect(() => {
    if (!detailUrl) return;
    fetch(detailUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        setSteps(p?.steps ?? []);
        setLoading(false);
      });
  }, [detailUrl]);

  const addStep = useCallback(() => {
    if (readOnly) return;
    const defaultAgent = SYSTEM_AGENTS[0];
    const maxOrder = steps.reduce((max, s) => Math.max(max, s.stepOrder), -1);
    const newStep: PipelineStepResponse = {
      id: `new-${Date.now()}`,
      pipelineId: activePipelineId,
      agentId: defaultAgent.id,
      stepOrder: maxOrder + 1,
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSteps((prev) => [...prev, newStep]);
    setDirty(true);
  }, [activePipelineId, steps, readOnly]);

  const removeStep = useCallback(
    (index: number) => {
      if (readOnly) return;
      setSteps((prev) => prev.filter((_, i) => i !== index));
      setDirty(true);
    },
    [readOnly],
  );

  const updateStepAgent = useCallback(
    (index: number, agentId: string) => {
      if (readOnly) return;
      setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, agentId } : s)));
      setDirty(true);
    },
    [readOnly],
  );

  const handleSave = useCallback(async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const ensured = await ensureEditableTemplate();
      const tid = ensured?.templateId ?? activeTemplateId;
      const pid = ensured?.pipelineIdMap.get(pipelineId) ?? activePipelineId;
      if (tid) setActiveTemplateId(tid);
      if (pid) setActivePipelineId(pid);
      const input: PipelineStepInput[] = steps.map((s, i) => ({
        agentId: s.agentId,
        stepOrder: i,
        config: s.config,
      }));
      const url = filesystemId
        ? `/api/pipelines/${pid}/steps`
        : `/api/filesystem-templates/${tid}/pipelines/${pid}/steps`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: input }),
      });
      if (res.ok) {
        const saved: PipelineStepResponse[] = await res.json();
        setSteps(saved);
        setDirty(false);
      } else {
        toast.error('Failed to save steps');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save steps');
    } finally {
      setSaving(false);
    }
  }, [
    readOnly,
    ensureEditableTemplate,
    steps,
    filesystemId,
    pipelineId,
    activeTemplateId,
    activePipelineId,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <p className="py-3 text-center text-xs text-slate-400">
          No steps. Add an agent to build the pipeline.
        </p>
      )}

      {steps.map((step, index) => {
        const agent = SYSTEM_AGENTS.find((a) => a.id === step.agentId);
        return (
          <div
            key={step.id}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
              {index + 1}
            </span>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: agent?.avatarColor ?? '#64748b' }}
            >
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              {readOnly ? (
                <>
                  <p className="truncate text-sm font-medium text-slate-800">
                    {agent?.name ?? step.agentId}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">{step.agentId}</p>
                </>
              ) : (
                <>
                  <select
                    value={step.agentId}
                    onChange={(e) => updateStepAgent(index, e.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-800"
                  >
                    {SYSTEM_AGENTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-0.5 truncate text-[10px] text-slate-400">{step.agentId}</p>
                </>
              )}
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeStep(index)}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove step"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addStep}
            disabled={steps.length >= 10}
            className="gap-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            Add Step
          </Button>
          {dirty && (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1 text-xs"
            >
              {saving ? 'Saving…' : 'Save Steps'}
            </Button>
          )}
        </div>
      )}

      {isPlatformTemplate && !readOnly && dirty && (
        <p className="text-[10px] text-slate-400">
          Saving will create an organisation copy of this platform template.
        </p>
      )}
    </div>
  );
}
