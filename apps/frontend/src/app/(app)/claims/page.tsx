import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { ClaimsListClient } from '@/components/claims/ClaimsListClient';

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; sort?: string; status?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const params = await searchParams;
  const initialClaims = await api.getClaims({
    page: parseInt(params.page ?? '1', 10),
    limit: 20,
    search: params.search,
    sort: params.sort,
    status: params.status,
  });

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Claims', href: '/claims' }]} />
      <ClaimsListClient initialData={initialClaims} />
    </>
  );
}
