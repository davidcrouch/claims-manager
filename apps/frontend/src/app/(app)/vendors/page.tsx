import { getSession, getAccessToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { VendorsListClient } from '@/components/vendors/VendorsListClient';

export default async function VendorsPage() {
  const session = await getSession();
  if (!session.authenticated) redirect('/api/auth/login');

  const token = await getAccessToken();
  if (!token) redirect('/api/auth/login');

  const api = createApiClient({ token });
  const vendorsRes = await api.getVendors();

  const vendors = vendorsRes?.data ?? [];

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Vendors', href: '/vendors' }]} />
      <VendorsListClient vendors={vendors} />
    </>
  );
}
