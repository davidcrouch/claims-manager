import { getSession, getAccessToken } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) return { title: 'Invoice | Claims Manager' };

  const token = await getAccessToken();
  if (!token) return { title: 'Invoice | Claims Manager' };

  const api = createApiClient({ token });
  const invoice = await api.getInvoice(id);
  const title = invoice?.invoiceNumber ?? id;
  return { title: `${title} | Claims Manager` };
}

export default async function InvoiceDetailPage({
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
  const invoice = await api.getInvoice(id);
  if (!invoice) notFound();

  const title = invoice.invoiceNumber ?? id;

  return (
    <>
      <SetBreadcrumbs
        items={[
          { title: 'Invoices', href: '/invoices' },
          { title, href: `/invoices/${id}` },
        ]}
      />
      <InvoiceDetail invoice={invoice} />
    </>
  );
}
