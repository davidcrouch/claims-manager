'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  Home,
  ShieldAlert,
  Stethoscope,
  Users,
  Wrench,
} from 'lucide-react';
import { HeaderActionToolbar } from '@/components/layout/HeaderActionToolbar';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { HeaderSaveStatus } from '@/components/shared/HeaderSaveStatus';
import {
  AUTOSAVE_DEBOUNCE_MS,
  SAVE_STATUS_CLEAR_MS,
  cloneJson,
} from '@/components/shared/detail-autosave';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import {
  DetailAssignee,
  resolveDetailAssignee,
} from '@/components/shared/DetailAssignee';
import { PrintButton } from '@/components/shared/PrintButton';
import { updateAssessmentAction } from '@/app/(app)/assessments/actions';
import {
  ASSESSMENT_SECTIONS,
  isAssessmentLocked,
  sectionsFromAssessment,
  type AssessmentSections,
} from './assessment-sections';
import {
  AttendanceTabForm,
  BuildingTabForm,
  HabitabilityTabForm,
  HazardsTabForm,
  DamageTabForm,
  MakeSafeTabForm,
  TempAccommodationTabForm,
  SpecialistsTabForm,
  RecommendationTabForm,
} from './tabs';
import type { Assessment, AssessmentSectionKey, Claim, Job } from '@/types/api';

export interface AssessmentDetailClientProps {
  assessment: Assessment;
  job?: Job | null;
  claim?: Claim | null;
}

const VALID_TABS = [
  'attendance',
  'building',
  'habitability',
  'hazards',
  'damage',
  'makeSafe',
  'temporaryAccommodation',
  'specialists',
  'recommendation',
] as const;

type TabValue = (typeof VALID_TABS)[number];

function normaliseTab(raw: string | null): TabValue {
  if (!raw) return 'attendance';
  return VALID_TABS.find((t) => t === raw) ?? 'attendance';
}

const DETAIL_TABS: Array<{ id: TabValue; label: string; icon: typeof Building2 }> = [
  { id: 'attendance', label: 'Attendance', icon: Users },
  { id: 'building', label: 'Building', icon: Building2 },
  { id: 'habitability', label: 'Habitability', icon: Home },
  { id: 'hazards', label: 'Hazards', icon: AlertTriangle },
  { id: 'damage', label: 'Damage & Cause', icon: ShieldAlert },
  { id: 'makeSafe', label: 'Make Safe', icon: Wrench },
  { id: 'temporaryAccommodation', label: 'Temp Accommodation', icon: Home },
  { id: 'specialists', label: 'Specialists', icon: Stethoscope },
  { id: 'recommendation', label: 'Recommendation', icon: ClipboardCheck },
];

