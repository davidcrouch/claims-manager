import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { CatalogPageClient } from '@/components/catalog/CatalogPageClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ catalogId: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) return { title: 'Catalogue — EnsureOS' };
  const { catalogId } = await params;
  const catalog = await api.getCatalog(catalogId).catch(() => null);
  return {
    title: catalog ? `${catalog.name} — Catalogue — EnsureOS` : 'Catalogue — EnsureOS',
  };
}

export default async function CatalogItemsPage({
  params,
}: {
  params: Promise<{ catalogId: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const { catalogId } = await params;

  const [catalog, categories, template, unresolved] = await Promise.all([
    api.getCatalog(catalogId).catch(() => null),
    api.getCatalogCategoriesTree().catch(() => []),
    api.getCatalogImportTemplate(undefined).catch(() => ({ csv: '', columns: [], catalogType: 'internal' })),
    api.getCatalogUnresolvedReferences().catch(() => []),
  ]);

  if (!catalog) redirect('/admin/catalog');

  const unresolvedReferences = (unresolved as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    externalReference: String(row.externalReference ?? ''),
    sourceEntity: row.sourceEntity != null ? String(row.sourceEntity) : null,
    sourceEntityId: row.sourceEntityId != null ? String(row.sourceEntityId) : null,
    createdAt: String(row.createdAt ?? ''),
  }));

  return (
    <CatalogPageClient
      catalogId={catalogId}
      catalogName={catalog.name}
      catalogType={catalog.type}
      categories={categories}
      templateCsv={template.csv}
      unresolvedReferences={unresolvedReferences}
    />
  );
}
