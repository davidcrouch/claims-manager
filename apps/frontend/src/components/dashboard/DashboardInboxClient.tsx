import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { DashboardInbox, DashboardInboxItem, DashboardInboxQueue, InboxQueueKey } from '@/types/api';
import { DashboardSnapshotBar } from './DashboardSnapshotBar';
import { DashboardActiveJobs } from './DashboardActiveJobs';
import { InboxRow } from './InboxRow';
import {
  DASHBOARD_EMPTY_COPY,
  formatEventTime,
} from './dashboard-inbox.copy';

const DECISION_KEYS: InboxQueueKey[] = [
  'workOrdersToAccept',
  'proposalsToReview',
  'rfqsAwaiting',
  'estimatesToPublish',
];

function queuesByKey(queues: DashboardInboxQueue[], keys: InboxQueueKey[]) {
  const set = new Set(keys);
  return queues.filter((q) => set.has(q.key));
}

function findQueue(queues: DashboardInboxQueue[], key: InboxQueueKey) {
  return queues.find((q) => q.key === key);
}

function RailPanel({
  id,
  title,
  href,
  hrefLabel = 'View all',
  className,
  children,
}: {
  id?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ${className ?? ''}`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-600 hover:text-slate-900">
            {hrefLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="min-h-0 flex-1 px-2 py-1">{children}</div>
    </section>
  );
}

export function DashboardInboxClient({
  inbox,
}: {
  inbox: DashboardInbox;
}) {
  const decisionQueues = queuesByKey(inbox.queues, DECISION_KEYS);
  const overdueTasks = findQueue(inbox.queues, 'overdueTasks');
  const myTasks = findQueue(inbox.queues, 'myTasks');
  const attentionItems: DashboardInboxItem[] = [
    ...decisionQueues.flatMap((queue) => queue.items),
    ...(overdueTasks?.items ?? []),
  ].slice(0, 8);
  const jobsTitle = inbox.activeJobs?.scopedToUser ? 'Your active jobs' : 'Active jobs';

  const todayPanel = (
    <RailPanel className="h-full" title="Today" href="/schedule" hrefLabel="Schedule">
      {inbox.today.length === 0 ? (
        <p className="px-2 py-2 text-sm text-slate-500">{DASHBOARD_EMPTY_COPY.today}</p>
      ) : (
        <ul>
          {inbox.today.map((item) => (
            <li key={`${item.entityType}-${item.id}`} className="flex items-start gap-1">
              <span className="w-12 shrink-0 pt-2.5 text-right text-[11px] font-medium tabular-nums text-slate-500">
                {formatEventTime(item.dueAt) ?? '—'}
              </span>
              <div className="min-w-0 flex-1">
                <InboxRow item={item} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </RailPanel>
  );

  return (
    <div className="-mx-1 space-y-6">
      <div className="grid grid-cols-2 items-stretch gap-x-2 gap-y-6 sm:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(18rem,22rem)]">
        <DashboardSnapshotBar snapshot={inbox.snapshot} />
        <div className="col-span-2 min-h-[7.5rem] sm:col-span-3 xl:col-span-1">{todayPanel}</div>

        <div className="col-span-2 sm:col-span-3 xl:col-span-4">
          <DashboardActiveJobs
            title={jobsTitle}
            count={inbox.activeJobs?.count ?? inbox.snapshot.activeJobs}
            href={inbox.activeJobs?.href ?? '/jobs'}
            items={inbox.activeJobs?.items ?? []}
          />
        </div>

        <div className="col-span-2 space-y-4 sm:col-span-3 xl:col-span-2">
          <RailPanel id="attention" title="Needs a decision">
            {decisionQueues.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-1.5 px-2 pt-2">
                {decisionQueues.map((queue) => (
                  <Link
                    key={queue.key}
                    href={queue.href}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                  >
                    {queue.title.replace(/ to accept| to review| waiting on vendors| ready to publish/gi, '')}{' '}
                    {queue.count}
                  </Link>
                ))}
              </div>
            )}
            {attentionItems.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500">{DASHBOARD_EMPTY_COPY.decisions}</p>
            ) : (
              <ul>
                {attentionItems.map((item) => (
                  <li key={`${item.entityType}-${item.id}`}>
                    <InboxRow item={item} emphasizeOverdue={item.entityType === 'task'} />
                  </li>
                ))}
              </ul>
            )}
          </RailPanel>

          {myTasks && (
            <RailPanel title="My tasks" href={myTasks.href}>
              <ul>
                {myTasks.items.map((item) => (
                  <li key={item.id}>
                    <InboxRow item={item} emphasizeOverdue />
                  </li>
                ))}
              </ul>
            </RailPanel>
          )}

          <RailPanel id="unread" title="New and unread">
            {inbox.unread.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500">{DASHBOARD_EMPTY_COPY.unread}</p>
            ) : (
              <ul>
                {inbox.unread.map((item) => (
                  <li key={item.id}>
                    <InboxRow item={item} />
                  </li>
                ))}
              </ul>
            )}
          </RailPanel>
        </div>
      </div>
    </div>
  );
}
