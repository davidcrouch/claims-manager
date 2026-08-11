'use client';

import { useEffect, useState } from 'react';
import { Hammer } from 'lucide-react';
import {
  DefRow,
  SectionCard,
  BoolPill,
  pick,
  asString,
  asBool,
} from '@/components/shared/detail';
import {
  EditLookupSelect,
  EditSwitch,
  EditText,
} from '@/components/jobs/JobEditControls';
import type { LookupOption } from '@/components/jobs/job-edit.types';
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

export type RectificationDraft = {
  originalJobReference: string;
  originalJobTypeLookupId: string;
  originalJobTypeExt: string;
  originalJobTypeName: string;
  paidJob: boolean;
};

export function buildRectificationPending(draft: RectificationDraft) {
  const typeDetails: Record<string, unknown> = {
    originalJobReference: draft.originalJobReference || null,
    originalJobType: draft.originalJobTypeExt
      ? {
          name: draft.originalJobTypeName || draft.originalJobTypeExt,
          externalReference: draft.originalJobTypeExt,
        }
      : null,
    paidJob: draft.paidJob,
  };
  return {
    typeDetails,
    rectificationDetails: { ...typeDetails },
  };
}

function initialDraft(job: Job, jobTypeOptions: LookupOption[]): RectificationDraft {
  const details = (job.rectificationDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };
  const ext = refExt(pick(src, 'originalJobType'));
  const match = jobTypeOptions.find(
    (o) => o.externalReference === ext || o.name === refName(pick(src, 'originalJobType')),
  );
  return {
    originalJobReference: asString(pick(src, 'originalJobReference')) ?? '',
    originalJobTypeLookupId: match?.id ?? '',
    originalJobTypeExt: ext,
    originalJobTypeName: refName(pick(src, 'originalJobType')) ?? '',
    paidJob: !!asBool(pick(src, 'paidJob')),
  };
}

export function RectificationPanel({
  job,
  editing = false,
  saving = false,
  jobTypeOptions = [],
  draft,
  onDraftChange,
}: {
  job: Job;
  editing?: boolean;
  saving?: boolean;
  jobTypeOptions?: LookupOption[];
  draft?: RectificationDraft;
  onDraftChange?: (draft: RectificationDraft) => void;
}) {
  const [local, setLocal] = useState(() => draft ?? initialDraft(job, jobTypeOptions));

  useEffect(() => {
    if (!editing) setLocal(initialDraft(job, jobTypeOptions));
  }, [editing, job, jobTypeOptions]);

  useEffect(() => {
    if (draft) setLocal(draft);
  }, [draft]);

  const set = (patch: Partial<RectificationDraft>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onDraftChange?.(next);
  };

  const details = (job.rectificationDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };
  const paidJob = asBool(pick(src, 'paidJob'));

  return (
    <SectionCard
      title="Rectification"
      icon={<Hammer className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow
        label="Original job reference"
        value={
          editing ? (
            <EditText
              value={local.originalJobReference}
              onChange={(v) => set({ originalJobReference: v })}
              disabled={saving}
            />
          ) : (
            asString(pick(src, 'originalJobReference')) ?? '—'
          )
        }
      />
      <DefRow
        label="Original job type"
        value={
          editing ? (
            <EditLookupSelect
              valueId={local.originalJobTypeLookupId}
              options={jobTypeOptions}
              disabled={saving}
              onChange={(opt) =>
                set({
                  originalJobTypeLookupId: opt?.id ?? '',
                  originalJobTypeExt: opt?.externalReference ?? '',
                  originalJobTypeName: opt?.name ?? '',
                })
              }
            />
          ) : (
            refName(pick(src, 'originalJobType')) ?? '—'
          )
        }
      />
      <DefRow
        label="Paid job"
        value={
          editing ? (
            <EditSwitch checked={local.paidJob} onChange={(v) => set({ paidJob: v })} disabled={saving} />
          ) : (
            <BoolPill value={paidJob} />
          )
        }
      />
    </SectionCard>
  );
}

export { initialDraft as initialRectificationDraft };