export function AssessmentDetailClient({ assessment, job }: AssessmentDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = normaliseTab(searchParams.get('tab'));
  const [sections, setSections] = useState<AssessmentSections>(() =>
    sectionsFromAssessment(assessment),
  );
  const [baseline, setBaseline] = useState<AssessmentSections>(() =>
    cloneJson(sectionsFromAssessment(assessment)),
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const locked = isAssessmentLocked(assessment.status);
  const assignee = resolveDetailAssignee({ job });
  const dirty =
    !locked && JSON.stringify(sections) !== JSON.stringify(baseline);

  const onTabChange = useCallback(
    (value: TabValue) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value === 'attendance') sp.delete('tab');
      else sp.set('tab', value);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const next = sectionsFromAssessment(assessment);
    setSections(next);
    setBaseline(cloneJson(next));
    setSaveError(null);
    setJustSaved(false);
  }, [assessment.id]);

  const setKey = useCallback(
    (section: AssessmentSectionKey, key: string, value: unknown) => {
      if (locked) return;
      setSections((prev) => ({
        ...prev,
        [section]: { ...prev[section], [key]: value },
      }));
      setJustSaved(false);
    },
    [locked],
  );

  const persistForm = useCallback(async (): Promise<boolean> => {
    if (locked || saveInFlightRef.current) return false;
    const current = sectionsRef.current;
    saveInFlightRef.current = true;
    setSaving(true);
    setJustSaved(false);
    setSaveError(null);
    try {
      const payload: Partial<Assessment> = { name: assessment.name };
      for (const key of ASSESSMENT_SECTIONS) {
        payload[key] = current[key];
      }
      await updateAssessmentAction(assessment.id, payload);
      setBaseline(cloneJson(current));
      setJustSaved(true);
      router.refresh();
      return true;
    } catch (err) {
      console.error('[frontend:AssessmentDetailClient.persistForm]', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save assessment');
      return false;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [assessment.id, assessment.name, locked, router]);

  useEffect(() => {
    if (!dirty || saving || locked) return;
    const timer = setTimeout(() => {
      void persistForm();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dirty, saving, locked, persistForm, sections]);

  useEffect(() => {
    if (!justSaved || dirty || saving || saveError) return;
    const timer = setTimeout(() => setJustSaved(false), SAVE_STATUS_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [justSaved, dirty, saving, saveError]);

  const attData = {
    ...sections.attendance,
    builderEstimatorName:
      sections.attendance.builderEstimatorName || (job?.assigneeName ?? ''),
  };

  return (
    <div className="flex flex-col">
      {!locked && (
        <HeaderSaveStatus
          saving={saving}
          saveError={saveError}
          justSaved={justSaved}
          dirty={dirty}
        />
      )}
      <SetHeaderActions>
        <HeaderActionToolbar>
          <PrintButton
            documentType="assessment"
            entityId={assessment.id}
            jobId={assessment.jobId ?? undefined}
          />
          <ArchiveEntityButton
            entityType="assessment"
            entityId={assessment.id}
            statusName={assessment.status}
            entityLabel={assessment.name}
            redirectTo="/assessments"
          />
        </HeaderActionToolbar>
      </SetHeaderActions>

      <div className="flex w-full flex-wrap items-center gap-x-4 border-b border-slate-200">
        <div className="flex min-w-0 flex-1 flex-wrap gap-0">
          {DETAIL_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`-mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-600'
                    : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <DetailAssignee
          assigneeName={assignee.assigneeName}
          assignedToUserId={assignee.assignedToUserId}
          fromJob={assignee.fromJob}
          createdByUserId={assessment.createdByUserId}
          updatedByUserId={assessment.updatedByUserId}
          provider={job?.provider}
        />
      </div>

      <div className="pt-4 pb-12">
        {locked && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            This assessment has been published and can no longer be edited.
          </div>
        )}
        {activeTab === 'attendance' && (
          <AttendanceTabForm data={attData} onChange={(k, v) => setKey('attendance', k, v)} locked={locked} />
        )}
        {activeTab === 'building' && (
          <BuildingTabForm data={sections.building} onChange={(k, v) => setKey('building', k, v)} locked={locked} />
        )}
        {activeTab === 'habitability' && (
          <HabitabilityTabForm data={sections.habitability} onChange={(k, v) => setKey('habitability', k, v)} locked={locked} />
        )}
        {activeTab === 'hazards' && (
          <HazardsTabForm data={sections.hazards} onChange={(k, v) => setKey('hazards', k, v)} locked={locked} />
        )}
        {activeTab === 'damage' && (
          <DamageTabForm data={sections.damage} onChange={(k, v) => setKey('damage', k, v)} locked={locked} />
        )}
        {activeTab === 'makeSafe' && (
          <MakeSafeTabForm data={sections.makeSafe} onChange={(k, v) => setKey('makeSafe', k, v)} locked={locked} />
        )}
        {activeTab === 'temporaryAccommodation' && (
          <TempAccommodationTabForm data={sections.temporaryAccommodation} onChange={(k, v) => setKey('temporaryAccommodation', k, v)} locked={locked} />
        )}
        {activeTab === 'specialists' && (
          <SpecialistsTabForm data={sections.specialists} onChange={(k, v) => setKey('specialists', k, v)} locked={locked} />
        )}
        {activeTab === 'recommendation' && (
          <RecommendationTabForm data={sections.recommendation} onChange={(k, v) => setKey('recommendation', k, v)} locked={locked} />
        )}
      </div>
    </div>
  );
}
