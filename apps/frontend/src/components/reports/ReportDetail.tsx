'use client';

import Link from 'next/link';
import { ClipboardList, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Report } from '@/types/api';

export function ReportPageHeader({ report }: { report: Report }) {
  const title = report.title ?? report.reference ?? report.id;
  const statusName = (report.status as { name?: string })?.name ?? 'Unknown';

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
      <ClipboardList className="h-5 w-5 shrink-0 text-muted-foreground" />
      <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
      <StatusBadge status={statusName} />
      {report.jobId && (
        <Link
          href={`/jobs/${report.jobId}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View job
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export function ReportDetail({ report }: { report: Report }) {
  const reportData = report.reportData as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
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
