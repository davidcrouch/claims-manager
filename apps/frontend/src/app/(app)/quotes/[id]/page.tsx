import { getSession, getAccessToken } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { QuoteDetail } from '@/components/quotes/QuoteDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) return { title: 'Quote | Claims Manager' };

  const token = await getAccessToken();
  if (!token) return { title: 'Quote | Claims Manager' };

  const api = createApiClient({ token });
  const quote = await api.getQuote(id);
  const title = quote?.quoteNumber ?? quote?.externalReference ?? id;
  return { title: `${title} | Claims Manager` };
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) redirect('/api/auth/login');

  const token = await getAccessToken();
  if (!token) redirect('/api/auth/login');

  const api = createApiClient({ token });
  const quote = await api.getQuote(id);
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
