import type { AddressPayload, Job } from '@/types/api';

type JobLabelSource = Pick<
  Job,
  'id' | 'name' | 'externalJobId' | 'externalReference'
>;

export type JobOption = {
  id: string;
  label: string;
  claimId?: string | null;
  /** Optional site address used to prefill journal create forms. */
  address?: AddressPayload | null;
  addressSuburb?: string | null;
  addressPostcode?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
};

export function jobDisplayName(job: JobLabelSource): string {
  return (
    job.name?.trim() ||
    job.externalJobId?.trim() ||
    job.externalReference?.trim() ||
    job.id
  );
}

export function buildJobNameById(jobs: JobLabelSource[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const job of jobs) {
    map[job.id] = jobDisplayName(job);
  }
  return map;
}

export function resolveJobName(
  jobId: string | null | undefined,
  jobNameById?: Record<string, string>,
): string {
  if (!jobId) return '';
  return jobNameById?.[jobId] ?? '';
}

function normalizeJobAddress(
  job: JobLabelSource & {
    claimId?: string | null;
    address?: AddressPayload | Record<string, unknown> | null;
    addressSuburb?: string | null;
    addressPostcode?: string | null;
    addressState?: string | null;
    addressCountry?: string | null;
  },
): AddressPayload | null {
  const raw =
    job.address && typeof job.address === 'object' && !Array.isArray(job.address)
      ? (job.address as Record<string, unknown>)
      : {};
  const asText = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  const address: AddressPayload = {
    unitNumber: asText(raw.unitNumber),
    streetNumber: asText(raw.streetNumber),
    streetName: asText(raw.streetName),
    suburb: asText(raw.suburb) ?? asText(job.addressSuburb) ?? undefined,
    state: asText(raw.state) ?? asText(job.addressState) ?? undefined,
    postcode: asText(raw.postcode) ?? asText(job.addressPostcode) ?? undefined,
    country: asText(raw.country) ?? asText(job.addressCountry) ?? undefined,
  };

  return Object.values(address).some(Boolean) ? address : null;
}

/** Server-safe helper for Create drawers that need a job picker. */
export function toJobOptions(
  jobs: Array<
    JobLabelSource & {
      claimId?: string | null;
      address?: AddressPayload | Record<string, unknown> | null;
      addressSuburb?: string | null;
      addressPostcode?: string | null;
      addressState?: string | null;
      addressCountry?: string | null;
    }
  >,
): JobOption[] {
  return jobs.map((job) => {
    const address = normalizeJobAddress(job);
    return {
      id: job.id,
      label: jobDisplayName(job),
      claimId: job.claimId,
      address,
      addressSuburb: address?.suburb ?? job.addressSuburb ?? null,
      addressPostcode: address?.postcode ?? job.addressPostcode ?? null,
      addressState: address?.state ?? job.addressState ?? null,
      addressCountry: address?.country ?? job.addressCountry ?? null,
    };
  });
}
