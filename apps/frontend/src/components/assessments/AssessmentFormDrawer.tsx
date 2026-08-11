'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { JobSelectField } from '@/components/forms/JobSelectField';
import {
  CreateSubmitOverlay,
  navigateToCreated,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import type { JobOption } from '@/components/shared/job-label';
import type { Assessment } from '@/types/api';

export interface AssessmentFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createAssessment: (data: Partial<Assessment> & { name: string }) => Promise<Assessment | null>;
  onCreated?: (assessment: Assessment) => void;
  jobId?: string | null;
  jobs?: JobOption[];
}

const CLAIM_RECOMMENDATIONS = ['Approve', 'Decline', 'Refer', 'Pending'];
const MAKE_SAFE_TYPES = ['Tarp', 'Board Up', 'Temporary Fence', 'Other'];
const DESIGN_TYPES = ['Standard', 'Custom', 'Heritage', 'Multi-storey'];
const CONSTRUCTION_TYPES = ['Brick Veneer', 'Double Brick', 'Weatherboard', 'Fibro', 'Concrete', 'Steel Frame', 'Other'];
const ROOF_TYPES = ['Tile', 'Metal', 'Slate', 'Flat', 'Colorbond', 'Other'];
const BUILDING_TYPES = ['House', 'Unit', 'Townhouse', 'Duplex', 'Commercial', 'Other'];

function setSelectValue(setter: (v: string) => void) {
  return (v: string | null) => setter(v ?? '');
}

export function AssessmentFormDrawer({
  open,
  onOpenChange,
  createAssessment,
  onCreated,
  jobId,
  jobs = [],
}: AssessmentFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [selectedJobId, setSelectedJobId] = useState(jobId ?? '');
  const [name, setName] = useState('');
  const [claimRecommendation, setClaimRecommendation] = useState('');
  const [makeSafe, setMakeSafe] = useState(false);
  const [makeSafeType, setMakeSafeType] = useState('');
  const [designType, setDesignType] = useState('');
  const [construction, setConstruction] = useState('');
  const [roofType, setRoofType] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedJobId(jobId ?? '');
    }
  }, [open, jobId]);

  const resetForm = () => {
    setSelectedJobId(jobId ?? '');
    setName('');
    setClaimRecommendation('');
    setMakeSafe(false);
    setMakeSafeType('');
    setDesignType('');
    setConstruction('');
    setRoofType('');
    setBuildingType('');
    setComments('');
    setError(null);
    resetPhase();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return;
    if (!next) resetForm();
    onOpenChange(next);
  };

  const canSubmit = Boolean(selectedJobId.trim() && name.trim()) && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId.trim()) {
      setError('Job is required');
      return;
    }
    if (!name.trim()) {
      setError('Assessment name is required');
      return;
    }

    startCreating();
    setError(null);
    try {
      const assessment = await createAssessment({
        name: name.trim(),
        jobId: selectedJobId,
        recommendation: {
          ...(claimRecommendation ? { claimRecommendation } : {}),
          ...(comments.trim() ? { specialNotes: comments.trim() } : {}),
        },
        makeSafe: {
          makeSafeRequired: makeSafe,
          ...(makeSafeType ? { makeSafeType } : {}),
        },
        building: {
          ...(designType ? { designType } : {}),
          ...(construction ? { constructionType: construction } : {}),
          ...(roofType ? { roofType } : {}),
          ...(buildingType ? { buildingType } : {}),
        },
      });

      if (!assessment) {
        setError('Failed to create assessment');
        resetPhase();
        return;
      }

      onCreated?.(assessment);
      startOpening();
      navigateToCreated(router, `/assessments/${assessment.id}`);
    } catch (err) {
      console.error('AssessmentFormDrawer.handleSubmit:', err);
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
      resetPhase();
    }
  };

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Create Assessment"
      description="Create a new site assessment for an insurance claim job."
      icon={<ClipboardList className="h-5 w-5" />}
      widthClassName="w-[60%]"
      preventClose={busy}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <JobSelectField
              jobs={jobs}
              value={selectedJobId}
              onValueChange={setSelectedJobId}
            />

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="assessment-name">
                Assessment Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="assessment-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Initial Site Assessment"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Claim Recommendation</Label>
              <Select value={claimRecommendation} onValueChange={setSelectValue(setClaimRecommendation)}>
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
              <Select value={designType} onValueChange={setSelectValue(setDesignType)}>
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
              <Select value={construction} onValueChange={setSelectValue(setConstruction)}>
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
              <Select value={roofType} onValueChange={setSelectValue(setRoofType)}>
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
              <Select value={buildingType} onValueChange={setSelectValue(setBuildingType)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {BUILDING_TYPES.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2 pb-1">
              <Checkbox id="make-safe" checked={makeSafe} onCheckedChange={(v) => setMakeSafe(!!v)} />
              <Label htmlFor="make-safe" className="font-normal">Make Safe Required</Label>
            </div>

            {makeSafe && (
              <div className="space-y-2">
                <Label>Make Safe Type</Label>
                <Select value={makeSafeType} onValueChange={setSelectValue(setMakeSafeType)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {MAKE_SAFE_TYPES.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="assessment-comments">Comments</Label>
              <Textarea
                id="assessment-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Any initial notes..."
                rows={3}
              />
            </div>
          </div>

          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-w-36 px-8"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="min-w-36 px-8"
            disabled={!canSubmit}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === 'opening' ? 'Opening…' : 'Creating…'}
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
    <CreateSubmitOverlay phase={phase} entityLabel="assessment" />
    </>
  );
}
