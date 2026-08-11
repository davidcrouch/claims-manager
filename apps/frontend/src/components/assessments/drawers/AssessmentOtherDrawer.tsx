'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { updateAssessmentAction } from '@/app/(app)/assessments/actions';
import { asStr, isAssessmentLocked, sectionDict } from '../assessment-sections';
import type { Assessment } from '@/types/api';

export interface AssessmentOtherDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId?: string;
  companionChatOpen?: boolean;
  aiAssistEnabled?: boolean;
  initialData?: Partial<Assessment>;
}

interface OtherFormData {
  clientDiscussion: string;
  resultantDamage: string;
  causeOfDamage: string;
  maintenanceRelatedIssues: string;
  comments: string;
  variancesOfScope: string;
}

function emptyForm(): OtherFormData {
  return {
    clientDiscussion: '',
    resultantDamage: '',
    causeOfDamage: '',
    maintenanceRelatedIssues: '',
    comments: '',
    variancesOfScope: '',
  };
}

function fromAssessment(data: Partial<Assessment>): OtherFormData {
  const rec = sectionDict(data, 'recommendation');
  const dmg = sectionDict(data, 'damage');
  return {
    clientDiscussion: asStr(rec.clientDiscussions),
    resultantDamage: asStr(dmg.damageObserved),
    causeOfDamage: asStr(dmg.causeOfDamage),
    maintenanceRelatedIssues: asStr(dmg.maintenanceDefectIssues),
    comments: asStr(rec.specialNotes),
    variancesOfScope: asStr(rec.conclusion),
  };
}

export function AssessmentOtherDrawer({
  open,
  onOpenChange,
  assessmentId,
  companionChatOpen,
  initialData,
}: AssessmentOtherDrawerProps) {
  const router = useRouter();
  const [form, setForm] = useState<OtherFormData>(
    initialData ? fromAssessment(initialData) : emptyForm(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialData) {
      setForm(fromAssessment(initialData));
      setError(null);
    }
  }, [open, initialData]);

  const update = <K extends keyof OtherFormData>(key: K, value: OtherFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const fields: Array<{ key: keyof OtherFormData; label: string; placeholder: string }> = [
    { key: 'clientDiscussion', label: 'Client Discussion', placeholder: 'Notes from client discussion...' },
    { key: 'resultantDamage', label: 'Resultant Damage', placeholder: 'Describe resultant damage...' },
    { key: 'causeOfDamage', label: 'Cause of Damage', placeholder: 'Describe cause of damage...' },
    { key: 'maintenanceRelatedIssues', label: 'Maintenance Related Issues', placeholder: 'Describe any maintenance issues...' },
    { key: 'comments', label: 'Comments', placeholder: 'Additional comments...' },
    { key: 'variancesOfScope', label: 'Variances of Scope', placeholder: 'Describe any variances...' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentId) {
      setError('No assessment ID provided');
      return;
    }
    if (isAssessmentLocked(initialData?.status)) {
      setError('This assessment has been published and cannot be edited');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateAssessmentAction(assessmentId, {
        recommendation: {
          clientDiscussions: form.clientDiscussion || undefined,
          specialNotes: form.comments || undefined,
          conclusion: form.variancesOfScope || undefined,
        },
        damage: {
          damageObserved: form.resultantDamage || undefined,
          causeOfDamage: form.causeOfDamage || undefined,
          maintenanceDefectIssues: form.maintenanceRelatedIssues || undefined,
        },
      });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assessment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Other Details"
      description="Record additional observations, damage details, and scope variances."
      icon={<MessageSquare className="h-5 w-5" />}
      widthClassName="w-[50%]"
      companionChatOpen={companionChatOpen}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-5">
            {fields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`od-${f.key}`}>{f.label}</Label>
                <Textarea
                  id={`od-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                />
              </div>
            ))}
          </div>

          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" size="lg" className="min-w-36 px-8" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" size="lg" className="min-w-36 px-8" disabled={submitting || isAssessmentLocked(initialData?.status)}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
