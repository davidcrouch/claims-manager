'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import {
  AI_PROVIDER_LABELS,
  AGENT_VISIBILITY_LABELS,
  DEFAULT_AI_SETTINGS,
  uiProviderToApi,
  type Agent,
  type AgentType,
  type AgentVisibility,
  type AIProvider,
} from '@/lib/ai/types';
import { createAgentAction, getAiChatModelsAction } from '@/app/(app)/admin/agents/actions';
import { ConnectionSelectionStep } from '@/components/agents/ConnectionSelectionStep';
import { ToolSelectionPanel } from '@/components/agents/ToolSelectionPanel';

export interface CreateAgentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (agent: Agent) => void;
}

interface StepConfig {
  label: string;
  description: string;
}

const STEPS: StepConfig[] = [
  { label: 'Agent Details', description: 'Name and basic configuration' },
  { label: 'Model Configuration', description: 'Provider, model, and parameters' },
  { label: 'MCP Connections', description: 'Select server connections' },
  { label: 'Tools', description: 'Choose available tools' },
];

interface DraftAgent {
  name: string;
  type: AgentType;
  visibility: AgentVisibility;
  chatEnabled: boolean;
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  connectionIds: string[];
  enabledTools?: string[];
  autonomousMode: boolean;
  pauseAfterToolSteps: number;
  maxDurationSeconds: number;
  maxSteps: number;
}

const INITIAL_DRAFT: DraftAgent = {
  name: '',
  type: 'chat',
  visibility: 'org',
  chatEnabled: true,
  provider: DEFAULT_AI_SETTINGS.provider,
  model: DEFAULT_AI_SETTINGS.model,
  temperature: DEFAULT_AI_SETTINGS.temperature,
  maxTokens: DEFAULT_AI_SETTINGS.maxTokens,
  systemPrompt: DEFAULT_AI_SETTINGS.systemPrompt,
  connectionIds: [],
  enabledTools: undefined,
  autonomousMode: false,
  pauseAfterToolSteps: 4,
  maxDurationSeconds: 120,
  maxSteps: 10,
};

