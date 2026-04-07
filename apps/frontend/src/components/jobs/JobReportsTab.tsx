'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchJobReportsAction } from '@/app/(app)/jobs/[id]/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReportFormDrawer } from '@/components/forms/ReportFormDrawer';
import type { Report } from '@/types/api';
import { FileBarChart } from 'lucide-react';

export function JobReportsTab({ jobId, claimId }: { jobId: string; claimId: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobReportsAction(jobId);
      setReports(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

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
          if (!open) loadReports();
        }}
        jobId={jobId}
        claimId={claimId}
      />
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-3">
                <Link href={`/reports/${r.id}`} className="font-medium hover:underline">
                  {r.title ?? r.reference ?? r.id}
                </Link>
                <p className="text-sm text-muted-foreground mt-1">
                  {(r.status as { name?: string })?.name ?? '—'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
