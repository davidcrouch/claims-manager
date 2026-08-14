import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SettingsPageClient } from '@/components/admin/SettingsPageClient';
import type { OrganisationProfile } from '@/types/api';

export const metadata = { title: 'Company — EnsureOS' };

const EMPTY_ORG: OrganisationProfile = {
  id: '',
  name: '',
  tradingName: null,
  abn: null,
  primaryEmail: null,
  phone: null,
  address: null,
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  if (params.tab === 'features') redirect('/admin/features');
  if (params.tab === 'notifications') redirect('/admin/notifications');

  let organisation = EMPTY_ORG;
  try {
    organisation = await api.getOrganisation();
  } catch (err) {
    console.error('[frontend:admin/settings/page] getOrganisation failed', err);
  }

  return <SettingsPageClient organisation={organisation} />;
}
