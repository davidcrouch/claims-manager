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
} from './JobTypePanels/TemporaryAccommodationPanel';
import {
  SpecialistPanel,
  buildSpecialistPending,
  initialSpecialistDraft,
} from './JobTypePanels/SpecialistPanel';
import {
  RectificationPanel,
  buildRectificationPending,
  initialRectificationDraft,
} from './JobTypePanels/RectificationPanel';
import {
  InternalAuditPanel,
  buildInternalAuditPending,
  initialInternalAuditDraft,
} from './JobTypePanels/InternalAuditPanel';
import { asBool, pick } from '@/components/shared/detail';

export interface JobTypeDetailsTabHandle {
  getPendingUpdate: () => Partial<JobEditPending> | null;
  reset: () => void;
  markClean: () => void;
  isDirty: () => boolean;
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
  const dirtyRef = useRef(false);
  const jobIdRef = useRef(job.id);

  const [taDraft, setTaDraft] = useState(() => initialTemporaryAccommodationDraft(job));
  const [specialistDraft, setSpecialistDraft] = useState(() => initialSpecialistDraft(job));
  const [rectDraft, setRectDraft] = useState(() =>
    initialRectificationDraft(job, jobTypeOptions),
  );
  const [auditDraft, setAuditDraft] = useState(() => initialInternalAuditDraft(job));

  const setDirty = (next: boolean) => {
    dirtyRef.current = next;
    onDirtyChange?.(next);
  };

  const reseed = (nextJob: Job, nextJobTypeOptions: LookupOption[]) => {
    setTaDraft(initialTemporaryAccommodationDraft(nextJob));
    setSpecialistDraft(initialSpecialistDraft(nextJob));
    setRectDraft(initialRectificationDraft(nextJob, nextJobTypeOptions));
    setAuditDraft(initialInternalAuditDraft(nextJob));
  };

  useEffect(() => {
    if (job.id !== jobIdRef.current) {
      jobIdRef.current = job.id;
      setDirty(false);
      reseed(job, jobTypeOptions);
      return;
    }
    if (dirtyRef.current) return;
    reseed(job, jobTypeOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when clean or job changes
  }, [job, jobTypeOptions]);

  useImperativeHandle(ref, () => ({
    getPendingUpdate: () => {
      if (!editing || !dirtyRef.current) return null;
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
    reset: () => {
      setDirty(false);
      reseed(job, jobTypeOptions);
    },
    markClean: () => {
      setDirty(false);
    },
    isDirty: () => dirtyRef.current,
  }), [
    editing,
    kind,
    taDraft,
    specialistDraft,
    rectDraft,
    auditDraft,
    job,
    jobTypeOptions,
  ]);

  const markDirty = <T,>(setter: (d: T) => void) => (draft: T) => {
    setDirty(true);
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
