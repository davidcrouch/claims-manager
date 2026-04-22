'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileBarChart, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ReportFormDrawer } from '@/components/forms/ReportFormDrawer';
import { fetchJobReportsAction } from '@/app/(app)/jobs/[id]/actions';
import { formatDate } from '@/components/shared/detail';
import type { Report } from '@/types/api';

export function JobReportsTab({
  jobId,
  claimId,
}: {
  jobId: string;
  claimId: string;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobReportsAction(jobId);
      setReports(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDrawerOpen(true)} size="sm">
          <FileBarChart className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>
      <ReportFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) load();
        }}
        jobId={jobId}
        claimId={claimId}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
            Reports ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <p className="px-4 text-sm text-muted-foreground">Loading...</p>
          ) : reports.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">No reports.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Reference</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Updated</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {reports.map((r) => {
                    const statusName = r.status?.name ?? 'Unknown';
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">
                          {r.title ?? r.id}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {r.reference ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {r.reportType?.name ?? '—'}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={statusName} />
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDate(r.updatedAt)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            href={`/reports/${r.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </Link>
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
    </div>
  );
}
