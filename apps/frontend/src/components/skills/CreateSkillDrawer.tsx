'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import type { Skill, SkillVisibility } from '@/lib/ai/types';
import { createSkillAction } from '@/app/(app)/admin/skills/actions';

export interface CreateSkillDrawerProps {
  onCreated?: (skill: Skill) => void;
}

export function CreateSkillDrawer({ onCreated }: CreateSkillDrawerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerHints, setTriggerHints] = useState('');
  const [instructionPrompt, setInstructionPrompt] = useState('');
  const [category, setCategory] = useState('general');
  const [visibility, setVisibility] = useState<SkillVisibility>('org');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setName('');
    setDescription('');
    setTriggerHints('');
    setInstructionPrompt('');
    setCategory('general');
    setVisibility('org');
    setError(null);
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!instructionPrompt.trim()) {
      setError('Instruction prompt is required');
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createSkillAction({
        name: name.trim(),
        description: description.trim() || undefined,
        triggerHints: triggerHints
          .split(',')
          .map((hint) => hint.trim())
          .filter(Boolean),
        instructionPrompt,
        category,
        visibility,
      });
      if (!result.success || !result.skill) {
        setError(result.error ?? 'Failed to create skill');
        return;
      }
      onCreated?.(result.skill);
      setOpen(false);
      resetForm();
    });
  }

  return (
    <>
      <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create Skill
      </Button>

      <BottomFormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
        title="Create Skill"
        description="Define instructions injected when trigger keywords match user messages."
        icon={<Plus className="h-5 w-5" />}
        widthClassName="w-[55%]"
      >
        <BottomFormDrawerBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summarise claim"
              />
            </div>

            <div>
              <Label htmlFor="skill-description">Description</Label>
              <Input
                id="skill-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary shown in admin lists"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="skill-category">Category</Label>
                <Input
                  id="skill-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="skill-visibility">Visibility</Label>
                <select
                  id="skill-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as SkillVisibility)}
                  className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="org">Organisation</option>
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="skill-triggers">Trigger hints (comma-separated)</Label>
              <Input
                id="skill-triggers"
                value={triggerHints}
                onChange={(e) => setTriggerHints(e.target.value)}
                placeholder="summarise, summary, overview"
              />
            </div>

            <div>
              <Label htmlFor="skill-prompt">Instruction prompt</Label>
              <Textarea
                id="skill-prompt"
                value={instructionPrompt}
                onChange={(e) => setInstructionPrompt(e.target.value)}
                rows={8}
                placeholder="When this skill is active, follow these instructions..."
              />
            </div>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </BottomFormDrawerBody>
        <BottomFormDrawerFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Skill'}
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
    </>
  );
}
