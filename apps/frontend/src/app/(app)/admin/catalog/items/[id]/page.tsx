import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { CatalogItemDetailClient } from '@/components/catalog/CatalogItemDetailClient';

export const metadata = { title: 'Catalogue Item — EnsureOS' };

export default async function CatalogItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const [item, types, categories, unitTypes, allItems] = await Promise.all([
    api.getCatalogItem(id).catch(() => null),
    api.getCatalogTypes().catch(() => []),
    api.getCatalogCategoriesTree().catch(() => []),
    api.getLookupsByDomain('unit_type').catch(() => []),
    api.getCatalogItems({ limit: 100 }).catch(() => ({ data: [], total: 0 })),
  ]);

  if (!item) redirect('/admin/catalog');

  return (
    <CatalogItemDetailClient
      item={item}
      types={types}
      categories={categories}
      unitTypes={unitTypes}
      allItems={allItems.data}
    />
  );
}
