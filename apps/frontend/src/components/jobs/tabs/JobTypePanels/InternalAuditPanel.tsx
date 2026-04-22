import { Shield } from 'lucide-react';
import {
  DefRow,
  SectionCard,
  pick,
  asString,
} from '@/components/shared/detail';
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

export function InternalAuditPanel({ job }: { job: Job }) {
  const details = (job.auditDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };

  return (
    <SectionCard
      title="Internal Audit"
      icon={<Shield className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow
        label="Audit type"
        value={refName(pick(src, 'auditType')) ?? '—'}
      />
    </SectionCard>
  );
}
