import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { CatalogPageClient } from '@/components/catalog/CatalogPageClient';

export const metadata = { title: 'Catalogue — EnsureOS' };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; page?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page, 10) : 1;

  const [itemsResult, types, categories, template, unresolved] = await Promise.all([
    api
      .getCatalogItems({
        q: sp.q,
        kind: sp.kind as 'primitive' | 'assembly' | undefined,
        page,
        limit: 50,
      })
      .catch(() => ({ data: [], total: 0 })),
    api.getCatalogTypes().catch(() => []),
    api.getCatalogCategoriesTree().catch(() => []),
    api.getCatalogImportTemplate().catch(() => ({ csv: '', columns: [] })),
    api.getCatalogUnresolvedReferences().catch(() => []),
  ]);

  const unresolvedReferences = (unresolved as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    externalReference: String(row.externalReference ?? ''),
    sourceEntity: row.sourceEntity != null ? String(row.sourceEntity) : null,
    sourceEntityId: row.sourceEntityId != null ? String(row.sourceEntityId) : null,
    createdAt: String(row.createdAt ?? ''),
  }));

  return (
    <CatalogPageClient
      initialData={itemsResult}
      types={types}
      categories={categories}
      templateCsv={template.csv}
      unresolvedReferences={unresolvedReferences}
    />
  );
}
