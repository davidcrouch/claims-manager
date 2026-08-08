import Link from 'next/link';
import { Briefcase, ChevronRight } from 'lucide-react';
import type { DashboardActiveJobItem } from '@/types/api';
import { DASHBOARD_EMPTY_COPY, formatShortDate } from './dashboard-inbox.copy';

function StatusPill({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const tone =
    lower.includes('progress') || lower === 'active' || lower === 'accepted'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
      : lower.includes('pending') || lower.includes('received') || lower.includes('review')
        ? 'bg-amber-50 text-amber-900 ring-amber-200/80'
        : 'bg-slate-100 text-slate-700 ring-slate-200/80';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}>
      {status}
    </span>
  );
}

export function DashboardActiveJobs({
  title,
  count,
  href,
  items,
}: {
  title: string;
  count: number;
  href: string;
  items: DashboardActiveJobItem[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex min-h-20 items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {count === 0 ? 'Nothing currently in progress' : `${count} open ${count === 1 ? 'job' : 'jobs'}`}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
          <Briefcase className="h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">{DASHBOARD_EMPTY_COPY.activeJobs}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((job) => (
            <li key={job.id}>
              <Link
                href={job.href}
                className="grid grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {job.unread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" title="Unread" />
                    )}
                    <span className="truncate font-medium text-slate-900">{job.title}</span>
                  </div>
                  {job.address && (
                    <p className="mt-0.5 truncate text-sm text-slate-500">{job.address}</p>
                  )}
                </div>
                <div className="hidden sm:block">
                  {job.status ? <StatusPill status={job.status} /> : null}
                </div>
                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-sm text-slate-600">{job.jobType || '—'}</p>
                </div>
                <div className="text-right text-xs tabular-nums text-slate-500">
                  {formatShortDate(job.updatedAt ?? job.requestDate) ?? ''}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
