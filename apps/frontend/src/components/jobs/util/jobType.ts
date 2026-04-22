import type { Job, LookupRef } from '@/types/api';

export type JobTypeKind =
  | 'temporary-accommodation'
  | 'specialist'
  | 'rectification'
  | 'internal-audit'
  | 'other';

function normalize(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function getJobTypeRef(job: Job): LookupRef | undefined {
  return job.jobType;
}

export function getJobTypeName(job: Job): string {
  return getJobTypeRef(job)?.name ?? '';
}

export function getJobTypeKind(job: Job): JobTypeKind {
  const ref = getJobTypeRef(job);
  const name = normalize(ref?.name);
  const ext = normalize(ref?.externalReference);

  if (name.includes('temporary accommodation') || ext.includes('temporary')) {
    return 'temporary-accommodation';
  }
  if (name === 'specialist' || ext === 'specialist') {
    return 'specialist';
  }
  if (
    name.includes('rectification') ||
    ext.includes('rectification') ||
    name.includes('builder rectification')
  ) {
    return 'rectification';
  }
  if (name.includes('internal audit') || ext.includes('audit')) {
    return 'internal-audit';
  }
  return 'other';
}

export function hasTypeDetails(job: Job): boolean {
  return getJobTypeKind(job) !== 'other';
}
