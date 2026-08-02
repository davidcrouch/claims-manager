'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Skill } from '@/lib/ai/types';
import { listSkillsAction, deleteSkillAction } from '@/app/(app)/admin/skills/actions';
import { CreateSkillDrawer } from './CreateSkillDrawer';
import { SkillConfigDrawer } from './SkillConfigDrawer';

export function SkillsListPanel() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const rows = await listSkillsAction();
    setSkills(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleRowClick(skill: Skill) {
    setSelectedSkill(skill);
    setDrawerOpen(true);
  }

  function handleSaved(updated: Skill) {
    setSkills((current) => current.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleDelete(e: React.MouseEvent, skill: Skill) {
    e.stopPropagation();
    if (!window.confirm(`Delete skill "${skill.name}"?`)) return;
    const result = await deleteSkillAction(skill.id);
    if (result.success) {
      setSkills((current) => current.filter((s) => s.id !== skill.id));
    } else {
      alert(result.error ?? 'Delete failed');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <CreateSkillDrawer onCreated={(skill) => setSkills((c) => [skill, ...c])} />
      </div>

      {skills.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
          No skills configured yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="px-4 py-3 font-medium text-slate-600">Mode</th>
                <th className="px-4 py-3 font-medium text-slate-600">Triggers</th>
                <th className="px-4 py-3 font-medium text-slate-600">Visibility</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {skills.map((skill) => (
                <tr
                  key={skill.id}
                  className="cursor-pointer hover:bg-slate-50/50"
                  onClick={() => handleRowClick(skill)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <Sparkles className="h-4 w-4 text-slate-400" />
                      {skill.name}
                    </div>
                    {skill.description && (
                      <p className="mt-1 text-xs text-slate-500">{skill.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{skill.category ?? 'general'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {skill.invocationMode ?? 'inline'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {skill.triggerHints.length > 0
                      ? skill.triggerHints.join(', ')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{skill.visibility}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={(e) => void handleDelete(e, skill)}
                      title="Delete skill"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SkillConfigDrawer
        skill={selectedSkill}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={handleSaved}
      />
    </>
  );
}
