import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Invoice | Claims Manager' };

  const invoice = await api.getInvoice(id).catch(() => null);
  const title = invoice?.invoiceNumber ?? id;
  return { title: `${title} | Claims Manager` };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const invoice = await api.getInvoice(id).catch((err: unknown) => {
    console.error(
      'frontend:InvoiceDetailPage - getInvoice failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
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
