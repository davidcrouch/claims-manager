'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { updateAssessmentAction } from '@/app/(app)/assessments/actions';
import type { Assessment } from '@/types/api';

export interface AssessmentGeneralDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId?: string;
  companionChatOpen?: boolean;
  aiAssistEnabled?: boolean;
  initialData?: Partial<Assessment>;
}

interface GeneralFormData {
  makeSafeCompletionDate: string;
  dateMainRoofRepaired: string;
  mainRoofDamage: boolean;
  habitable: boolean;
  mould: boolean;
  asbestosOnSite: boolean;
  detachedGarage: boolean;
  sheds: boolean;
  swimmingPool: boolean;
  detachedGrannyFlat: boolean;
  damageCausedByListedEvent: boolean;
}

function emptyForm(): GeneralFormData {
  return {
    makeSafeCompletionDate: '',
    dateMainRoofRepaired: '',
    mainRoofDamage: false,
    habitable: false,
    mould: false,
    asbestosOnSite: false,
    detachedGarage: false,
    sheds: false,
    swimmingPool: false,
    detachedGrannyFlat: false,
    damageCausedByListedEvent: false,
  };
}

function fromAssessment(data: Partial<Assessment>): GeneralFormData {
  return {
    makeSafeCompletionDate: data.makeSafeCompletionDate ?? '',
    dateMainRoofRepaired: data.dateMainRoofRepaired ?? '',
    mainRoofDamage: data.mainRoofDamage ?? false,
    habitable: data.habitable ?? false,
    mould: data.mould ?? false,
    asbestosOnSite: data.asbestosOnSite ?? false,
    detachedGarage: data.detachedGarage ?? false,
    sheds: data.sheds ?? false,
    swimmingPool: data.swimmingPool ?? false,
    detachedGrannyFlat: data.detachedGrannyFlat ?? false,
    damageCausedByListedEvent: data.damageCausedByListedEvent ?? false,
  };
}

export function AssessmentGeneralDrawer({
  open,
  onOpenChange,
  assessmentId,
  companionChatOpen,
  initialData,
}: AssessmentGeneralDrawerProps) {
  const router = useRouter();
  const [form, setForm] = useState<GeneralFormData>(
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

  const update = <K extends keyof GeneralFormData>(key: K, value: GeneralFormData[K]) => {
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
        makeSafeCompletionDate: form.makeSafeCompletionDate || null,
        dateMainRoofRepaired: form.dateMainRoofRepaired || null,
        mainRoofDamage: form.mainRoofDamage,
        habitable: form.habitable,
        mould: form.mould,
        asbestosOnSite: form.asbestosOnSite,
        detachedGarage: form.detachedGarage,
        sheds: form.sheds,
        swimmingPool: form.swimmingPool,
        detachedGrannyFlat: form.detachedGrannyFlat,
        damageCausedByListedEvent: form.damageCausedByListedEvent,
      });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const checks: Array<{ id: string; key: keyof GeneralFormData; label: string }> = [
    { id: 'gd-roof-damage', key: 'mainRoofDamage', label: 'Main Roof Damage' },
    { id: 'gd-habitable', key: 'habitable', label: 'Habitable' },
    { id: 'gd-mould', key: 'mould', label: 'Mould' },
    { id: 'gd-asbestos', key: 'asbestosOnSite', label: 'Asbestos on Site' },
    { id: 'gd-garage', key: 'detachedGarage', label: 'Detached Garage' },
    { id: 'gd-sheds', key: 'sheds', label: 'Sheds' },
    { id: 'gd-pool', key: 'swimmingPool', label: 'Swimming Pool' },
    { id: 'gd-granny', key: 'detachedGrannyFlat', label: 'Detached Granny Flat' },
    { id: 'gd-listed-event', key: 'damageCausedByListedEvent', label: 'Damage Caused by Listed Event' },
  ];

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="General Questions"
      description="Update the general inspection findings for this assessment."
      icon={<ClipboardCheck className="h-5 w-5" />}
      widthClassName="w-[50%]"
      companionChatOpen={companionChatOpen}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Make-safe Completion Date</Label>
              <Input type="date" value={form.makeSafeCompletionDate} onChange={(e) => update('makeSafeCompletionDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date Main Roof Repaired</Label>
              <Input type="date" value={form.dateMainRoofRepaired} onChange={(e) => update('dateMainRoofRepaired', e.target.value)} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5">
                <Checkbox id={c.id} checked={form[c.key] as boolean} onCheckedChange={(v) => update(c.key, !!v)} />
                <Label htmlFor={c.id} className="cursor-pointer font-normal">{c.label}</Label>
              </div>
            ))}
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
