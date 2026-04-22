import { Wrench, FileText } from 'lucide-react';
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

export function SpecialistPanel({ job }: { job: Job }) {
  const details = (job.specialistDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };

  const requiresSpecific = asBool(pick(src, 'isSpecificSpecialistRequired'));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Specialist"
        icon={<Wrench className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Category"
          value={refName(pick(src, 'specialistCategory')) ?? '—'}
        />
        <DefRow
          label="Specific specialist required"
          value={<BoolPill value={requiresSpecific} />}
        />
        {requiresSpecific && (
          <DefRow
            label="Business name"
            value={asString(pick(src, 'specialistBusinessName')) ?? '—'}
          />
        )}
      </SectionCard>

      <SectionCard
        title="Damage"
        icon={<FileText className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Location of damage"
          value={asString(pick(src, 'locationOfDamage')) ?? '—'}
        />
        <DefRow
          label="Type of damage"
          value={refName(pick(src, 'typeOfDamage')) ?? '—'}
        />
        <DefRow
          label="Specialist report"
          value={asString(pick(src, 'specialistReport')) ?? '—'}
        />
      </SectionCard>
    </div>
  );
}
