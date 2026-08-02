'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pin, Search, Sparkles } from 'lucide-react';
import { listSkillsAction } from '@/app/(app)/admin/skills/actions';
import type { Agent, Skill } from '@/lib/ai/types';

interface AgentSkillsTabProps {
  agent: Agent;
  onChange: (agent: Agent) => void;
  readOnly?: boolean;
}

type SemanticMode = 'all' | 'disabled';

export function AgentSkillsTab({ agent, onChange, readOnly }: AgentSkillsTabProps) {
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listSkillsAction().then((skills) => {
      setAvailableSkills(skills);
      setLoading(false);
    });
  }, []);

  const pinnedSkills = agent.pinnedSkills ?? [];
  const semanticMode: SemanticMode =
    agent.semanticSkills === 'none' ? 'disabled' : 'all';

  const handlePinToggle = useCallback(
    (skillId: string) => {
      if (readOnly) return;
      const current = agent.pinnedSkills ?? [];
      const updated = current.includes(skillId)
        ? current.filter((id) => id !== skillId)
        : [...current, skillId];
      onChange({ ...agent, pinnedSkills: updated });
    },
    [agent, onChange, readOnly],
  );

  const handleSemanticModeChange = useCallback(
    (mode: SemanticMode) => {
      if (readOnly) return;
      onChange({
        ...agent,
        semanticSkills: mode === 'all' ? 'all' : 'none',
      });
    },
    [agent, onChange, readOnly],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-400">
        Loading skills…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Pin className="h-4 w-4 text-emerald-600" />
          Pinned Skills
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Pinned skills are always available to this agent. They are injected into every message
          regardless of the user&apos;s input.
        </p>
        {availableSkills.length === 0 ? (
          <p className="text-xs text-slate-400">No skills available. Create skills first.</p>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {availableSkills.map((skill) => (
              <label
                key={skill.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={pinnedSkills.includes(skill.id)}
                  disabled={readOnly}
                  onChange={() => handlePinToggle(skill.id)}
                  className="rounded border-slate-300"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-slate-700">{skill.name}</span>
                  {skill.category && (
                    <span className="ml-1.5 text-xs text-slate-400">[{skill.category}]</span>
                  )}
                  {skill.description && (
                    <p className="truncate text-xs text-slate-400">{skill.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Search className="h-4 w-4 text-purple-500" />
          Semantic Discovery Pool
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Controls which skills can be dynamically surfaced via semantic matching based on the
          user&apos;s message.
        </p>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="semanticMode"
              checked={semanticMode === 'all'}
              disabled={readOnly}
              onChange={() => handleSemanticModeChange('all')}
              className="mt-0.5 border-slate-300"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">All visible skills</span>
              <p className="text-xs text-slate-400">
                Any visible skill can be matched dynamically.
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="semanticMode"
              checked={semanticMode === 'disabled'}
              disabled={readOnly}
              onChange={() => handleSemanticModeChange('disabled')}
              className="mt-0.5 border-slate-300"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Disabled</span>
              <p className="text-xs text-slate-400">
                Only pinned skills will be available. No dynamic matching.
              </p>
            </div>
          </label>
        </div>
      </div>

      {pinnedSkills.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Active Configuration
          </h3>
          <div className="space-y-1 text-xs text-slate-600">
            <p>
              <strong>Pinned:</strong> {pinnedSkills.length} skill(s) always injected
            </p>
            <p>
              <strong>Semantic:</strong>{' '}
              {semanticMode === 'all' ? 'All visible skills discoverable' : 'Disabled'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
