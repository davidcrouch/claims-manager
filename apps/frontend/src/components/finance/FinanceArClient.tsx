'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { AgingBucket } from '@/types/api';

interface Props {
  summary: {
    buckets: AgingBucket[];
    totalOutstanding: number;
    totalOverdue: number;
    totalPaid: number;
  };
}

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinanceArClient({ summary }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Accounts Receivable</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Outstanding</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(summary.totalOutstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Overdue</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{fmt(summary.totalOverdue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Paid</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmt(summary.totalPaid)}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Aging Buckets</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {summary.buckets.length === 0 ? (
            <p className="col-span-5 py-8 text-center text-sm text-muted-foreground">
              No outstanding invoices.
            </p>
          ) : (
            summary.buckets.map((bucket) => (
              <Card key={bucket.label} className="text-center">
                <CardContent className="pt-4">
                  <div className="text-xs font-medium text-muted-foreground">{bucket.label}</div>
                  <div className="mt-1 text-lg font-bold">{fmt(bucket.totalAmount)}</div>
                  <div className="text-xs text-muted-foreground">{bucket.count} invoice(s)</div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
