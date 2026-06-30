import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ProposalsListClient } from '@/components/proposals/ProposalsListClient';
import type { PaginatedResponse, Proposal } from '@/types/api';

export const metadata = { title: 'Proposals — EnsureOS' };

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Proposal> = { data: [], total: 0 };
  const [initialData, statusLookupsRes] = await Promise.all([
    api
      .getProposals({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        sort: params.sort,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:ProposalsPage - getProposals failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('proposal_status').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <ProposalsListClient
      initialData={initialData}
      statusOptions={statusOptions}
    />
  );
}
