'use client';

import { useEffect, useState } from 'react';
import { Wrench, FileText } from 'lucide-react';
import {
  DefRow,
  SectionCard,
  BoolPill,
  pick,
  asString,
  asBool,
} from '@/components/shared/detail';
import {
  EditRefSelect,
  EditText,
  EditTextarea,
} from '@/components/jobs/JobEditControls';
import {
  SPECIALIST_CATEGORY_OPTIONS,
  SPECIALIST_REPORT_OPTIONS,
} from '@/components/jobs/job-edit.types';
import type { Job } from '@/types/api';

type Dict = Record<string, unknown>;

function refName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value || undefined;
  if (typeof value === 'object') {
    const v = value as Dict;
    return asString(v.name) ?? asString(v.externalReference);
  }
  return undefined;
}

function refExt(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as Dict;
    return asString(v.externalReference) ?? asString(v.name) ?? '';
  }
  return '';
}

export type SpecialistDraft = {
  specialistCategoryExt: string;
  specialistCategoryName: string;
  specialistReportExt: string;
  specialistReportName: string;
  specialistBusinessName: string;
  locationOfDamage: string;
  typeOfDamage: string;
};

export function buildSpecialistPending(draft: SpecialistDraft, requiresSpecific: boolean) {
  const typeDetails: Record<string, unknown> = {
    specialistCategory: draft.specialistCategoryExt
      ? { name: draft.specialistCategoryName || draft.specialistCategoryExt, externalReference: draft.specialistCategoryExt }
      : null,
    specialistReport: draft.specialistReportExt
      ? { name: draft.specialistReportName || draft.specialistReportExt, externalReference: draft.specialistReportExt }
      : null,
    locationOfDamage: draft.locationOfDamage || null,
    typeOfDamage: draft.typeOfDamage || null,
  };
  if (requiresSpecific) {
    typeDetails.specialistBusinessName = draft.specialistBusinessName || null;
  }
  return {
    typeDetails,
    specialistDetails: { ...typeDetails },
  };
}

function initialDraft(job: Job): SpecialistDraft {
  const details = (job.specialistDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };
  return {
    specialistCategoryExt: refExt(pick(src, 'specialistCategory')),
    specialistCategoryName: refName(pick(src, 'specialistCategory')) ?? '',
    specialistReportExt: refExt(pick(src, 'specialistReport')),
    specialistReportName: refName(pick(src, 'specialistReport')) ?? '',
    specialistBusinessName: asString(pick(src, 'specialistBusinessName')) ?? '',
    locationOfDamage: asString(pick(src, 'locationOfDamage')) ?? '',
    typeOfDamage: asString(pick(src, 'typeOfDamage')) ?? '',
  };
}

export function SpecialistPanel({
  job,
  editing = false,
  saving = false,
  draft,
  onDraftChange,
}: {
  job: Job;
  editing?: boolean;
  saving?: boolean;
  draft?: SpecialistDraft;
  onDraftChange?: (draft: SpecialistDraft) => void;
}) {
  const [local, setLocal] = useState(() => draft ?? initialDraft(job));

  useEffect(() => {
    if (!editing) setLocal(initialDraft(job));
  }, [editing, job]);

  useEffect(() => {
    if (draft) setLocal(draft);
  }, [draft]);

  const set = (patch: Partial<SpecialistDraft>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onDraftChange?.(next);
  };

  const details = (job.specialistDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };
  const requiresSpecific = asBool(pick(src, 'isSpecificSpecialistRequired'));

  const categoryOptions = [...SPECIALIST_CATEGORY_OPTIONS];
  if (
    local.specialistCategoryExt &&
    !categoryOptions.some((o) => o.externalReference === local.specialistCategoryExt)
  ) {
    categoryOptions.push({
      name: local.specialistCategoryName || local.specialistCategoryExt,
      externalReference: local.specialistCategoryExt,
    });
  }

  const reportOptions = [...SPECIALIST_REPORT_OPTIONS];
  if (
    local.specialistReportExt &&
    !reportOptions.some((o) => o.externalReference === local.specialistReportExt)
  ) {
    reportOptions.push({
      name: local.specialistReportName || local.specialistReportExt,
      externalReference: local.specialistReportExt,
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Specialist"
        icon={<Wrench className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Category"
          value={
            editing ? (
              <EditRefSelect
                value={local.specialistCategoryExt}
                options={categoryOptions}
                disabled={saving}
                onChange={(opt) =>
                  set({
                    specialistCategoryExt: opt?.externalReference ?? '',
                    specialistCategoryName: opt?.name ?? '',
                  })
                }
              />
            ) : (
              refName(pick(src, 'specialistCategory')) ?? '—'
            )
          }
        />
        <DefRow
          label="Specific specialist required"
          value={<BoolPill value={requiresSpecific} />}
        />
        {(requiresSpecific || (editing && requiresSpecific)) && (
          <DefRow
            label="Business name"
            value={
              editing && requiresSpecific ? (
                <EditText
                  value={local.specialistBusinessName}
                  onChange={(v) => set({ specialistBusinessName: v })}
                  disabled={saving}
                />
              ) : (
                asString(pick(src, 'specialistBusinessName')) ?? '—'
              )
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="Damage"
        icon={<FileText className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Location of damage"
          value={
            editing ? (
              <EditTextarea
                value={local.locationOfDamage}
                onChange={(v) => set({ locationOfDamage: v })}
                disabled={saving}
              />
            ) : (
              asString(pick(src, 'locationOfDamage')) ?? '—'
            )
          }
        />
        <DefRow
          label="Type of damage"
          value={
            editing ? (
              <EditTextarea
                value={local.typeOfDamage}
                onChange={(v) => set({ typeOfDamage: v })}
                disabled={saving}
              />
            ) : (
              refName(pick(src, 'typeOfDamage')) ?? '—'
            )
          }
        />
        <DefRow
          label="Specialist report"
          value={
            editing ? (
              <EditRefSelect
                value={local.specialistReportExt}
                options={reportOptions}
                disabled={saving}
                onChange={(opt) =>
                  set({
                    specialistReportExt: opt?.externalReference ?? '',
                    specialistReportName: opt?.name ?? '',
                  })
                }
              />
            ) : (
              asString(pick(src, 'specialistReport')) ??
              refName(pick(src, 'specialistReport')) ??
              '—'
            )
          }
        />
      </SectionCard>
    </div>
  );
}

export { initialDraft as initialSpecialistDraft };
