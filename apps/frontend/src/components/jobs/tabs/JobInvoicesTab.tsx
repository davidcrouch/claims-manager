'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { fetchJobInvoicesAction, fetchJobPurchaseOrdersAction } from '@/app/(app)/jobs/[id]/actions';
import { InvoiceFormDrawer } from '@/components/forms/InvoiceFormDrawer';
import { formatDate, formatCurrency, PhaseUnavailable } from '@/components/shared/detail';
import type { Invoice, PurchaseOrder } from '@/types/api';

export function JobInvoicesTab({ jobId }: { jobId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [invRes, pos] = await Promise.all([
        fetchJobInvoicesAction(jobId),
        fetchJobPurchaseOrdersAction(jobId),
      ]);
      if (cancelled) return;
      setInvoices(invRes.data);
      setPhaseUnavailable(invRes.phaseUnavailable);
      setPurchaseOrders(pos ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Invoices ({invoices.length})</CardTitle>
          <Button size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Submit Invoice
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {invoices.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">
              No invoices for this job.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Invoice #</th>
                    <th className="px-4 py-2">Issue date</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Sub-total</th>
                    <th className="px-4 py-2 text-right">Tax</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Excess</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {invoices.map((inv) => {
                    const statusName = inv.status?.name ?? 'Unknown';
                    return (
                      <tr key={inv.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">
                          <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                            {inv.invoiceNumber ?? inv.id}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(inv.issueDate ?? inv.createdAt)}</td>
                        <td className="px-4 py-2"><StatusBadge status={statusName} /></td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(inv.subTotal)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(inv.tax)}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(inv.totalAmount)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(inv.excessAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <InvoiceFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        purchaseOrders={purchaseOrders}
      />
    </>
  );
}
