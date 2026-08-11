'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { updateAssessmentAction } from '@/app/(app)/assessments/actions';
import { asBool, asStr, isAssessmentLocked, sectionDict } from '../assessment-sections';
import type { Assessment } from '@/types/api';

export interface AssessmentAccommodationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId?: string;
  companionChatOpen?: boolean;
  aiAssistEnabled?: boolean;
  initialData?: Partial<Assessment>;
}

interface AccommodationFormData {
  tempAccomRequiredImmediately: boolean;
  tempAccomImmediateEstimateDays: string;
  tempRepairsToMakeLivable: string;
  tempAccomRequiredDuringRepairs: boolean;
  tempAccomRepairsEstimateDays: string;
  workWhileInAccommodation: string;
}

function emptyForm(): AccommodationFormData {
  return {
    tempAccomRequiredImmediately: false,
    tempAccomImmediateEstimateDays: '',
    tempRepairsToMakeLivable: '',
    tempAccomRequiredDuringRepairs: false,
    tempAccomRepairsEstimateDays: '',
    workWhileInAccommodation: '',
  };
}

function fromAssessment(data: Partial<Assessment>): AccommodationFormData {
  const ta = sectionDict(data, 'temporaryAccommodation');
  return {
    tempAccomRequiredImmediately: asBool(ta.requiredImmediately),
    tempAccomImmediateEstimateDays: asStr(ta.immediateEstimateDays),
    tempRepairsToMakeLivable: asStr(ta.tempRepairsToMakeLivable),
    tempAccomRequiredDuringRepairs: asBool(ta.requiredDuringRepairs),
    tempAccomRepairsEstimateDays: asStr(ta.repairsEstimateDays),
    workWhileInAccommodation: asStr(ta.workWhileInAccommodation),
  };
}

export function AssessmentAccommodationDrawer({
  open,
  onOpenChange,
  assessmentId,
  companionChatOpen,
  initialData,
}: AssessmentAccommodationDrawerProps) {
  const router = useRouter();
  const [form, setForm] = useState<AccommodationFormData>(
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

  const update = <K extends keyof AccommodationFormData>(key: K, value: AccommodationFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
      const required =
        form.tempAccomRequiredImmediately || form.tempAccomRequiredDuringRepairs
          ? 'Yes, Temporary Accommodation'
          : 'No';
      const durationDays =
        form.tempAccomRepairsEstimateDays || form.tempAccomImmediateEstimateDays;
      await updateAssessmentAction(assessmentId, {
        temporaryAccommodation: {
          required,
          requiredImmediately: form.tempAccomRequiredImmediately,
          immediateEstimateDays: form.tempAccomImmediateEstimateDays
            ? parseInt(form.tempAccomImmediateEstimateDays, 10)
            : undefined,
          tempRepairsToMakeLivable: form.tempRepairsToMakeLivable || undefined,
          requiredDuringRepairs: form.tempAccomRequiredDuringRepairs,
          repairsEstimateDays: form.tempAccomRepairsEstimateDays
            ? parseInt(form.tempAccomRepairsEstimateDays, 10)
            : undefined,
          workWhileInAccommodation: form.workWhileInAccommodation || undefined,
          estimatedDuration: durationDays ? `${durationDays} Days` : undefined,
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
      title="Temporary Accommodation"
      description="Capture temporary accommodation needs for the insured."
      icon={<Home className="h-5 w-5" />}
      widthClassName="w-[50%]"
      companionChatOpen={companionChatOpen}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="ta-immediate"
                checked={form.tempAccomRequiredImmediately}
                onCheckedChange={(v) => update('tempAccomRequiredImmediately', !!v)}
              />
              <Label htmlFor="ta-immediate" className="cursor-pointer font-normal">
                Is temporary accommodation required immediately?
              </Label>
            </div>

            {form.tempAccomRequiredImmediately && (
              <div className="space-y-2 pl-7">
                <Label>Estimated time for immediate temporary accommodation (days)</Label>
                <Input
                  type="number"
                  value={form.tempAccomImmediateEstimateDays}
                  onChange={(e) => update('tempAccomImmediateEstimateDays', e.target.value)}
                  placeholder="0"
                  className="w-40"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ta-temp-repairs">What temporary repairs are required to make home livable?</Label>
              <Textarea
                id="ta-temp-repairs"
                value={form.tempRepairsToMakeLivable}
                onChange={(e) => update('tempRepairsToMakeLivable', e.target.value)}
                placeholder="Describe temporary repairs needed..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="ta-during-repairs"
                checked={form.tempAccomRequiredDuringRepairs}
                onCheckedChange={(v) => update('tempAccomRequiredDuringRepairs', !!v)}
              />
              <Label htmlFor="ta-during-repairs" className="cursor-pointer font-normal">
                Is temporary accommodation required during repairs?
              </Label>
            </div>

            {form.tempAccomRequiredDuringRepairs && (
              <div className="space-y-2 pl-7">
                <Label>Estimated time for temp accommodation during repairs (days)</Label>
                <Input
                  type="number"
                  value={form.tempAccomRepairsEstimateDays}
                  onChange={(e) => update('tempAccomRepairsEstimateDays', e.target.value)}
                  placeholder="0"
                  className="w-40"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ta-work-scope">Work to be completed when insured is in accommodation</Label>
              <Textarea
                id="ta-work-scope"
                value={form.workWhileInAccommodation}
                onChange={(e) => update('workWhileInAccommodation', e.target.value)}
                placeholder="Describe work scope..."
                rows={3}
              />
            </div>
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
