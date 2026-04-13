import { redirect, notFound } from 'next/navigation';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { ProviderDetailContent } from '@/components/providers/ProviderDetailContent';

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) redirect('/api/auth/login');

  const token = await getAccessToken();
  if (!token) redirect('/api/auth/login');

  const api = createApiClient({ token });

  let providerName = 'Provider';
  try {
    const provider = await api.getProvider(id);
    if (!provider) notFound();
    providerName = provider.name;
  } catch {
    notFound();
  }

  return (
    <>
      <SetBreadcrumbs
        items={[
          { title: 'Providers', href: '/providers' },
          { title: providerName, href: `/providers/${id}` },
        ]}
      />
      <ProviderDetailContent providerId={id} />
    </>
  );
}
