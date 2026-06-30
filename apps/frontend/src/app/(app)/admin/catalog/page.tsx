import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { CatalogListPageClient } from '@/components/catalog/CatalogListPageClient';

export const metadata = { title: 'Catalogues — EnsureOS' };

export default async function CatalogPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const catalogs = await api.getCatalogs().catch(() => []);

  return <CatalogListPageClient catalogs={catalogs} />;
}
