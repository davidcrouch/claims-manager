import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ContactsListClient } from '@/components/contacts/ContactsListClient';
import type { PaginatedResponse, Contact } from '@/types/api';

export const metadata = { title: 'Contacts — EnsureOS' };

export default async function ContactsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const empty: PaginatedResponse<Contact> = { data: [], total: 0 };
  const contactsRes = await api.getContacts().catch((err: unknown) => {
    console.error(
      'frontend:ContactsPage - getContacts failed:',
      err instanceof Error ? err.message : err,
    );
    return empty;
  });

  return <ContactsListClient initialData={contactsRes ?? empty} />;
}
