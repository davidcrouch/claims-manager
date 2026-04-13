import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { ProvidersPageClient } from '@/components/providers/ProvidersPageClient';

export default async function ProvidersPage() {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const providers = await api.getProviders();

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Providers', href: '/providers' }]} />
      <ProvidersPageClient providers={providers} />
    </>
  );
}
