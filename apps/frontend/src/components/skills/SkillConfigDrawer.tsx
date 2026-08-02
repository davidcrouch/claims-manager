'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Save, Settings, TestTube2, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Skill, SkillVisibility, SkillOutputFormat } from '@/lib/ai/types';
import {
  SKILL_OUTPUT_FORMAT_LABELS,
  SKILL_VISIBILITY_DESCRIPTIONS,
  SKILL_VISIBILITY_LABELS,
} from '@/lib/ai/types';
import { SkillTestPanel } from './SkillTestPanel';
import { SkillToolPicker } from './SkillToolPicker';
import { updateSkillAction } from '@/app/(app)/admin/skills/actions';

const VISIBILITY_OPTIONS: SkillVisibility[] = ['private', 'org', 'public'];
const OUTPUT_FORMAT_OPTIONS: SkillOutputFormat[] = ['conversational', 'structured', 'markdown'];

type DrawerTab = 'general' | 'prompt' | 'tools' | 'settings' | 'test';

const TABS: { id: DrawerTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'prompt', label: 'Prompt', icon: FileText },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'test', label: 'Test', icon: TestTube2 },
];

interface SkillConfigDrawerProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (skill: Skill) => void;
}

export function SkillConfigDrawer({ skill, open, onOpenChange, onSaved }: SkillConfigDrawerProps) {
  const [draft, setDraft] = useState<Skill | null>(null);
  const [original, setOriginal] = useState<Skill | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('general');

  const prevSkillIdRef = useRef<string | null>(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    const isNewOpen = open && !prevOpenRef.current;
    const isNewSkill = skill?.id !== prevSkillIdRef.current;
    prevOpenRef.current = open;
    prevSkillIdRef.current = skill?.id ?? null;

    if (skill && open && (isNewOpen || isNewSkill)) {
      setDraft(skill);
      setOriginal(skill);
      setError(null);
      setActiveTab('general');
    }
  }, [skill, open]);

  const isDirty = draft && original ? JSON.stringify(draft) !== JSON.stringify(original) : false;

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setError(null);
  }, [onOpenChange]);

  const handleSave = useCallback(async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);

    const result = await updateSkillAction(draft.id, draft);
    setSaving(false);

    if (result.success && result.skill) {
      setOriginal(result.skill);
      setDraft(result.skill);
      onSaved?.(result.skill);
      onOpenChange(false);
    } else {
      setError(result.error ?? 'Failed to save skill');
    }
  }, [draft, saving, onSaved, onOpenChange]);

  if (!skill || !draft || !open) return null;

  const invocationMode =
    draft.modelOverride || draft.outputFormat === 'structured' || !draft.includeHistory
      ? 'Isolated — runs as a separate sub-completion with its own context.'
      : 'Inline — instructions are injected into the current conversation.';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative ml-auto flex h-full w-[70vw] flex-col overflow-hidden rounded-l-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <header className="relative flex flex-col gap-3 rounded-tl-2xl border-b border-slate-200 bg-gradient-to-r from-[#0d4465] via-[#106b8e] to-[#1597bb] px-7 pb-5 pt-6 text-white">
          <span
            className="pointer-events-none absolute left-2 top-1/2 h-12 w-1.5 -translate-y-1/2 rounded-full bg-white/30"
            aria-hidden
          />
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-200">
                Skill Configuration
              </p>
              <h2 className="mt-0.5 flex items-center gap-2 truncate text-xl font-semibold tracking-tight">
                {draft.iconEmoji ? <span aria-hidden>{draft.iconEmoji}</span> : null}
                {draft.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close drawer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50/60">
          <div className="mx-auto max-w-5xl px-7 pt-5">
            <nav className="mb-5 flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
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
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-5">
                <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h3 className="mb-4 text-sm font-semibold text-slate-800">Skill Details</h3>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <div className="flex flex-col">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Name
                        </label>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Visibility
                        </label>
                        <select
                          value={draft.visibility}
                          onChange={(e) =>
                            setDraft({ ...draft, visibility: e.target.value as SkillVisibility })
                          }
                          className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {VISIBILITY_OPTIONS.map((v) => (
                            <option key={v} value={v}>
                              {SKILL_VISIBILITY_LABELS[v]} — {SKILL_VISIBILITY_DESCRIPTIONS[v]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Description
                      </label>
                      <textarea
                        value={draft.description ?? ''}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="flex flex-col">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Category
                        </label>
                        <input
                          type="text"
                          value={draft.category ?? ''}
                          onChange={(e) =>
                            setDraft({ ...draft, category: e.target.value || null })
                          }
                          className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Icon Emoji
                        </label>
                        <input
                          type="text"
                          value={draft.iconEmoji ?? ''}
                          onChange={(e) =>
                            setDraft({ ...draft, iconEmoji: e.target.value || null })
                          }
                          placeholder="🧮"
                          className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Trigger Hints
                      </label>
                      <input
                        type="text"
                        value={draft.triggerHints.join(', ')}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            triggerHints: e.target.value
                              .split(',')
                              .map((h) => h.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Comma-separated trigger phrases"
                        className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h3 className="mb-4 text-sm font-semibold text-slate-800">Instruction Prompt</h3>
                <textarea
                  value={draft.instructionPrompt}
                  onChange={(e) => setDraft({ ...draft, instructionPrompt: e.target.value })}
                  rows={20}
                  className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            )}

            {activeTab === 'tools' && (
              <SkillToolPicker
                selectedTools={draft.requiredTools ?? []}
                onChange={(tools) => setDraft({ ...draft, requiredTools: tools })}
              />
            )}

            {activeTab === 'settings' && (
              <div className="space-y-5">
                <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h3 className="mb-4 text-sm font-semibold text-slate-800">Model & Output</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="flex flex-col">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Output Format
                      </label>
                      <select
                        value={draft.outputFormat ?? 'conversational'}
                        onChange={(e) =>
                          setDraft({ ...draft, outputFormat: e.target.value as SkillOutputFormat })
                        }
                        className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        {OUTPUT_FORMAT_OPTIONS.map((format) => (
                          <option key={format} value={format}>
                            {SKILL_OUTPUT_FORMAT_LABELS[format]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Model Override
                      </label>
                      <input
                        type="text"
                        value={draft.modelOverride ?? ''}
                        onChange={(e) =>
                          setDraft({ ...draft, modelOverride: e.target.value || null })
                        }
                        placeholder="Default (inherit from agent)"
                        className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Temperature
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={draft.temperature ?? ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            temperature: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        placeholder="Default (inherit from agent)"
                        className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={draft.maxTokens ?? ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            maxTokens: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        placeholder="Default (4096)"
                        className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Requires conversation history</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        When enabled, the skill runs inline in the current conversation.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.includeHistory ?? false}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          includeHistory: !(draft.includeHistory ?? false),
                        })
                      }
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2',
                        (draft.includeHistory ?? false) ? 'bg-blue-600' : 'bg-slate-200',
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
                          (draft.includeHistory ?? false) ? 'translate-x-5' : 'translate-x-0',
                        )}
                      />
                    </button>
                  </div>
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <strong className="font-semibold text-slate-700">Invocation Mode:</strong>{' '}
                    {invocationMode}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'test' && <SkillTestPanel skill={draft} />}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-7 py-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
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
        </footer>
      </div>
    </div>
  );
}
