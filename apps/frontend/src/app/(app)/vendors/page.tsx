import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { VendorsListClient } from '@/components/vendors/VendorsListClient';
import type { PaginatedResponse, Vendor } from '@/types/api';

export default async function VendorsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const empty: PaginatedResponse<Vendor> = { data: [], total: 0 };
  const vendorsRes = await api.getVendors().catch((err: unknown) => {
    console.error(
      'frontend:VendorsPage - getVendors failed:',
      err instanceof Error ? err.message : err,
    );
    return empty;
  });

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Vendors', href: '/vendors' }]} />
      <VendorsListClient initialData={vendorsRes ?? empty} />
    </>
  );
}
