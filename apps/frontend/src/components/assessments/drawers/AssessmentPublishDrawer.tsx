'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { formatDate } from '@/components/shared/detail';
import {
  PublishEntityContext,
  PublishSummaryCard,
  PublishSummaryRow,
} from '@/components/shared/PublishEntityContext';
import {
  publishAssessmentAction,
  validateAssessmentAction,
} from '@/app/(app)/assessments/actions';
import { asBool, asStr, sectionDict } from '../assessment-sections';
import type { Assessment, Claim, Job } from '@/types/api';

export interface AssessmentPublishDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: Assessment;
  job?: Job | null;
  claim?: Claim | null;
}

function yesNo(value: boolean | null | undefined): string {
  return value ? 'Yes' : 'No';
}

export function AssessmentPublishDrawer({
  open,
  onOpenChange,
  assessment,
  job,
  claim,
}: AssessmentPublishDrawerProps) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const reset = useCallback(() => {
    setPublishing(false);
    setValidating(false);
    setError(null);
    setValidationErrors([]);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    let cancelled = false;
    setValidating(true);
    setError(null);
    validateAssessmentAction(assessment.id)
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setError(result.error);
          setValidationErrors([]);
          return;
        }
        setValidationErrors(result.errors);
      })
      .finally(() => {
        if (!cancelled) setValidating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, assessment.id, reset]);

  function handleOpenChange(next: boolean) {
    if (publishing) return;
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleConfirm() {
    setPublishing(true);
    setError(null);
    try {
      const result = await publishAssessmentAction(assessment.id);
      if (!result.success) {
        setError(result.error ?? 'Failed to publish field assessment to NRMA');
        return;
      }
      toast.success('Field assessment sent to NRMA');
      onOpenChange(false);
      reset();
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  const rec = sectionDict(assessment, 'recommendation');
  const bld = sectionDict(assessment, 'building');
  const hab = sectionDict(assessment, 'habitability');
  const ms = sectionDict(assessment, 'makeSafe');
  const att = sectionDict(assessment, 'attendance');
  const dmg = sectionDict(assessment, 'damage');
  const ta = sectionDict(assessment, 'temporaryAccommodation');
  const sp = sectionDict(assessment, 'specialists');
  const tempRequired =
    asStr(ta.required).startsWith('Yes') ||
    asBool(ta.requiredImmediately) ||
    asBool(ta.requiredDuringRepairs);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Publish field assessment"
      description="Review the claim, job, and assessment summary, then send this field assessment to NRMA."
      icon={<Shield className="h-5 w-5 text-amber-600" />}
      preventClose={publishing}
    >
      <BottomFormDrawerBody>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            <p className="font-medium">This will be pushed to NRMA</p>
            <p className="mt-2 text-amber-900/80">
              Submitting creates a Field Assessment report in Crunchwork for NRMA. The
              assessment status will change to Published. This cannot be undone from this screen.
            </p>
          </div>

          {validating && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking required Field Assessment fields…
            </p>
          )}

          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <p className="font-medium">Missing or invalid fields</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {validationErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <PublishEntityContext job={job} claim={claim} />

          <PublishSummaryCard title="Assessment summary">
            <PublishSummaryRow label="Name" value={assessment.name} />
            <PublishSummaryRow label="Status" value={assessment.status} />
            <PublishSummaryRow
              label="Recommendation"
              value={asStr(rec.claimRecommendation) || '—'}
            />
            <PublishSummaryRow label="Building type" value={asStr(bld.buildingType) || '—'} />
            <PublishSummaryRow label="Habitable" value={yesNo(asBool(hab.habitable))} />
            <PublishSummaryRow label="Make safe" value={yesNo(asBool(ms.makeSafeRequired))} />
            <PublishSummaryRow
              label="Site attendance"
              value={
                att.siteAttendanceDate ? formatDate(asStr(att.siteAttendanceDate)) : '—'
              }
            />
            <PublishSummaryRow label="Cause of damage" value={asStr(dmg.causeOfDamage) || '—'} />
            <PublishSummaryRow
              label="Temp accommodation"
              value={tempRequired ? 'Required' : 'Not required'}
            />
            <PublishSummaryRow
              label="Specialist"
              value={yesNo(asBool(sp.specialistRequired) || asBool(att.insuranceAssessorAttended))}
            />
          </PublishSummaryCard>
        </div>

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={publishing}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={publishing || validating || !assessment.jobId}
          onClick={() => void handleConfirm()}
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          {publishing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {publishing ? 'Sending to NRMA…' : 'Submit to NRMA'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