export function CreateAgentDrawer({ open, onOpenChange, onCreated }: CreateAgentDrawerProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<DraftAgent>({ ...INITIAL_DRAFT });
  const [modelOptions, setModelOptions] = useState<Record<string, Array<{ id: string; label: string }>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      try {
        const models = await getAiChatModelsAction();
        setModelOptions(models);
      } catch (err) {
        console.error('[CreateAgentDrawer.loadModels]', err);
      }
    });
  }, [open]);

  function resetForm() {
    setStepIndex(0);
    setDraft({ ...INITIAL_DRAFT });
    setError(null);
  }

  function validateCurrentStep(): boolean {
    if (stepIndex === 0) {
      if (!draft.name.trim()) {
        setError('Name is required');
        return false;
      }
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function handleBack() {
    setError(null);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

  function handleSubmit() {
    if (!validateCurrentStep()) return;
    setError(null);
    startTransition(async () => {
      const result = await createAgentAction({
        name: draft.name.trim(),
        provider: uiProviderToApi(draft.provider),
        model: draft.model,
        temperature: draft.temperature,
        maxTokens: draft.maxTokens,
        systemPrompt: draft.systemPrompt,
        visibility: draft.visibility,
        chatEnabled: draft.chatEnabled,
        connectionIds: draft.connectionIds.length > 0 ? draft.connectionIds : undefined,
        enabledTools: draft.enabledTools,
        autonomousMode: draft.autonomousMode,
        pauseAfterToolSteps: draft.pauseAfterToolSteps,
        maxDurationSeconds: draft.maxDurationSeconds,
        maxSteps: draft.maxSteps,
      });
      if (!result.success || !result.agent) {
        setError(result.error ?? 'Failed to create agent');
        return;
      }
      onCreated?.(result.agent);
      onOpenChange(false);
      resetForm();
    });
  }

  function updateDraft(patch: Partial<DraftAgent>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  const draftAsAgent: Agent = {
    id: '__draft__',
    name: draft.name,
    type: draft.type,
    visibility: draft.visibility,
    chatEnabled: draft.chatEnabled,
    provider: draft.provider,
    model: draft.model,
    temperature: draft.temperature,
    maxTokens: draft.maxTokens,
    systemPrompt: draft.systemPrompt,
    connectionIds: draft.connectionIds,
    enabledTools: draft.enabledTools,
    autonomousMode: draft.autonomousMode,
    pauseAfterToolSteps: draft.pauseAfterToolSteps,
    maxDurationSeconds: draft.maxDurationSeconds,
    maxSteps: draft.maxSteps,
  };

  const providerModels = modelOptions[draft.provider] ?? [];
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
        title="Create Agent"
        description={STEPS[stepIndex].description}
        icon={<Plus className="h-5 w-5" />}
      >
        <BottomFormDrawerBody>
          <div className="space-y-5">
            {/* Step indicator */}
            <nav aria-label="Progress" className="mb-4">
              <ol className="flex items-center gap-2">
                {STEPS.map((step, idx) => {
                  const isCompleted = idx < stepIndex;
                  const isCurrent = idx === stepIndex;
                  return (
                    <li key={step.label} className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                          isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                              ? 'bg-slate-800 text-white'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <span
                        className={`hidden text-xs sm:inline ${
                          isCurrent ? 'font-medium text-slate-800' : 'text-slate-500'
                        }`}
                      >
                        {step.label}
                      </span>
                      {idx < STEPS.length - 1 && (
                        <div className="mx-1 h-px w-6 bg-slate-300" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>

            {/* Step content */}
            {stepIndex === 0 && (
              <StepAgentDetails draft={draft} onUpdate={updateDraft} />
            )}
            {stepIndex === 1 && (
              <StepModelConfig
                draft={draft}
                onUpdate={updateDraft}
                providerModels={providerModels}
              />
            )}
            {stepIndex === 2 && (
              <ConnectionSelectionStep
                agent={draftAsAgent}
                onChange={(updated) =>
                  updateDraft({ connectionIds: updated.connectionIds ?? [] })
                }
              />
            )}
            {stepIndex === 3 && (
              <ToolSelectionPanel
                agent={draftAsAgent}
                connectionIds={draft.connectionIds}
                onChange={(updated) =>
                  updateDraft({ enabledTools: updated.enabledTools })
                }
              />
            )}

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </BottomFormDrawerBody>
        <BottomFormDrawerFooter>
          <div className="flex w-full items-center justify-between">
            <div>
              {stepIndex > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBack}
                  disabled={isPending}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              {isLastStep ? (
                <Button type="button" onClick={handleSubmit} disabled={isPending}>
                  {isPending ? 'Creating…' : 'Create Agent'}
                </Button>
              ) : (
                <Button type="button" onClick={handleNext} disabled={isPending} className="gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
  );
}

/* ─── Step 1: Agent Details ─── */

function StepAgentDetails({
  draft,
  onUpdate,
}: {
  draft: DraftAgent;
  onUpdate: (patch: Partial<DraftAgent>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="agent-name">Name</Label>
        <Input
          id="agent-name"
          value={draft.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Claims Assistant"
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="agent-type">Type</Label>
        <select
          id="agent-type"
          value={draft.type}
          onChange={(e) => onUpdate({ type: e.target.value as AgentType })}
          className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="chat">Chat</option>
          <option value="system">System</option>
        </select>
      </div>

      <div>
        <Label htmlFor="agent-visibility">Visibility</Label>
        <select
          id="agent-visibility"
          value={draft.visibility}
          onChange={(e) => onUpdate({ visibility: e.target.value as AgentVisibility })}
          className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {(Object.keys(AGENT_VISIBILITY_LABELS) as AgentVisibility[]).map((key) => (
            <option key={key} value={key}>
              {AGENT_VISIBILITY_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <input
          id="agent-chat-enabled"
          type="checkbox"
          checked={draft.chatEnabled}
          onChange={(e) => onUpdate({ chatEnabled: e.target.checked })}
          className="rounded border-slate-300"
        />
        <Label htmlFor="agent-chat-enabled" className="cursor-pointer">
          Enable for chat interface
        </Label>
      </div>
    </div>
  );
}

/* ─── Step 2: Model Configuration ─── */

function StepModelConfig({
  draft,
  onUpdate,
  providerModels,
}: {
  draft: DraftAgent;
  onUpdate: (patch: Partial<DraftAgent>) => void;
  providerModels: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="agent-provider">Provider</Label>
          <select
            id="agent-provider"
            value={draft.provider}
            onChange={(e) => onUpdate({ provider: e.target.value as AIProvider })}
            className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {(Object.keys(AI_PROVIDER_LABELS) as AIProvider[]).map((key) => (
              <option key={key} value={key}>
                {AI_PROVIDER_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="agent-model">Model</Label>
          {providerModels.length > 0 ? (
            <select
              id="agent-model"
              value={draft.model}
              onChange={(e) => onUpdate({ model: e.target.value })}
              className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {providerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="agent-model"
              value={draft.model}
              onChange={(e) => onUpdate({ model: e.target.value })}
              className="mt-2"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="agent-temp">
            Temperature{' '}
            <span className="text-xs font-normal text-slate-400">({draft.temperature})</span>
          </Label>
          <input
            id="agent-temp"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={draft.temperature}
            onChange={(e) => onUpdate({ temperature: Number(e.target.value) })}
            className="mt-2 w-full"
          />
        </div>
        <div>
          <Label htmlFor="agent-tokens">Max tokens</Label>
          <Input
            id="agent-tokens"
            type="number"
            min="256"
            step="256"
            value={String(draft.maxTokens)}
            onChange={(e) => onUpdate({ maxTokens: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="agent-prompt">System prompt</Label>
        <Textarea
          id="agent-prompt"
          value={draft.systemPrompt}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          rows={6}
        />
      </div>
    </div>
  );
}
