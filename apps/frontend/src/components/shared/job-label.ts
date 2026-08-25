import type { AddressPayload, Job } from '@/types/api';
import { asString, pick } from '@/components/shared/detail';

type JobLabelSource = Pick<
  Job,
  'id' | 'name' | 'internalNumber' | 'externalJobId' | 'externalReference'
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
    job.internalNumber?.trim() ||
    job.name?.trim() ||
    job.externalJobId?.trim() ||
    job.externalReference?.trim() ||
    job.id
  );
}

/** Same value as job overview "Insurer reference". Hidden when it is just the CW job id. */
export function jobInsurerReference(
  job: Pick<Job, 'externalReference' | 'customData' | 'apiPayload'>,
): string | undefined {
  const custom = (job.customData as Record<string, unknown> | undefined) ?? {};
  const api = (job.apiPayload as Record<string, unknown> | undefined) ?? {};
  const insurerRef = asString(
    pick(custom, 'insurerExternalReference') ?? pick(api, 'externalReference'),
  );
  if (!insurerRef || insurerRef === job.externalReference) return undefined;
  return insurerRef;
}

/** CW / insurer reference (or job name) shown above the internal number on job headers. */
export function jobHeaderSubtitle(job: JobLabelSource): string | undefined {
  const cwLabel =
    job.externalJobId?.trim() || job.externalReference?.trim() || undefined;
  return cwLabel || job.name?.trim() || undefined;
}

/** Primary job title on detail/list headers (internal number). */
export function jobHeaderTitle(job: JobLabelSource): string {
  return job.internalNumber?.trim() || job.id;
}

export function buildJobNameById(jobs: JobLabelSource[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const job of jobs) {
    map[job.id] = jobDisplayName(job);
  }
  return map;
}

/** Ensure the current job appears in the name map used by list Job filters. */
export function mergeCurrentJobIntoNameById(
  jobNameById: Record<string, string>,
  job?: JobLabelSource | null,
): Record<string, string> {
  if (!job?.id) return jobNameById;
  return { ...jobNameById, [job.id]: jobDisplayName(job) };
}

/** Ensure the current job appears in JobOption[] used by list filters / drawers. */
export function mergeCurrentJobIntoOptions(
  jobs: JobOption[],
  job?: (JobLabelSource & { claimId?: string | null }) | null,
): JobOption[] {
  if (!job?.id) return jobs;
  if (jobs.some((j) => j.id === job.id)) return jobs;
  return [
    {
      id: job.id,
      label: jobDisplayName(job),
      claimId: job.claimId,
    },
    ...jobs,
  ];
}

/** Map job id → assignee display name (omit jobs with no assignee name). */
export function buildJobAssigneeNameById(
  jobs: Array<Pick<Job, 'id' | 'assigneeName'>>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const job of jobs) {
    const name = job.assigneeName?.trim();
    if (name) map[job.id] = name;
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
