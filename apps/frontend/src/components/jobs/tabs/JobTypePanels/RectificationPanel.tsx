import { Hammer } from 'lucide-react';
import {
  DefRow,
  SectionCard,
  BoolPill,
  pick,
  asString,
  asBool,
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

export function RectificationPanel({ job }: { job: Job }) {
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
        value={asString(pick(src, 'originalJobReference')) ?? '—'}
      />
      <DefRow
        label="Original job type"
        value={refName(pick(src, 'originalJobType')) ?? '—'}
      />
      <DefRow label="Paid job" value={<BoolPill value={paidJob} />} />
    </SectionCard>
  );
}
