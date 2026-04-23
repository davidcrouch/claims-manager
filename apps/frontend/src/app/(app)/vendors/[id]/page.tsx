import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { VendorDetail, VendorPageHeader } from '@/components/vendors/VendorDetail';

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
      <SetPageHeader>
        <VendorPageHeader vendor={vendor} />
      </SetPageHeader>
      <VendorDetail vendor={vendor} />
    </>
  );
}
