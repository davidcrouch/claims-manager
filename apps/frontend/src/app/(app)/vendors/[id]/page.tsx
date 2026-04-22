import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { VendorDetail } from '@/components/vendors/VendorDetail';

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const vendor = await api.getVendor(id).catch((err: unknown) => {
    console.error(
      'frontend:VendorDetailPage - getVendor failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
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
