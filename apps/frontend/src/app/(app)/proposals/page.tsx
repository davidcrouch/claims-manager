import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ProposalsPageClient } from '@/components/proposals/ProposalsPageClient';
import { buildJobNameById, toJobOptions } from '@/components/shared/job-label';
import type { Job, PaginatedResponse, Proposal, Claim } from '@/types/api';

export const metadata = { title: 'Proposals — EnsureOS' };

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; status?: string; vendorId?: string; jobId?: string; search?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Proposal> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const [initialData, statusLookupsRes, vendorsRes, jobsRes] = await Promise.all([
    api
      .getProposals({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        sort: params.sort,
        status: params.status,
        vendorId: params.vendorId,
        jobId: params.jobId,
        search: params.search,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:ProposalsPage - getProposals failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('proposal_status').catch(() => []),
    api.getVendors({ limit: 100 }).catch(() => ({ data: [] })),
    api.getJobs({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:ProposalsPage - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyJobs;
    }),
  ]);

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:ProposalsPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const vendorOptions = (vendorsRes.data ?? []).map((vendor) => ({
    id: vendor.id,
    name: vendor.name?.trim() ? vendor.name : 'Unknown',
  }));
  const jobs = jobsRes?.data ?? [];
  const jobNameById = buildJobNameById(jobs);

  return (
    <ProposalsPageClient
      initialData={initialData}
      statusOptions={statusOptions}
      vendorOptions={vendorOptions}
      jobNameById={jobNameById}
      jobs={toJobOptions(jobs)}
      job={job}
      parentClaim={parentClaim}
    />
  );
}
