import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SettingsPageClient } from '@/components/admin/SettingsPageClient';

export const metadata = { title: 'Settings — EnsureOS' };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');
  const params = await searchParams;

  return (
    <SettingsPageClient
      initialTab={params.tab ?? 'general'}
    />
  );
}
