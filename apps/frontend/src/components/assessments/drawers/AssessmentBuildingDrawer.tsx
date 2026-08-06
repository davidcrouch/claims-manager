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
import type { Assessment } from '@/types/api';

const CLAIM_RECOMMENDATIONS = ['Approve', 'Decline', 'Refer', 'Pending'];
const MAKE_SAFE_TYPES = ['Tarp', 'Board Up', 'Temporary Fence', 'Other'];
const DESIGN_TYPES = ['Standard', 'Custom', 'Heritage', 'Multi-storey'];
const CONSTRUCTION_TYPES = ['Brick Veneer', 'Double Brick', 'Weatherboard', 'Fibro', 'Concrete', 'Steel Frame', 'Other'];
const ROOF_TYPES = ['Tile', 'Metal', 'Slate', 'Flat', 'Colorbond', 'Other'];
const BUILDING_TYPES = ['House', 'Unit', 'Townhouse', 'Duplex', 'Commercial', 'Other'];

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
  return {
    claimRecommendation: data.claimRecommendation ?? '',
    designType: data.designType ?? '',
    construction: data.construction ?? '',
    roofType: data.roofType ?? '',
    buildingType: data.buildingType ?? '',
    makeSafeType: data.makeSafeType ?? '',
    squares: data.squares ?? '',
    buildingAge: data.buildingAge != null ? String(data.buildingAge) : '',
    squareMetres: data.squareMetres ?? '',
    dateBooked: data.dateBooked ?? '',
    makeSafe: data.makeSafe ?? false,
    overallConditionAcceptable: data.overallConditionAcceptable ?? false,
    iagInspectionRequired: data.iagInspectionRequired ?? false,
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
    setSubmitting(true);
    setError(null);
    try {
      await updateAssessmentAction(assessmentId, {
        claimRecommendation: form.claimRecommendation || null,
        designType: form.designType || null,
        construction: form.construction || null,
        roofType: form.roofType || null,
        buildingType: form.buildingType || null,
        makeSafeType: form.makeSafeType || null,
        squares: form.squares || null,
        buildingAge: form.buildingAge ? parseInt(form.buildingAge, 10) : null,
        squareMetres: form.squareMetres || null,
        dateBooked: form.dateBooked || null,
        makeSafe: form.makeSafe,
        overallConditionAcceptable: form.overallConditionAcceptable,
        iagInspectionRequired: form.iagInspectionRequired,
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
          <Button type="submit" size="lg" className="min-w-36 px-8" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
