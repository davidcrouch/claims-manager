import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { getSession } from '@/lib/auth';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { DashboardInboxClient } from '@/components/dashboard/DashboardInboxClient';
import {
  formatDashboardDate,
  greetingForName,
} from '@/components/dashboard/dashboard-inbox.copy';
import type { DashboardInbox } from '@/types/api';

export const metadata = {
  title: 'Dashboard | EnsureOS',
};

const EMPTY_INBOX: DashboardInbox = {
  generatedAt: new Date(0).toISOString(),
  snapshot: {
    activeJobs: 0,
    unreadCount: 0,
    unreadJobCount: 0,
    arOverdueCount: 0,
    apOverdueCount: 0,
    arTotalOverdue: 0,
    apTotalOverdue: 0,
    actionRequired: 0,
  },
  queues: [],
  today: [],
  unread: [],
  activeJobs: { scopedToUser: false, count: 0, href: '/jobs', items: [], mine: { count: 0, href: '/jobs', items: [] } },
};

export default async function DashboardPage() {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const session = await getSession();
  const identity = session.identity;
  const firstName =
    identity?.given_name?.trim() ||
    identity?.name?.trim()?.split(/\s+/)[0] ||
    identity?.email?.split('@')[0] ||
    null;

  let inbox: DashboardInbox = EMPTY_INBOX;
  try {
    inbox = await api.getDashboardInbox();
  } catch (err) {
    console.error('frontend:DashboardPage - inbox fetch failed:', err);
  }

  const actionRequired = inbox.snapshot.actionRequired ?? 0;
  const subtitle =
    `${formatDashboardDate()}` +
    (actionRequired > 0
      ? ` · ${actionRequired} item${actionRequired === 1 ? '' : 's'} need a decision`
      : ' · All clear on decisions');

  return (
    <>
      <SetPageHeader>
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="shrink-0 text-2xl font-semibold leading-tight text-white">
            {greetingForName(firstName)}
          </h1>
          <p className="truncate text-sm text-white/70">{subtitle}</p>
        </div>
      </SetPageHeader>

      <DashboardInboxClient inbox={inbox} />
    </>
  );
}
