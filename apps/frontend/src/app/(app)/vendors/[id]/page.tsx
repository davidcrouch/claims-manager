import { getSession, getAccessToken } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { VendorDetail } from '@/components/vendors/VendorDetail';

export default async function VendorDetailPage({
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
  const vendor = await api.getVendor(id);
  if (!vendor) notFound();

  return (
    <>
      <SetBreadcrumbs
        items={[
          { title: 'Vendors', href: '/vendors' },
          { title: vendor.name, href: `/vendors/${id}` },
        ]}
      />
      <VendorDetail vendor={vendor} />
    </>
  );
}
