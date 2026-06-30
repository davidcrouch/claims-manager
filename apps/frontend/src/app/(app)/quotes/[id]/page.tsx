import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { QuoteDetail, QuotePageHeader } from '@/components/quotes/QuoteDetail';
import type { Metadata } from 'next';
import type { CatalogType } from '@/types/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Estimate | EnsureOS' };

  const quote = await api.getQuote(id).catch(() => null);
  const title = quote?.name ?? quote?.quoteNumber ?? quote?.externalReference ?? id;
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

  const quote = await api.getQuote(id).catch((err: unknown) => {
    console.error(
      'frontend:QuoteDetailPage - getQuote failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  if (!quote) notFound();

  let jobProvider: CatalogType | undefined;
  if (quote.jobId) {
    const job = await api.getJob(quote.jobId).catch(() => null);
    if (job?.provider === 'crunchwork') {
      jobProvider = 'crunchwork';
    } else {
      jobProvider = 'internal';
    }
  }

  return (
    <>
      <SetPageHeader>
        <QuotePageHeader quote={quote} />
      </SetPageHeader>
      <QuoteDetail quote={quote} jobProvider={jobProvider} />
    </>
  );
}
