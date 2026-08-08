import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { NewCatalogItemClient } from '@/components/catalog/NewCatalogItemClient';

export const metadata = { title: 'New catalogue item — EnsureOS' };

export default async function NewCatalogItemPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const [types, categories, unitTypes] = await Promise.all([
    api.getCatalogTypes().catch(() => []),
    api.getCatalogCategoriesTree().catch(() => []),
    api.getLookupsByDomain('unit_type').catch(() => []),
  ]);

  return (
    <NewCatalogItemClient types={types} categories={categories} unitTypes={unitTypes} />
  );
}
