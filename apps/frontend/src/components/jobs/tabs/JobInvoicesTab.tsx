'use client';

import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { fetchJobInvoicesAction } from '@/app/(app)/jobs/[id]/actions';
import { formatDate, formatCurrency, PhaseUnavailable } from '@/components/shared/detail';
import type { Invoice } from '@/types/api';

export function JobInvoicesTab({ jobId }: { jobId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchJobInvoicesAction(jobId);
      if (cancelled) return;
      setInvoices(res.data);
      setPhaseUnavailable(res.phaseUnavailable);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Invoices ({invoices.length})
        </CardTitle>
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
                        {inv.invoiceNumber ?? inv.id}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(inv.issueDate ?? inv.createdAt)}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={statusName} />
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {formatCurrency(inv.subTotal)}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {formatCurrency(inv.tax)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {formatCurrency(inv.excessAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
