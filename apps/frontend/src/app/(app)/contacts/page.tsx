import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ContactsListClient } from '@/components/contacts/ContactsListClient';
import type { PaginatedResponse, Contact, Job, Claim } from '@/types/api';

export const metadata = { title: 'Contacts — EnsureOS' };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;

  const empty: PaginatedResponse<Contact> = { data: [], total: 0 };
  const contactsRes = await api.getContacts().catch((err: unknown) => {
    console.error(
      'frontend:ContactsPage - getContacts failed:',
      err instanceof Error ? err.message : err,
    );
    return empty;
  });

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

  return (
    <ContactsListClient
      initialData={contactsRes ?? empty}
      job={job}
      parentClaim={parentClaim}
    />
  );
}
