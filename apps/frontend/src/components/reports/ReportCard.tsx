'use client';

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { EntityCard } from '@/components/ui/entity-card';
import type { Report } from '@/types/api';

export function ReportCard({ report }: { report: Report }) {
  const title = report.title ?? report.reference ?? report.id;
  const statusName = (report.status as { name?: string })?.name ?? 'Unknown';

  return (
    <EntityCard
      href={`/reports/${report.id}`}
      icon={ClipboardList}
      accentColor="border-l-cyan-500"
      title={title}
      subtitle={report.jobId ? `Job: ${report.jobId}` : undefined}
      badge={statusName}
      footer={
        <>
          {report.jobId && (
            <Link href={`/jobs/${report.jobId}`} className="hover:underline">
              View job
            </Link>
          )}
        </>
      }
    />
  );
}
