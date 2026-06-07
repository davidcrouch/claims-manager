'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  ExternalLink,
  FileText,
  Calendar,
  Paperclip,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  DefRow,
  SectionCard,
  formatDate,
  formatDateTime,
  pick,
  asString,
  type Dict,
} from '@/components/shared/detail';
import type { Report } from '@/types/api';

function getPayload(report: Report): Dict {
  return (report.reportData as Dict | undefined) ?? {};
}

export function ReportPageHeader({ report }: { report: Report }) {
  const title = report.title ?? report.reference ?? report.id;
  const statusName = (report.status as { name?: string })?.name ?? 'Unknown';
  const typeName = (report.reportType as { name?: string })?.name;

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href="/reports" label="Back to reports" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
        <StatusBadge status={statusName} />
        {typeName && (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {typeName}
          </span>
        )}
        {report.jobId && (
          <Link
            href={`/jobs/${report.jobId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View Job <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Created:</span>
          <span className="font-medium">{formatDate(report.createdAt)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium">{formatDate(report.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

type ReportTab = 'overview' | 'attachments' | 'timeline';

export function ReportDetail({ report }: { report: Report }) {
  const [tab, setTab] = useState<ReportTab>('overview');
  const payload = getPayload(report);

  const tabs: Array<{
    id: ReportTab;
    label: string;
    icon: typeof FileText;
  }> = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
    { id: 'timeline', label: 'Timeline', icon: Clock },
  ];

  const statusName = (report.status as { name?: string })?.name ?? 'Unknown';
  const typeName = (report.reportType as { name?: string })?.name ?? '—';
  const createdBy = asString(pick(payload, 'createdBy', 'author')) ?? '—';
  const bodyHtml = asString(pick(payload, 'body', 'content', 'htmlContent')) ?? '';

  return (
    <div className="flex flex-col">
      <div className="flex gap-0 border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md ${
                active
                  ? 'border-slate-600 bg-slate-50 text-slate-800'
                  : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="pt-4">
        {tab === 'overview' && (
          <div className="space-y-4">
            <SectionCard
              title="Report Information"
              icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            >
              <DefRow label="Type" value={typeName} />
              <DefRow label="Status" value={statusName} />
              <DefRow
                label="Job"
                value={
                  report.jobId ? (
                    <Link
                      href={`/jobs/${report.jobId}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {report.jobId}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <DefRow label="Reference" value={report.reference ?? '—'} />
              <DefRow label="Created" value={formatDateTime(report.createdAt)} />
              <DefRow label="Created by" value={createdBy} />
            </SectionCard>

            {bodyHtml ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Body</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Report Data</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {Object.keys(payload).length > 0 ? (
                    <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-md">
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground">No report data.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === 'attachments' && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Attachments linked to this report will appear here once the
                attachments API is connected.
              </p>
            </CardContent>
          </Card>
        )}

        {tab === 'timeline' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DefRow label="Created" value={formatDateTime(report.createdAt)} />
                <DefRow label="Updated" value={formatDateTime(report.updatedAt)} />
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
