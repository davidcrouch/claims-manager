'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { updateAssessmentAction } from '@/app/(app)/assessments/actions';
import {
  BUILDING_TYPES,
  CLAIM_RECOMMENDATIONS,
  CONSTRUCTION_TYPES,
  DESIGN_TYPES,
  MAKE_SAFE_TYPES,
  ROOF_TYPES,
  asBool,
  asStr,
  isAssessmentLocked,
  sectionDict,
} from '../assessment-sections';
import type { Assessment } from '@/types/api';

export interface AssessmentBuildingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId?: string;
  companionChatOpen?: boolean;
  aiAssistEnabled?: boolean;
  initialData?: Partial<Assessment>;
}

interface BuildingFormData {
  claimRecommendation: string;
  designType: string;
  construction: string;
  roofType: string;
  buildingType: string;
  makeSafeType: string;
  squares: string;
  buildingAge: string;
  squareMetres: string;
  dateBooked: string;
  makeSafe: boolean;
  overallConditionAcceptable: boolean;
  iagInspectionRequired: boolean;
}

function emptyForm(): BuildingFormData {
  return {
    claimRecommendation: '',
    designType: '',
    construction: '',
    roofType: '',
    buildingType: '',
    makeSafeType: '',
    squares: '',
    buildingAge: '',
    squareMetres: '',
    dateBooked: '',
    makeSafe: false,
    overallConditionAcceptable: false,
    iagInspectionRequired: false,
  };
}

function fromAssessment(data: Partial<Assessment>): BuildingFormData {
  const bld = sectionDict(data, 'building');
  const rec = sectionDict(data, 'recommendation');
  const ms = sectionDict(data, 'makeSafe');
  const att = sectionDict(data, 'attendance');
  return {
    claimRecommendation: asStr(rec.claimRecommendation),
    designType: asStr(bld.designType),
    construction: asStr(bld.constructionType),
    roofType: asStr(bld.roofType),
    buildingType: asStr(bld.buildingType),
    makeSafeType: asStr(ms.makeSafeType),
    squares: asStr(bld.squares),
    buildingAge: asStr(bld.estimatedBuildYear),
    squareMetres: asStr(bld.houseM2),
    dateBooked: asStr(att.siteAttendanceDate).slice(0, 10),
    makeSafe: asBool(ms.makeSafeRequired),
    overallConditionAcceptable: asBool(bld.propertyCondition),
    iagInspectionRequired: asBool(att.insuranceAssessorAttended),
  };
}

export function AssessmentBuildingDrawer({
  open,
  onOpenChange,
  assessmentId,
  companionChatOpen,
  initialData,
}: AssessmentBuildingDrawerProps) {
  const router = useRouter();
  const [form, setForm] = useState<BuildingFormData>(
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

  const update = <K extends keyof BuildingFormData>(key: K, value: BuildingFormData[K]) => {
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
      await updateAssessmentAction(assessmentId, {
        recommendation: {
          claimRecommendation: form.claimRecommendation || undefined,
        },
        building: {
          designType: form.designType || undefined,
          constructionType: form.construction || undefined,
          roofType: form.roofType || undefined,
          buildingType: form.buildingType || undefined,
          squares: form.squares || undefined,
          estimatedBuildYear: form.buildingAge || undefined,
          houseM2: form.squareMetres ? Number(form.squareMetres) : undefined,
          propertyCondition: form.overallConditionAcceptable,
        },
        makeSafe: {
          makeSafeType: form.makeSafeType || undefined,
          makeSafeRequired: form.makeSafe,
        },
        attendance: {
          siteAttendanceDate: form.dateBooked || undefined,
          insuranceAssessorAttended: form.iagInspectionRequired,
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
      title="Building Structure"
      description="Update the building structure details for this assessment."
      icon={<Building2 className="h-5 w-5" />}
      widthClassName="w-[55%]"
      companionChatOpen={companionChatOpen}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Claim Recommendation</Label>
              <Select value={form.claimRecommendation || undefined} onValueChange={(v) => update('claimRecommendation', v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CLAIM_RECOMMENDATIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Design Type</Label>
              <Select value={form.designType || undefined} onValueChange={(v) => update('designType', v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {DESIGN_TYPES.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Construction</Label>
              <Select value={form.construction || undefined} onValueChange={(v) => update('construction', v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CONSTRUCTION_TYPES.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Roof Type</Label>
              <Select value={form.roofType || undefined} onValueChange={(v) => update('roofType', v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {ROOF_TYPES.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Building Type</Label>
              <Select value={form.buildingType || undefined} onValueChange={(v) => update('buildingType', v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {BUILDING_TYPES.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Make Safe Type</Label>
              <Select value={form.makeSafeType || undefined} onValueChange={(v) => update('makeSafeType', v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {MAKE_SAFE_TYPES.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Squares</Label>
              <Input type="number" value={form.squares} onChange={(e) => update('squares', e.target.value)} placeholder="0" />
            </div>

            <div className="space-y-2">
              <Label>Building Age (years)</Label>
              <Input type="number" value={form.buildingAge} onChange={(e) => update('buildingAge', e.target.value)} placeholder="0" />
            </div>

            <div className="space-y-2">
              <Label>Square Metres</Label>
              <Input type="number" value={form.squareMetres} onChange={(e) => update('squareMetres', e.target.value)} placeholder="0" />
            </div>

            <div className="space-y-2">
              <Label>Date Booked</Label>
              <Input type="date" value={form.dateBooked} onChange={(e) => update('dateBooked', e.target.value)} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2.5">
              <Checkbox id="bd-make-safe" checked={form.makeSafe} onCheckedChange={(v) => update('makeSafe', !!v)} />
              <Label htmlFor="bd-make-safe" className="cursor-pointer font-normal">Make Safe</Label>
            </div>
            <div className="flex items-center gap-2.5">
              <Checkbox id="bd-overall-cond" checked={form.overallConditionAcceptable} onCheckedChange={(v) => update('overallConditionAcceptable', !!v)} />
              <Label htmlFor="bd-overall-cond" className="cursor-pointer font-normal">Overall Condition Acceptable</Label>
            </div>
            <div className="flex items-center gap-2.5">
              <Checkbox id="bd-iag" checked={form.iagInspectionRequired} onCheckedChange={(v) => update('iagInspectionRequired', !!v)} />
              <Label htmlFor="bd-iag" className="cursor-pointer font-normal">IAG Inspection Required</Label>
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
