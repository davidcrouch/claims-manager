import { redirect } from 'next/navigation';

export const metadata = { title: 'New catalogue item — EnsureOS' };

export default async function NewCatalogItemPage({
  searchParams,
}: {
  searchParams: Promise<{ catalogId?: string }>;
}) {
  const { catalogId } = await searchParams;
  if (catalogId) redirect(`/admin/catalog/${catalogId}?newItem=1`);
  redirect('/admin/catalog');
}
