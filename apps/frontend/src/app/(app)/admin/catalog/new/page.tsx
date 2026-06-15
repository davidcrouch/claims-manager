import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { CatalogItemForm } from '@/components/catalog/CatalogItemForm';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { Package } from 'lucide-react';

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
    <div className="flex min-h-0 flex-1 flex-col">
      <SetPageHeader>
        <ListPageHeader icon={Package} title="New catalogue item" total={0} accent="slate" />
      </SetPageHeader>
      <div className="px-6 pb-6">
        <CatalogItemForm types={types} categories={categories} unitTypes={unitTypes} />
      </div>
    </div>
  );
}
