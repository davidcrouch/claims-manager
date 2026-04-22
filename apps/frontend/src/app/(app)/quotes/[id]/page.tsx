import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { QuoteDetail } from '@/components/quotes/QuoteDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Quote | EnsureOS' };

  const quote = await api.getQuote(id).catch(() => null);
  const title = quote?.quoteNumber ?? quote?.externalReference ?? id;
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

  const title = quote.quoteNumber ?? quote.externalReference ?? id;

  return (
    <>
      <SetBreadcrumbs
        items={[
          { title: 'Quotes', href: '/quotes' },
          { title, href: `/quotes/${id}` },
        ]}
      />
      <QuoteDetail quote={quote} />
    </>
  );
}
