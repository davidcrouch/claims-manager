import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { getSession } from '@/lib/auth';
import { FeaturesPageClient } from '@/components/admin/FeaturesPageClient';
import { listFeaturesAction } from '../settings/features-actions';

export const metadata = { title: 'Features — EnsureOS' };

function hasPermission(permissions: string[] | undefined, key: string): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.some(
    (p) => p === '*' || p === key || (p.endsWith('.*') && key.startsWith(p.slice(0, -1))),
  );
}

export default async function FeaturesPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const session = await getSession();
  const permissions = session.identity?.permissions ?? [];
  const canManage = hasPermission(permissions, 'features.manage');
  const { features, error } = await listFeaturesAction();

  return (
    <FeaturesPageClient
      features={features}
      featuresError={error}
      canManage={canManage}
    />
  );
}
