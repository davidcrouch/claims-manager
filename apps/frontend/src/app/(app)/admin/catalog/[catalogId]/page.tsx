import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { CatalogPageClient } from '@/components/catalog/CatalogPageClient';

export async function generateMetadata() {
  return { title: 'Catalogue — EnsureOS' };
}

export default async function CatalogItemsPage({
  params,
}: {
  params: Promise<{ catalogId: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const { catalogId } = await params;

  const [catalog, categories, types, unitTypes] = await Promise.all([
    api.getCatalog(catalogId).catch(() => null),
    api.getCatalogCategoriesTree().catch(() => []),
    api.getCatalogTypes().catch(() => []),
    api.getLookupsByDomain('unit_type').catch(() => []),
  ]);

  if (!catalog) redirect('/admin/catalog');

  return (
    <CatalogPageClient
      catalogId={catalogId}
      catalogName={catalog.name}
      catalogType={catalog.type}
      categories={categories}
      types={types}
      unitTypes={unitTypes}
    />
  );
}
