'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import {
  DefRow,
  SectionCard,
  pick,
  asString,
} from '@/components/shared/detail';
import { EditRefSelect } from '@/components/jobs/JobEditControls';
import { AUDIT_TYPE_OPTIONS } from '@/components/jobs/job-edit.types';
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

export type InternalAuditDraft = {
  auditTypeExt: string;
  auditTypeName: string;
};

export function buildInternalAuditPending(draft: InternalAuditDraft) {
  const typeDetails: Record<string, unknown> = {
    auditType: draft.auditTypeExt
      ? {
          name: draft.auditTypeName || draft.auditTypeExt,
          externalReference: draft.auditTypeExt,
        }
      : null,
  };
  return {
    typeDetails,
    auditDetails: { ...typeDetails },
  };
}

function initialDraft(job: Job): InternalAuditDraft {
  const details = (job.auditDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };
  return {
    auditTypeExt: refExt(pick(src, 'auditType')),
    auditTypeName: refName(pick(src, 'auditType')) ?? '',
  };
}

export function InternalAuditPanel({
  job,
  editing = false,
  saving = false,
  draft,
  onDraftChange,
}: {
  job: Job;
  editing?: boolean;
  saving?: boolean;
  draft?: InternalAuditDraft;
  onDraftChange?: (draft: InternalAuditDraft) => void;
}) {
  const [local, setLocal] = useState(() => draft ?? initialDraft(job));

  useEffect(() => {
    if (!editing) setLocal(initialDraft(job));
  }, [editing, job]);

  useEffect(() => {
    if (draft) setLocal(draft);
  }, [draft]);

  const set = (patch: Partial<InternalAuditDraft>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onDraftChange?.(next);
  };

  const details = (job.auditDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };

  const options = [...AUDIT_TYPE_OPTIONS];
  if (
    local.auditTypeExt &&
    !options.some((o) => o.externalReference === local.auditTypeExt)
  ) {
    options.push({
      name: local.auditTypeName || local.auditTypeExt,
      externalReference: local.auditTypeExt,
    });
  }

  return (
    <SectionCard
      title="Internal Audit"
      icon={<Shield className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow
        label="Audit type"
        value={
          editing ? (
            <EditRefSelect
              value={local.auditTypeExt}
              options={options}
              disabled={saving}
              onChange={(opt) =>
                set({
                  auditTypeExt: opt?.externalReference ?? '',
                  auditTypeName: opt?.name ?? '',
                })
              }
            />
          ) : (
            refName(pick(src, 'auditType')) ?? '—'
          )
        }
      />
    </SectionCard>
  );
}

export { initialDraft as initialInternalAuditDraft };
