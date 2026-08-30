'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import {
  fetchAssessmentByIdAction,
  updateAssessmentAction,
} from '@/app/(app)/assessments/actions';
import { isAssessmentLocked, sectionDict } from '../assessment-sections';
import type { TabFormProps } from '../tabs';
import type { Assessment, AssessmentSectionKey } from '@/types/api';

export interface AssessmentTabDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId?: string;
  companionChatOpen?: boolean;
  /** AI-pushed field values, merged into form data. */
  [key: string]: unknown;
}

interface AssessmentTabDrawerConfig {
  sectionKey: AssessmentSectionKey;
  title: string;
  icon: ComponentType<{ className?: string }>;
  FormComponent: ComponentType<TabFormProps>;
}

const AI_FIELD_CHROME_KEYS = new Set([
  'aiAssistEnabled',
  'jobId',
  'claimId',
]);

/** Rest props excluding drawer chrome; used as an AI field payload. */
function collectAiFields(raw: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined && !AI_FIELD_CHROME_KEYS.has(k)) {
      filtered[k] = v;
    }
  }
  return filtered;
}

function snapshotAiFields(raw: Record<string, unknown>): string {
  try {
    return JSON.stringify(collectAiFields(raw));
  } catch {
    return '{}';
  }
}

function parseAiFieldsSnapshot(snapshot: string): Record<string, unknown> {
  if (!snapshot || snapshot === '{}') return {};
  try {
    return JSON.parse(snapshot) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function aiFieldsUnchanged(
  prev: Record<string, unknown>,
  incoming: Record<string, unknown>,
): boolean {
  for (const [k, v] of Object.entries(incoming)) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(v)) return false;
  }
  return true;
}

export function createAssessmentTabDrawer(config: AssessmentTabDrawerConfig) {
  const { sectionKey, title, icon: Icon, FormComponent } = config;

  function AssessmentTabDrawerInner({
    open,
    onOpenChange,
    assessmentId,
    companionChatOpen,
    ...aiFields
  }: AssessmentTabDrawerProps) {
    const router = useRouter();
    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [localData, setLocalData] = useState<Record<string, unknown>>({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Rest `aiFields` is a new object every render. Depend on a value snapshot so
    // this effect does not setState in a loop (max update depth).
    const aiFieldsSnapshot = snapshotAiFields(aiFields);
    const aiFieldsSnapshotRef = useRef(aiFieldsSnapshot);
    aiFieldsSnapshotRef.current = aiFieldsSnapshot;

    useEffect(() => {
      if (!open || !assessmentId) return;
      let cancelled = false;
      void (async () => {
        const result = await fetchAssessmentByIdAction(assessmentId);
        if (cancelled) return;
        setAssessment(result);
        if (result) {
          const overlay = parseAiFieldsSnapshot(aiFieldsSnapshotRef.current);
          setLocalData({ ...sectionDict(result, sectionKey), ...overlay });
        }
        setError(null);
      })();
      return () => { cancelled = true; };
    }, [open, assessmentId]);

    useEffect(() => {
      if (!open) return;
      const filtered = parseAiFieldsSnapshot(aiFieldsSnapshot);
      if (Object.keys(filtered).length === 0) return;
      setLocalData((prev) =>
        aiFieldsUnchanged(prev, filtered) ? prev : { ...prev, ...filtered },
      );
    }, [open, aiFieldsSnapshot]);

    const locked = isAssessmentLocked(assessment?.status);

    const handleChange = useCallback((key: string, value: unknown) => {
      setLocalData((prev) => (Object.is(prev[key], value) ? prev : { ...prev, [key]: value }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!assessmentId) {
        setError('No assessment ID provided');
        return;
      }
      if (locked) {
        setError('This assessment has been published and cannot be edited');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        await updateAssessmentAction(assessmentId, { [sectionKey]: localData });
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
        title={title}
        description={`Update the ${title.toLowerCase()} section for this assessment.`}
        icon={<Icon className="h-5 w-5" />}
        companionChatOpen={companionChatOpen}
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <BottomFormDrawerBody>
            <FormComponent data={localData} onChange={handleChange} locked={locked} />
            <BottomFormDrawerError error={error} />
          </BottomFormDrawerBody>
          <BottomFormDrawerFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-w-36 px-8"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="min-w-36 gap-1.5 px-8"
              disabled={submitting || locked}
            >
              <Save className="size-4" />
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </BottomFormDrawerFooter>
        </form>
      </BottomFormDrawer>
    );
  }

  AssessmentTabDrawerInner.displayName = `Assessment${title.replace(/\s+/g, '')}Drawer`;
  return AssessmentTabDrawerInner;
}
