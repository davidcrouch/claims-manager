'use client';

import { useEffect, useState } from 'react';
import { Home, Users } from 'lucide-react';
import {
  DefRow,
  SectionCard,
  BoolPill,
  formatDate,
  formatCurrency,
  pick,
  asString,
} from '@/components/shared/detail';
import {
  EditMobilityGroup,
  EditSwitch,
  EditText,
  EditTextarea,
} from '@/components/jobs/JobEditControls';
import {
  MOBILITY_OPTIONS,
  type MobilityOption,
} from '@/components/jobs/job-edit.types';
import type { Job } from '@/types/api';

type Dict = Record<string, unknown>;

function toInputDateTime(val: string | undefined | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputDateTime(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? val : d.toISOString();
}

export type TemporaryAccommodationDraft = {
  emergency: boolean;
  habitableProperty: boolean;
  estimatedStayStartDate: string;
  estimatedStayEndDate: string;
  numberOfAdults: string;
  numberOfChildren: string;
  numberOfBedrooms: string;
  numberOfCots: string;
  numberOfVehicles: string;
  petsInformation: string;
  mobilityConsiderations: MobilityOption[];
};

export function buildTemporaryAccommodationPending(draft: TemporaryAccommodationDraft) {
  const typeDetails: Record<string, unknown> = {
    emergency: draft.emergency,
    habitableProperty: draft.habitableProperty,
    estimatedStayStartDate: fromInputDateTime(draft.estimatedStayStartDate),
    estimatedStayEndDate: fromInputDateTime(draft.estimatedStayEndDate),
    numberOfAdults: draft.numberOfAdults === '' ? null : Number(draft.numberOfAdults),
    numberOfChildren: draft.numberOfChildren === '' ? null : Number(draft.numberOfChildren),
    numberOfBedrooms: draft.numberOfBedrooms === '' ? null : Number(draft.numberOfBedrooms),
    numberOfCots: draft.numberOfCots === '' ? null : Number(draft.numberOfCots),
    numberOfVehicles: draft.numberOfVehicles === '' ? null : Number(draft.numberOfVehicles),
    petsInformation: draft.petsInformation || null,
    mobilityConsiderations: draft.mobilityConsiderations,
  };
  return {
    typeDetails,
    temporaryAccommodationDetails: { ...typeDetails },
    mobilityConsiderations: draft.mobilityConsiderations,
  };
}

function initialDraft(job: Job): TemporaryAccommodationDraft {
  const details = (job.temporaryAccommodationDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };
  const mobility = (job.mobilityConsiderations ?? []).map((c) => ({
    name: c.name ?? c.externalReference ?? '',
    externalReference: c.externalReference ?? c.name ?? '',
  })).filter((c) => c.externalReference);

  return {
    emergency: !!pick(src, 'emergency'),
    habitableProperty: !!pick(src, 'habitableProperty'),
    estimatedStayStartDate: toInputDateTime(asString(pick(src, 'estimatedStayStartDate'))),
    estimatedStayEndDate: toInputDateTime(asString(pick(src, 'estimatedStayEndDate'))),
    numberOfAdults: asString(pick(src, 'numberOfAdults')) ?? '',
    numberOfChildren: asString(pick(src, 'numberOfChildren')) ?? '',
    numberOfBedrooms: asString(pick(src, 'numberOfBedrooms')) ?? '',
    numberOfCots: asString(pick(src, 'numberOfCots')) ?? '',
    numberOfVehicles: asString(pick(src, 'numberOfVehicles')) ?? '',
    petsInformation: asString(pick(src, 'petsInformation')) ?? '',
    mobilityConsiderations: mobility,
  };
}

export function TemporaryAccommodationPanel({
  job,
  editing = false,
  saving = false,
  draft,
  onDraftChange,
}: {
  job: Job;
  editing?: boolean;
  saving?: boolean;
  draft?: TemporaryAccommodationDraft;
  onDraftChange?: (draft: TemporaryAccommodationDraft) => void;
}) {
  const [local, setLocal] = useState(() => draft ?? initialDraft(job));

  useEffect(() => {
    if (!editing) setLocal(initialDraft(job));
  }, [editing, job]);

  useEffect(() => {
    if (draft) setLocal(draft);
  }, [draft]);

  const set = (patch: Partial<TemporaryAccommodationDraft>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onDraftChange?.(next);
  };

  const details = (job.temporaryAccommodationDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };
  const considerations = job.mobilityConsiderations ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Stay Details"
        icon={<Home className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Emergency"
          value={
            editing ? (
              <EditSwitch checked={local.emergency} onChange={(v) => set({ emergency: v })} disabled={saving} />
            ) : (
              <BoolPill value={pick(src, 'emergency')} />
            )
          }
        />
        <DefRow
          label="Habitable property"
          value={
            editing ? (
              <EditSwitch
                checked={local.habitableProperty}
                onChange={(v) => set({ habitableProperty: v })}
                disabled={saving}
              />
            ) : (
              <BoolPill value={pick(src, 'habitableProperty')} />
            )
          }
        />
        <DefRow
          label="Estimated start"
          value={
            editing ? (
              <EditText
                type="datetime-local"
                value={local.estimatedStayStartDate}
                onChange={(v) => set({ estimatedStayStartDate: v })}
                disabled={saving}
                className="h-8 w-full max-w-xs text-sm"
              />
            ) : (
              formatDate(asString(pick(src, 'estimatedStayStartDate')))
            )
          }
        />
        <DefRow
          label="Estimated end"
          value={
            editing ? (
              <EditText
                type="datetime-local"
                value={local.estimatedStayEndDate}
                onChange={(v) => set({ estimatedStayEndDate: v })}
                disabled={saving}
                className="h-8 w-full max-w-xs text-sm"
              />
            ) : (
              formatDate(asString(pick(src, 'estimatedStayEndDate')))
            )
          }
        />
        <DefRow
          label="Accommodation benefit limit"
          value={formatCurrency(pick(src, 'accommodationBenefitLimit'))}
        />
        <DefRow
          label="Max accommodation duration"
          value={
            asString(
              pick(
                src,
                'maximumAccommodationDurationLimit',
                'maximumAccomodationDurationLimit',
              ),
            ) ?? '—'
          }
        />
      </SectionCard>

      <SectionCard
        title="Occupants"
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow
          label="Adults"
          value={
            editing ? (
              <EditText type="number" min={1} max={10} value={local.numberOfAdults} onChange={(v) => set({ numberOfAdults: v })} disabled={saving} />
            ) : (
              asString(pick(src, 'numberOfAdults')) ?? '—'
            )
          }
        />
        <DefRow
          label="Children"
          value={
            editing ? (
              <EditText type="number" min={0} max={10} value={local.numberOfChildren} onChange={(v) => set({ numberOfChildren: v })} disabled={saving} />
            ) : (
              asString(pick(src, 'numberOfChildren')) ?? '—'
            )
          }
        />
        <DefRow
          label="Bedrooms"
          value={
            editing ? (
              <EditText type="number" min={0} max={10} value={local.numberOfBedrooms} onChange={(v) => set({ numberOfBedrooms: v })} disabled={saving} />
            ) : (
              asString(pick(src, 'numberOfBedrooms')) ?? '—'
            )
          }
        />
        <DefRow
          label="Cots"
          value={
            editing ? (
              <EditText type="number" min={0} max={10} value={local.numberOfCots} onChange={(v) => set({ numberOfCots: v })} disabled={saving} />
            ) : (
              asString(pick(src, 'numberOfCots')) ?? '—'
            )
          }
        />
        <DefRow
          label="Vehicles"
          value={
            editing ? (
              <EditText type="number" min={0} max={5} value={local.numberOfVehicles} onChange={(v) => set({ numberOfVehicles: v })} disabled={saving} />
            ) : (
              asString(pick(src, 'numberOfVehicles')) ?? '—'
            )
          }
        />
        <DefRow
          label="Pets"
          value={
            editing ? (
              <EditTextarea value={local.petsInformation} onChange={(v) => set({ petsInformation: v })} disabled={saving} rows={2} />
            ) : (
              asString(pick(src, 'petsInformation')) ?? '—'
            )
          }
        />
      </SectionCard>

      {(editing || considerations.length > 0) && (
        <div className="md:col-span-2">
          <SectionCard
            title="Mobility Considerations"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          >
            {editing ? (
              <EditMobilityGroup
                selected={local.mobilityConsiderations}
                options={MOBILITY_OPTIONS}
                onChange={(next) => set({ mobilityConsiderations: next })}
                disabled={saving}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {considerations.map((c, i) => (
                  <span
                    key={c.externalReference ?? c.name ?? i}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {c.name ?? c.externalReference ?? '—'}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

export { initialDraft as initialTemporaryAccommodationDraft };
