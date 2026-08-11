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
import {
  additionalStructuresFromFlags,
  asBool,
  asStr,
  flagsFromAdditionalStructures,
  isAssessmentLocked,
  sectionDict,
} from '../assessment-sections';
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
  const ms = sectionDict(data, 'makeSafe');
  const bld = sectionDict(data, 'building');
  const hab = sectionDict(data, 'habitability');
  const haz = sectionDict(data, 'hazards');
  const dmg = sectionDict(data, 'damage');
  const extras = sectionDict(data, 'extras');
  const structures = flagsFromAdditionalStructures(bld.additionalStructures);
  return {
    makeSafeCompletionDate: asStr(ms.dateMakeSafeCompleted).slice(0, 10),
    dateMainRoofRepaired: asStr(ms.dateMainRoofRepaired).slice(0, 10),
    mainRoofDamage: asBool(bld.mainHouseRoofDamage),
    habitable: asBool(hab.habitable),
    mould:
      extras.mould === true || asStr(haz.environmentalHazards).toLowerCase().includes('mould'),
    asbestosOnSite:
      extras.asbestosOnSite === true ||
      asStr(haz.safetyHazards).toLowerCase().includes('asbestos'),
    detachedGarage: structures.detachedGarage,
    sheds: structures.sheds,
    swimmingPool: structures.swimmingPool,
    detachedGrannyFlat: structures.detachedGrannyFlat,
    damageCausedByListedEvent:
      dmg.hasDamageCoveredByPolicy === true ||
      asStr(dmg.hasDamageCoveredByPolicy).toLowerCase() === 'yes',
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
    if (isAssessmentLocked(initialData?.status)) {
      setError('This assessment has been published and cannot be edited');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const existingHaz = sectionDict(initialData, 'hazards');
      await updateAssessmentAction(assessmentId, {
        makeSafe: {
          dateMakeSafeCompleted: form.makeSafeCompletionDate || undefined,
          dateMainRoofRepaired: form.dateMainRoofRepaired || undefined,
        },
        building: {
          mainHouseRoofDamage: form.mainRoofDamage,
          additionalStructures: additionalStructuresFromFlags(form) || undefined,
        },
        habitability: {
          habitable: form.habitable,
        },
        hazards: {
          environmentalHazards: form.mould
            ? [asStr(existingHaz.environmentalHazards), 'Mould'].filter(Boolean).join('; ') || 'Mould'
            : existingHaz.environmentalHazards,
          safetyHazards: form.asbestosOnSite
            ? [asStr(existingHaz.safetyHazards), 'Asbestos'].filter(Boolean).join('; ') || 'Asbestos'
            : existingHaz.safetyHazards,
        },
        damage: {
          hasDamageCoveredByPolicy: form.damageCausedByListedEvent ? 'Yes' : 'No',
        },
        extras: {
          mould: form.mould,
          asbestosOnSite: form.asbestosOnSite,
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
          <Button type="submit" size="lg" className="min-w-36 px-8" disabled={submitting || isAssessmentLocked(initialData?.status)}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
