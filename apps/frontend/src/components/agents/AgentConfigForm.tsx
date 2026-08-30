'use client';

import { useEffect, useState } from 'react';
import type { Agent, AIProvider } from '@/lib/ai/types';
import { AI_PROVIDER_LABELS } from '@/lib/ai/types';
import { getAiChatModelsAction } from '@/app/(app)/admin/agents/actions';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PRESET_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#64748b', '#1e293b',
];

const ALL_PROVIDERS: AIProvider[] = ['google', 'anthropic'];

const FALLBACK_MODEL_OPTIONS: Record<AIProvider, Array<{ id: string; label: string }>> = {
  google: [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
  anthropic: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5@20251001', label: 'Claude Haiku 4.5' },
  ],
};

interface AgentConfigFormProps {
  agent: Agent;
  onChange: (agent: Agent) => void;
  readOnly?: boolean;
}

export function AgentConfigForm({ agent, onChange, readOnly }: AgentConfigFormProps) {
  const [modelOptions, setModelOptions] = useState(FALLBACK_MODEL_OPTIONS);

  useEffect(() => {
    void getAiChatModelsAction().then((models) => {
      setModelOptions({
        google: models.google?.length ? models.google : FALLBACK_MODEL_OPTIONS.google,
        anthropic: models.anthropic?.length ? models.anthropic : FALLBACK_MODEL_OPTIONS.anthropic,
      });
    });
  }, []);

  const update = <K extends keyof Agent>(key: K, value: Agent[K]) => {
    onChange({ ...agent, [key]: value });
  };

  const providerModels = modelOptions[agent.provider] ?? [];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Model Configuration</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Provider
            </Label>
            <Select
              value={agent.provider}
              onValueChange={(value) => value && update('provider', value as AIProvider)}
              disabled={readOnly}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {AI_PROVIDER_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Model
            </Label>
            <Select
              value={agent.model}
              onValueChange={(value) => value && update('model', value)}
              disabled={readOnly}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {providerModels.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Temperature ({agent.temperature.toFixed(1)})
            </Label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={agent.temperature}
              disabled={readOnly}
              onChange={(e) => update('temperature', parseFloat(e.target.value))}
              className="mt-2 w-full accent-emerald-600"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>Precise (0)</span>
              <span>Creative (2)</span>
            </div>
          </div>

          <div>
            <Label htmlFor="agent-max-tokens" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Max Tokens
            </Label>
            <Input
              id="agent-max-tokens"
              type="number"
              min={256}
              max={128000}
              step={256}
              value={agent.maxTokens}
              disabled={readOnly}
              onChange={(e) => update('maxTokens', parseInt(e.target.value, 10) || 4096)}
              className="mt-1"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={agent.supportsVision !== false}
                disabled={readOnly}
                onChange={(e) => update('supportsVision', e.target.checked)}
                className="rounded border-slate-300"
              />
              Supports image attachments (vision)
            </label>
            <p className="mt-1 text-[10px] text-slate-400">
              Disable for text-only models. Users cannot attach images when this is off.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Execution</h3>
        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={agent.autonomousMode ?? false}
                disabled={readOnly}
                onChange={(e) => update('autonomousMode', e.target.checked)}
                className="rounded border-slate-300"
              />
              Autonomous mode
            </label>
            <p className="mt-1 text-[10px] text-slate-400">
              When on, the agent reports progress instead of asking permission at pause checkpoints and continues calling tools automatically.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div>
              <Label htmlFor="agent-max-steps" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Max Steps
              </Label>
              <Input
                id="agent-max-steps"
                type="number"
                min={1}
                max={100}
                step={1}
                value={agent.maxSteps ?? 10}
                disabled={readOnly}
                onChange={(e) => update('maxSteps', parseInt(e.target.value, 10) || 10)}
                className="mt-1"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Hard ceiling on provider rounds per request.
              </p>
            </div>

            <div>
              <Label htmlFor="agent-pause-steps" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Pause After Tool Steps
              </Label>
              <Input
                id="agent-pause-steps"
                type="number"
                min={1}
                max={100}
                step={1}
                value={agent.pauseAfterToolSteps ?? 4}
                disabled={readOnly}
                onChange={(e) => update('pauseAfterToolSteps', parseInt(e.target.value, 10) || 4)}
                className="mt-1"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Consecutive tool-only turns before a pause checkpoint.
              </p>
            </div>

            <div>
              <Label htmlFor="agent-max-duration" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Max Duration (seconds)
              </Label>
              <Input
                id="agent-max-duration"
                type="number"
                min={30}
                max={600}
                step={30}
                value={agent.maxDurationSeconds ?? 120}
                disabled={readOnly}
                onChange={(e) => update('maxDurationSeconds', parseInt(e.target.value, 10) || 120)}
                className="mt-1"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Wall-clock timeout for the entire stream.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Avatar</h3>

        <div className="mb-5 flex items-center gap-4">
          <AvatarPreview name={agent.name} avatarColor={agent.avatarColor} avatarUrl={agent.avatarUrl} />
          <p className="text-xs text-slate-500">
            This is how the agent appears in chat messages.
          </p>
        </div>

        <div className="mb-4">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Avatar Color
          </Label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                disabled={readOnly}
                onClick={() => update('avatarColor', color)}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-all hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50',
                  agent.avatarColor === color
                    ? 'border-slate-800 ring-2 ring-slate-300'
                    : 'border-transparent',
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <div className="relative">
              <input
                type="color"
                value={agent.avatarColor || '#3b82f6'}
                disabled={readOnly}
                onChange={(e) => update('avatarColor', e.target.value)}
                className="h-7 w-7 cursor-pointer rounded-full border-2 border-dashed border-slate-300 disabled:cursor-not-allowed"
                title="Pick a custom colour"
              />
            </div>
            {agent.avatarColor && !readOnly && (
              <button
                type="button"
                onClick={() => update('avatarColor', undefined)}
                className="ml-1 text-[10px] text-slate-400 hover:text-slate-600"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="agent-avatar-url" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Avatar Image URL
          </Label>
          <Input
            id="agent-avatar-url"
            type="text"
            value={agent.avatarUrl ?? ''}
            disabled={readOnly}
            onChange={(e) => update('avatarUrl', e.target.value || undefined)}
            placeholder="https://example.com/avatar.png"
            className="mt-1"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Paste a URL for an image or GIF. Leave empty to use initials.
          </p>
        </div>
      </div>
    </div>
  );
}

function AvatarPreview({
  name,
  avatarColor,
  avatarUrl,
}: {
  name: string;
  avatarColor?: string;
  avatarUrl?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex flex-col items-center gap-1">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-10 w-10 rounded-full object-cover shadow-sm"
          style={
            avatarColor
              ? { borderColor: avatarColor, borderWidth: 2, borderStyle: 'solid' }
              : undefined
          }
        />
      ) : (
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
          style={{
            background: avatarColor || 'linear-gradient(to bottom right, #3b82f6, #4f46e5)',
          }}
        >
          {initials || 'AI'}
        </div>
      )}
      <span className="max-w-[80px] truncate text-[10px] text-slate-500">{name}</span>
    </div>
  );
}
