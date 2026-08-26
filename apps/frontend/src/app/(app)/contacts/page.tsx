import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ContactsListClient } from '@/components/contacts/ContactsListClient';
import { buildJobNameById, buildJobTypeById, jobDisplayName, mergeCurrentJobIntoTypeById } from '@/components/shared/job-label';
import type { PaginatedResponse, Contact, Job, Claim } from '@/types/api';

export const metadata = { title: 'Contacts — EnsureOS' };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string; jobIds?: string; unlinkedOnly?: string; status?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const jobIds = params.jobIds
    ? params.jobIds.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;
  const unlinkedOnly = params.unlinkedOnly === '1' || params.unlinkedOnly === 'true';

  const empty: PaginatedResponse<Contact> = { data: [], total: 0 };

  const [contactsRes, filterJobsRes] = await Promise.all([
    api
      .getContacts({
        jobId: params.jobId,
        jobIds: jobIds && jobIds.length > 0 ? jobIds : undefined,
        unlinkedOnly: unlinkedOnly || undefined,
        status: params.status,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:ContactsPage - getContacts failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getContactFilterJobs().catch((err: unknown) => {
      console.error(
        'frontend:ContactsPage - getContactFilterJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return { jobs: [], hasUnlinked: false };
    }),
  ]);

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:ContactsPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  const filterJobsRaw = filterJobsRes.jobs ?? [];
  const filterJobs = filterJobsRaw.map((j) => ({
    id: j.id,
    label: jobDisplayName({
      id: j.id,
      name: j.name ?? undefined,
      externalJobId: j.externalJobId ?? undefined,
      externalReference: j.externalReference ?? undefined,
    }),
  }));
  if (job && !filterJobs.some((j) => j.id === job.id)) {
    filterJobs.unshift({ id: job.id, label: jobDisplayName(job) });
  }
  const jobNameById = buildJobNameById(
    filterJobs.map((j) => ({
      id: j.id,
      name: j.label,
    })),
  );
  if (job) {
    jobNameById[job.id] = jobDisplayName(job);
  }
  const jobTypeById = mergeCurrentJobIntoTypeById(
    buildJobTypeById(
      filterJobsRaw.map((j) => ({
        id: j.id,
        jobTypeName: j.jobTypeName,
      })),
    ),
    job,
  );

  return (
    <ContactsListClient
      initialData={contactsRes ?? empty}
      job={job}
      parentClaim={parentClaim}
      jobNameById={jobNameById}
      jobTypeById={jobTypeById}
      filterJobs={filterJobs}
      hasUnlinkedContacts={Boolean(filterJobsRes.hasUnlinked)}
    />
  );
}
