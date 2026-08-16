import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { FeaturesPageClient } from '@/components/admin/FeaturesPageClient';
import { listFeaturesAction } from '../settings/features-actions';

export const metadata = { title: 'Features — EnsureOS' };

export default async function FeaturesPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const session = await getSession();
  const permissions = session.identity?.permissions ?? [];
  if (!hasPermission(permissions, 'features.read')) {
    redirect('/dashboard');
  }
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
