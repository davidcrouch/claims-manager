import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { loadClaim, loadJob, loadQuote } from '@/lib/cached-entity-loaders';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { QuoteDetail, QuotePageHeader } from '@/components/quotes/QuoteDetail';
import type { Metadata } from 'next';
import type { CatalogType, Claim, Job } from '@/types/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const quote = await loadQuote(id);
  const title = quote?.internalNumber ?? quote?.name ?? quote?.quoteNumber ?? quote?.externalReference ?? id;
  return { title: `${title} | EnsureOS` };
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const quote = await loadQuote(id);
  if (!quote) notFound();

  let jobProvider: CatalogType | undefined;
  let job: Job | null = null;
  if (quote.jobId) {
    job = await loadJob(quote.jobId);
    if (job?.provider === 'crunchwork') {
      jobProvider = 'crunchwork';
    } else {
      jobProvider = 'internal';
    }
  }

  let claim: Claim | null = job?.claim ?? null;
  const claimId = quote.claimId ?? job?.claimId ?? job?.parentClaimId ?? null;
  if (!claim && claimId) {
    claim = await loadClaim(claimId);
  }

  return (
    <>
      <SetPageHeader>
        <QuotePageHeader quote={quote} job={job} claim={claim} />
      </SetPageHeader>
      <QuoteDetail quote={quote} job={job} claim={claim} jobProvider={jobProvider} />
    </>
  );
}
