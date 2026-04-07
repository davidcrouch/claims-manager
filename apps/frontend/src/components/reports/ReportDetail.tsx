'use client';

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Report } from '@/types/api';

export function ReportDetail({ report }: { report: Report }) {
  const title = report.title ?? report.reference ?? report.id;
  const statusName = (report.status as { name?: string })?.name ?? 'Unknown';
  const reportData = report.reportData as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          {title}
        </h1>
        <StatusBadge status={statusName} className="mt-2" />
        {report.jobId && (
          <p className="mt-2 text-sm text-muted-foreground">
            <Link href={`/jobs/${report.jobId}`} className="hover:underline">
              View job
            </Link>
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-medium">Report Data</h2>
        </CardHeader>
        <CardContent className="text-sm">
          {reportData && Object.keys(reportData).length > 0 ? (
            <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-md">
              {JSON.stringify(reportData, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground">No report data.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
