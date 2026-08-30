'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Cable, Cpu, Loader2, Save, Settings, Sparkles, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { updateAgentAction } from '@/app/(app)/admin/agents/actions';
import type { Agent, AgentVisibility } from '@/lib/ai/types';
import { AGENT_VISIBILITY_DESCRIPTIONS, AGENT_VISIBILITY_LABELS } from '@/lib/ai/types';
import { cn } from '@/lib/utils';
import { AgentConfigForm } from './AgentConfigForm';
import { ConnectionSelectionStep } from './ConnectionSelectionStep';
import { ToolSelectionPanel } from './ToolSelectionPanel';
import { AgentSkillsTab } from './AgentSkillsTab';

const VISIBILITY_OPTIONS: AgentVisibility[] = ['private', 'org', 'public'];

type DrawerTab = 'general' | 'config' | 'connections' | 'tools' | 'skills';

const TABS: {
  id: DrawerTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'config', label: 'Config', icon: Cpu },
  { id: 'connections', label: 'Connections', icon: Cable },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'skills', label: 'Skills', icon: Sparkles },
];

function agentToPayload(draft: Agent): Record<string, unknown> {
  return {
    name: draft.name,
    provider: draft.provider,
    model: draft.model,
    temperature: draft.temperature,
    maxTokens: draft.maxTokens,
    systemPrompt: draft.systemPrompt,
    chatEnabled: draft.chatEnabled !== false,
    visibility: draft.visibility ?? 'org',
    connectionIds: draft.connectionIds ?? [],
    supportsVision: draft.supportsVision !== false,
    maxSteps: draft.maxSteps,
    autonomousMode: draft.autonomousMode,
    pauseAfterToolSteps: draft.pauseAfterToolSteps,
    maxDurationSeconds: draft.maxDurationSeconds,
    enabledTools: draft.enabledTools ?? [],
    pinnedSkills: draft.pinnedSkills ?? [],
    semanticSkills: draft.semanticSkills ?? 'all',
    avatarUrl: draft.avatarUrl ?? null,
    avatarColor: draft.avatarColor ?? null,
  };
}

interface AgentConfigDrawerProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (agent: Agent) => void;
  readOnly?: boolean;
}

export function AgentConfigDrawer({
  agent,
  open,
  onOpenChange,
  onSaved,
  readOnly,
}: AgentConfigDrawerProps) {
  const [draft, setDraft] = useState<Agent | null>(null);
  const [original, setOriginal] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('general');

  const prevAgentIdRef = useRef<string | null>(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    const isNewOpen = open && !prevOpenRef.current;
    const isNewAgent = agent?.id !== prevAgentIdRef.current;
    prevOpenRef.current = open;
    prevAgentIdRef.current = agent?.id ?? null;

    if (agent && open && (isNewOpen || isNewAgent)) {
      setDraft(agent);
      setOriginal(agent);
      setError(null);
      setActiveTab('general');
    }
  }, [agent, open]);

  const isDirty =
    draft && original
      ? JSON.stringify(agentToPayload(draft)) !== JSON.stringify(agentToPayload(original))
      : false;

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setError(null);
  }, [onOpenChange]);

  const handleSave = useCallback(async () => {
    if (!draft || saving || readOnly) return;
    setSaving(true);
    setError(null);

    const result = await updateAgentAction(draft.id, agentToPayload(draft));
    setSaving(false);

    if (result.success && result.agent) {
      setOriginal(result.agent);
      setDraft(result.agent);
      onSaved?.(result.agent);
      onOpenChange(false);
    } else {
      setError(result.error || 'Failed to save agent');
    }
  }, [draft, onOpenChange, onSaved, readOnly, saving]);

  if (!agent || !draft) return null;

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={agent.name}
      description="Configure model, connections, tools, and prompt settings."
      icon={<Bot className="h-5 w-5" />}
    >
      <BottomFormDrawerBody className="px-8">
        <nav className="mb-5 flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-800">Agent Details</h3>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="config-agent-name">Name</Label>
                    <Input
                      id="config-agent-name"
                      value={draft.name}
                      disabled={readOnly}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="Claims Assistant"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Visibility</Label>
                    <Select
                      value={draft.visibility ?? 'org'}
                      onValueChange={(value) =>
                        value && setDraft({ ...draft, visibility: value as AgentVisibility })
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIBILITY_OPTIONS.map((v) => (
                          <SelectItem key={v} value={v}>
                            {AGENT_VISIBILITY_LABELS[v]} — {AGENT_VISIBILITY_DESCRIPTIONS[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Show in Chat Selector</p>
                    <p className="text-xs text-slate-500">
                      When enabled, this agent appears in the chat agent picker
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.chatEnabled !== false}
                    disabled={readOnly}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        chatEnabled: draft.chatEnabled === false ? true : false,
                      })
                    }
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                      draft.chatEnabled !== false ? 'bg-emerald-600' : 'bg-slate-200',
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
                        draft.chatEnabled !== false ? 'translate-x-5' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>

                <div>
                  <Label htmlFor="config-agent-prompt">System Prompt</Label>
                  <Textarea
                    id="config-agent-prompt"
                    value={draft.systemPrompt}
                    disabled={readOnly}
                    onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
                    rows={12}
                    placeholder="You are a helpful claims assistant..."
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <AgentConfigForm agent={draft} onChange={setDraft} readOnly={readOnly} />
        )}
        {activeTab === 'connections' && (
          <ConnectionSelectionStep agent={draft} onChange={setDraft} readOnly={readOnly} />
        )}
        {activeTab === 'tools' && (
          <ToolSelectionPanel
            agent={draft}
            connectionIds={draft.connectionIds}
            onChange={setDraft}
            readOnly={readOnly}
          />
        )}
        {activeTab === 'skills' && (
          <AgentSkillsTab agent={draft} onChange={setDraft} readOnly={readOnly} />
        )}
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter className="justify-end px-8">
        <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
          {readOnly ? 'Close' : 'Cancel'}
        </Button>
        {!readOnly && (
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || saving}
            className="min-w-[8rem] gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
