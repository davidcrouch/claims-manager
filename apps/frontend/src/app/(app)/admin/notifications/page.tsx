import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { NotificationsPageClient } from '@/components/admin/NotificationsPageClient';

export const metadata = { title: 'Notifications — EnsureOS' };

export default async function NotificationsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return <NotificationsPageClient />;
}
