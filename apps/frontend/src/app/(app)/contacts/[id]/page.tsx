import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ContactDetailClient } from '@/components/contacts/ContactDetail';
import type { Metadata } from 'next';

function contactDisplayName(contact: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  return parts.join(' ').trim() || contact.email?.trim() || 'Contact';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Contact | EnsureOS' };

  const contact = await api.getContact(id).catch(() => null);
  const title = contact ? contactDisplayName(contact) : id;
  return { title: `${title} | EnsureOS` };
}

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fromJob?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const fromJob = query.fromJob?.trim() || null;

  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const [contact, relatedJobs] = await Promise.all([
    api.getContact(id).catch((err: unknown) => {
      console.error(
        'frontend:ContactDetailPage - getContact failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    }),
    api.getContactRelatedJobs(id).catch((err: unknown) => {
      console.error(
        'frontend:ContactDetailPage - getContactRelatedJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return [];
    }),
  ]);

  if (!contact) notFound();

  const backHref = fromJob ? `/jobs/${fromJob}?tab=parties` : '/contacts';
  const backLabel = fromJob ? 'Back to job parties' : 'Back to contacts';

  return (
    <ContactDetailClient
      initialContact={contact}
      relatedJobs={relatedJobs}
      currentJobId={fromJob}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
