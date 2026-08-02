import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { getSession } from '@/lib/auth';
import { SettingsPageClient } from '@/components/admin/SettingsPageClient';
import { listFeaturesAction } from './features-actions';

export const metadata = { title: 'Settings — EnsureOS' };

function hasPermission(permissions: string[] | undefined, key: string): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.some(
    (p) => p === '*' || p === key || (p.endsWith('.*') && key.startsWith(p.slice(0, -1))),
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');
  const params = await searchParams;
  const session = await getSession();
  const permissions = session.identity?.permissions ?? [];
  const canManageFeatures = hasPermission(permissions, 'features.manage');

  const { features, error } = await listFeaturesAction();

  return (
    <SettingsPageClient
      initialTab={params.tab ?? 'general'}
      features={features}
      featuresError={error}
      canManageFeatures={canManageFeatures}
    />
  );
}
