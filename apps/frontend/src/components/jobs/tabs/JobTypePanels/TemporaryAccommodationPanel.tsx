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
import type { Job } from '@/types/api';

type Dict = Record<string, unknown>;

export function TemporaryAccommodationPanel({ job }: { job: Job }) {
  const details = (job.temporaryAccommodationDetails as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const src: Dict = { ...api, ...details };

  const considerations = job.mobilityConsiderations ?? [];
  const emergency = pick(src, 'emergency');
  const habitable = pick(src, 'habitableProperty');
  const start = asString(pick(src, 'estimatedStayStartDate'));
  const end = asString(pick(src, 'estimatedStayEndDate'));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Stay Details"
        icon={<Home className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Emergency" value={<BoolPill value={emergency} />} />
        <DefRow
          label="Habitable property"
          value={<BoolPill value={habitable} />}
        />
        <DefRow label="Estimated start" value={formatDate(start)} />
        <DefRow label="Estimated end" value={formatDate(end)} />
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
          value={asString(pick(src, 'numberOfAdults')) ?? '—'}
        />
        <DefRow
          label="Children"
          value={asString(pick(src, 'numberOfChildren')) ?? '—'}
        />
        <DefRow
          label="Bedrooms"
          value={asString(pick(src, 'numberOfBedrooms')) ?? '—'}
        />
        <DefRow
          label="Cots"
          value={asString(pick(src, 'numberOfCots')) ?? '—'}
        />
        <DefRow
          label="Vehicles"
          value={asString(pick(src, 'numberOfVehicles')) ?? '—'}
        />
        <DefRow
          label="Pets"
          value={asString(pick(src, 'petsInformation')) ?? '—'}
        />
      </SectionCard>

      {considerations.length > 0 && (
        <div className="md:col-span-2">
          <SectionCard
            title="Mobility Considerations"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          >
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
          </SectionCard>
        </div>
      )}
    </div>
  );
}
