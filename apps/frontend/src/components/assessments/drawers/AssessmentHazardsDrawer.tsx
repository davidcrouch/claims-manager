'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { updateAssessmentAction } from '@/app/(app)/assessments/actions';
import type { Assessment } from '@/types/api';

export interface AssessmentHazardsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId?: string;
  companionChatOpen?: boolean;
  aiAssistEnabled?: boolean;
  initialData?: Partial<Assessment>;
}

interface HazardsFormData {
  hazardPoolFencing: boolean;
  hazardPoolFencingComment: string;
  hazardElectricalGas: boolean;
  hazardElectricalGasComment: string;
  hazardSewerage: boolean;
  hazardSewerageComment: string;
  hazardStructural: boolean;
  hazardStructuralComment: string;
  hazardOther: string;
}

function emptyForm(): HazardsFormData {
  return {
    hazardPoolFencing: false,
    hazardPoolFencingComment: '',
    hazardElectricalGas: false,
    hazardElectricalGasComment: '',
    hazardSewerage: false,
    hazardSewerageComment: '',
    hazardStructural: false,
    hazardStructuralComment: '',
    hazardOther: '',
  };
}

function fromAssessment(data: Partial<Assessment>): HazardsFormData {
  return {
    hazardPoolFencing: data.hazardPoolFencing ?? false,
    hazardPoolFencingComment: data.hazardPoolFencingComment ?? '',
    hazardElectricalGas: data.hazardElectricalGas ?? false,
    hazardElectricalGasComment: data.hazardElectricalGasComment ?? '',
    hazardSewerage: data.hazardSewerage ?? false,
    hazardSewerageComment: data.hazardSewerageComment ?? '',
    hazardStructural: data.hazardStructural ?? false,
    hazardStructuralComment: data.hazardStructuralComment ?? '',
    hazardOther: data.hazardOther ?? '',
  };
}

const HAZARDS: Array<{
  id: string;
  checkedKey: keyof Pick<
    HazardsFormData,
    'hazardPoolFencing' | 'hazardElectricalGas' | 'hazardSewerage' | 'hazardStructural'
  >;
  commentKey: keyof Pick<
    HazardsFormData,
    | 'hazardPoolFencingComment'
    | 'hazardElectricalGasComment'
    | 'hazardSewerageComment'
    | 'hazardStructuralComment'
  >;
  label: string;
  commentLabel: string;
}> = [
  {
    id: 'hz-pool-fence',
    checkedKey: 'hazardPoolFencing',
    commentKey: 'hazardPoolFencingComment',
    label: 'Pool Fencing',
    commentLabel: 'What is the pool fencing hazard?',
  },
  {
    id: 'hz-electrical',
    checkedKey: 'hazardElectricalGas',
    commentKey: 'hazardElectricalGasComment',
    label: 'Electrical / Gas',
    commentLabel: 'What is the electrical / gas hazard?',
  },
  {
    id: 'hz-sewerage',
    checkedKey: 'hazardSewerage',
    commentKey: 'hazardSewerageComment',
    label: 'Sewerage',
    commentLabel: 'What is the sewerage hazard?',
  },
  {
    id: 'hz-structural',
    checkedKey: 'hazardStructural',
    commentKey: 'hazardStructuralComment',
    label: 'Structural',
    commentLabel: 'What is the structural hazard?',
  },
];

export function AssessmentHazardsDrawer({
  open,
  onOpenChange,
  assessmentId,
  companionChatOpen,
  initialData,
}: AssessmentHazardsDrawerProps) {
  const router = useRouter();
  const [form, setForm] = useState<HazardsFormData>(
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

  const update = <K extends keyof HazardsFormData>(key: K, value: HazardsFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentId) {
      setError('No assessment ID provided');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateAssessmentAction(assessmentId, {
        hazardPoolFencing: form.hazardPoolFencing,
        hazardPoolFencingComment: form.hazardPoolFencingComment || null,
        hazardElectricalGas: form.hazardElectricalGas,
        hazardElectricalGasComment: form.hazardElectricalGasComment || null,
        hazardSewerage: form.hazardSewerage,
        hazardSewerageComment: form.hazardSewerageComment || null,
        hazardStructural: form.hazardStructural,
        hazardStructuralComment: form.hazardStructuralComment || null,
        hazardOther: form.hazardOther || null,
      });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      console.error('AssessmentHazardsDrawer.handleSubmit:', err);
      setError(err instanceof Error ? err.message : 'Failed to update assessment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Site Hazards"
      description="Record any identified hazards at the assessment site."
      icon={<AlertTriangle className="h-5 w-5" />}
      widthClassName="w-[45%]"
      companionChatOpen={companionChatOpen}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="space-y-5">
            {HAZARDS.map((hazard) => (
              <div key={hazard.id} className="space-y-5">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id={hazard.id}
                    checked={form[hazard.checkedKey]}
                    onCheckedChange={(v) => update(hazard.checkedKey, !!v)}
                  />
                  <Label htmlFor={hazard.id} className="cursor-pointer font-normal">
                    {hazard.label}
                  </Label>
                </div>

                <div className="space-y-2 pl-7">
                  <Label htmlFor={`${hazard.id}-comment`}>{hazard.commentLabel}</Label>
                  <Textarea
                    id={`${hazard.id}-comment`}
                    value={form[hazard.commentKey]}
                    onChange={(e) => update(hazard.commentKey, e.target.value)}
                    placeholder="Describe the hazard..."
                    rows={3}
                  />
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="hz-other">Other Hazards</Label>
              <Textarea
                id="hz-other"
                value={form.hazardOther}
                onChange={(e) => update('hazardOther', e.target.value)}
                placeholder="Describe any other hazards..."
                rows={4}
              />
            </div>
          </div>

          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" size="lg" className="min-w-36 px-8" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" size="lg" className="min-w-36 px-8" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
