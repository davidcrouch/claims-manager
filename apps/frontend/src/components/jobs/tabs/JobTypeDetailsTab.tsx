'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import type { Job } from '@/types/api';
import { getJobTypeKind } from '../util/jobType';
import type { JobEditPending, LookupOption } from '../job-edit.types';
import {
  TemporaryAccommodationPanel,
  buildTemporaryAccommodationPending,
  initialTemporaryAccommodationDraft,
  type TemporaryAccommodationDraft,
} from './JobTypePanels/TemporaryAccommodationPanel';
import {
  SpecialistPanel,
  buildSpecialistPending,
  initialSpecialistDraft,
  type SpecialistDraft,
} from './JobTypePanels/SpecialistPanel';
import {
  RectificationPanel,
  buildRectificationPending,
  initialRectificationDraft,
  type RectificationDraft,
} from './JobTypePanels/RectificationPanel';
import {
  InternalAuditPanel,
  buildInternalAuditPending,
  initialInternalAuditDraft,
  type InternalAuditDraft,
} from './JobTypePanels/InternalAuditPanel';
import { asBool, pick } from '@/components/shared/detail';
import { cloneJson } from '@/components/shared/detail-autosave';

export type JobTypeDetailsSnapshot = {
  ta: TemporaryAccommodationDraft;
  specialist: SpecialistDraft;
  rect: RectificationDraft;
  audit: InternalAuditDraft;
};

export interface JobTypeDetailsTabHandle {
  getPendingUpdate: () => Partial<JobEditPending> | null;
  getBaseline: () => JobTypeDetailsSnapshot;
  applyDraft: (snapshot: JobTypeDetailsSnapshot) => void;
  reset: () => void;
  markClean: () => void;
  isDirty: () => boolean;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function snapshotFromJob(job: Job, jobTypeOptions: LookupOption[]): JobTypeDetailsSnapshot {
  return {
    ta: initialTemporaryAccommodationDraft(job),
    specialist: initialSpecialistDraft(job),
    rect: initialRectificationDraft(job, jobTypeOptions),
    audit: initialInternalAuditDraft(job),
  };
}

export const JobTypeDetailsTab = forwardRef(function JobTypeDetailsTab(
  {
    job,
    editing = false,
    saving = false,
    jobTypeOptions = [],
    onDirtyChange,
  }: {
    job: Job;
    editing?: boolean;
    saving?: boolean;
    jobTypeOptions?: LookupOption[];
    onDirtyChange?: (dirty: boolean) => void;
  },
  ref: Ref<JobTypeDetailsTabHandle>,
) {
  const kind = getJobTypeKind(job);
  const jobIdRef = useRef(job.id);

  const [taDraft, setTaDraft] = useState(() => initialTemporaryAccommodationDraft(job));
  const [specialistDraft, setSpecialistDraft] = useState(() => initialSpecialistDraft(job));
  const [rectDraft, setRectDraft] = useState(() =>
    initialRectificationDraft(job, jobTypeOptions),
  );
  const [auditDraft, setAuditDraft] = useState(() => initialInternalAuditDraft(job));
  const [saved, setSaved] = useState<JobTypeDetailsSnapshot>(() =>
    snapshotFromJob(job, jobTypeOptions),
  );

  const isDirty =
    kind === 'temporary-accommodation'
      ? !sameJson(taDraft, saved.ta)
      : kind === 'specialist'
        ? !sameJson(specialistDraft, saved.specialist)
        : kind === 'rectification'
          ? !sameJson(rectDraft, saved.rect)
          : kind === 'internal-audit'
            ? !sameJson(auditDraft, saved.audit)
            : false;

  const applySnapshot = (next: JobTypeDetailsSnapshot) => {
    setTaDraft(next.ta);
    setSpecialistDraft(next.specialist);
    setRectDraft(next.rect);
    setAuditDraft(next.audit);
  };

  const reseed = (nextJob: Job, nextJobTypeOptions: LookupOption[]) => {
    const next = snapshotFromJob(nextJob, nextJobTypeOptions);
    applySnapshot(next);
    setSaved(next);
  };

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange, taDraft, specialistDraft, rectDraft, auditDraft]);

  useEffect(() => {
    if (job.id !== jobIdRef.current) {
      jobIdRef.current = job.id;
      reseed(job, jobTypeOptions);
      return;
    }
    if (isDirty) return;
    reseed(job, jobTypeOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when clean or job changes
  }, [job, jobTypeOptions]);

  useImperativeHandle(ref, () => ({
    getPendingUpdate: () => {
      if (!editing || !isDirty) return null;
      if (kind === 'temporary-accommodation') {
        return buildTemporaryAccommodationPending(taDraft);
      }
      if (kind === 'specialist') {
        const src = {
          ...((job.apiPayload as Record<string, unknown> | undefined) ?? {}),
          ...((job.specialistDetails as Record<string, unknown> | undefined) ?? {}),
        };
        const requiresSpecific = !!asBool(pick(src, 'isSpecificSpecialistRequired'));
        return buildSpecialistPending(specialistDraft, requiresSpecific);
      }
      if (kind === 'rectification') {
        return buildRectificationPending(rectDraft);
      }
      if (kind === 'internal-audit') {
        return buildInternalAuditPending(auditDraft);
      }
      return null;
    },
    getBaseline: () => cloneJson(saved),
    applyDraft: (snapshot) => {
      applySnapshot(snapshot);
    },
    reset: () => {
      applySnapshot(saved);
    },
    markClean: () => {
      setSaved({
        ta: taDraft,
        specialist: specialistDraft,
        rect: rectDraft,
        audit: auditDraft,
      });
    },
    isDirty: () => isDirty,
  }), [
    editing,
    kind,
    isDirty,
    taDraft,
    specialistDraft,
    rectDraft,
    auditDraft,
    saved,
    job,
  ]);

  const markDirty = <T,>(setter: (d: T) => void) => (draft: T) => {
    setter(draft);
  };

  switch (kind) {
    case 'temporary-accommodation':
      return (
        <TemporaryAccommodationPanel
          job={job}
          editing={editing}
          saving={saving}
          draft={taDraft}
          onDraftChange={markDirty(setTaDraft)}
        />
      );
    case 'specialist':
      return (
        <SpecialistPanel
          job={job}
          editing={editing}
          saving={saving}
          draft={specialistDraft}
          onDraftChange={markDirty(setSpecialistDraft)}
        />
      );
    case 'rectification':
      return (
        <RectificationPanel
          job={job}
          editing={editing}
          saving={saving}
          jobTypeOptions={jobTypeOptions}
          draft={rectDraft}
          onDraftChange={markDirty(setRectDraft)}
        />
      );
    case 'internal-audit':
      return (
        <InternalAuditPanel
          job={job}
          editing={editing}
          saving={saving}
          draft={auditDraft}
          onDraftChange={markDirty(setAuditDraft)}
        />
      );
    default:
      return null;
  }
});
