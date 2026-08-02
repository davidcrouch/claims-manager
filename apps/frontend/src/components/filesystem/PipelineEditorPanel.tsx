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

interface PipelineEditorPanelProps {
  filesystemId: string;
  categoryId?: string;
}

export function PipelineEditorPanel({ filesystemId, categoryId }: PipelineEditorPanelProps) {
  const [pipelines, setPipelines] = useState<PipelineResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/pipelines/filesystem/${filesystemId}`);
    const all: PipelineResponse[] = res.ok ? await res.json() : [];
    const filtered = categoryId
      ? all.filter((p) => p.categoryId === categoryId)
      : all.filter((p) => !p.categoryId);
    setPipelines(filtered);
    setLoading(false);
  }, [filesystemId, categoryId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    const name = categoryId ? 'Category Pipeline' : 'Document Pipeline';
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filesystemId,
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
    }
  }, [filesystemId, categoryId]);

  const handleToggleActive = useCallback(async (pipeline: PipelineResponse) => {
    const res = await fetch(`/api/pipelines/${pipeline.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !pipeline.isActive }),
    });
    if (res.ok) {
      const updated: PipelineResponse = await res.json();
      setPipelines((prev) => prev.map((p) => (p.id === pipeline.id ? updated : p)));
    }
  }, []);

  const handleNameChange = useCallback(async (pipeline: PipelineResponse, name: string) => {
    const res = await fetch(`/api/pipelines/${pipeline.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated: PipelineResponse = await res.json();
      setPipelines((prev) => prev.map((p) => (p.id === pipeline.id ? updated : p)));
    }
  }, []);

  const handleDelete = useCallback(async (pipeline: PipelineResponse) => {
    if (!confirm(`Delete pipeline "${pipeline.name}"? This will also delete all steps and cannot be undone.`)) {
      return;
    }
    setDeleting(pipeline.id);
    try {
      const res = await fetch(`/api/pipelines/${pipeline.id}`, { method: 'DELETE' });
      if (res.ok) {
        setPipelines((prev) => prev.filter((p) => p.id !== pipeline.id));
      }
    } finally {
      setDeleting(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-800">
            {categoryId ? 'Category Pipelines' : 'Filesystem Pipelines'}
          </h4>
        </div>
        <Button type="button" size="sm" onClick={handleCreate} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Pipeline
        </Button>
      </div>

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
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={pipeline.name}
                  onChange={(e) =>
                    setPipelines((prev) =>
                      prev.map((p) => (p.id === pipeline.id ? { ...p, name: e.target.value } : p)),
                    )
                  }
                  onBlur={(e) => {
                    if (e.target.value !== pipeline.name) {
                      handleNameChange(pipeline, e.target.value);
                    }
                  }}
                  className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-800 focus:outline-none focus:ring-0"
                />
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={pipeline.isActive}
                onClick={() => handleToggleActive(pipeline)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
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

              <button
                type="button"
                onClick={() => handleDelete(pipeline)}
                disabled={deleting === pipeline.id}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`Delete ${pipeline.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                <PipelineStepsEditor pipelineId={pipeline.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PipelineStepsEditor({ pipelineId }: { pipelineId: string }) {
  const [steps, setSteps] = useState<PipelineStepResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/pipelines/${pipelineId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        setSteps(p?.steps ?? []);
        setLoading(false);
      });
  }, [pipelineId]);

  const addStep = useCallback(() => {
    const defaultAgent = SYSTEM_AGENTS[0];
    const maxOrder = steps.reduce((max, s) => Math.max(max, s.stepOrder), -1);
    const newStep: PipelineStepResponse = {
      id: `new-${Date.now()}`,
      pipelineId,
      agentId: defaultAgent.id,
      stepOrder: maxOrder + 1,
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSteps((prev) => [...prev, newStep]);
    setDirty(true);
  }, [pipelineId, steps]);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }, []);

  const updateStepAgent = useCallback((index: number, agentId: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, agentId } : s)),
    );
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const input: PipelineStepInput[] = steps.map((s, i) => ({
        agentId: s.agentId,
        stepOrder: i,
        config: s.config,
      }));
      const res = await fetch(`/api/pipelines/${pipelineId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: input }),
      });
      if (res.ok) {
        const saved: PipelineStepResponse[] = await res.json();
        setSteps(saved);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }, [pipelineId, steps]);

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
          <div key={step.id} className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
              {index + 1}
            </span>
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: agent?.avatarColor ?? '#64748b' }}
            >
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <select
              value={step.agentId}
              onChange={(e) => updateStepAgent(index, e.target.value)}
              className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
            >
              {SYSTEM_AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeStep(index)}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove step"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

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
          <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="gap-1 text-xs">
            {saving ? 'Saving…' : 'Save Steps'}
          </Button>
        )}
      </div>
    </div>
  );
}
