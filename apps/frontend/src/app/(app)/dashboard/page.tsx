import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  FileText,
  Briefcase,
  Receipt,
  ClipboardCheck,
  FileQuestion,
  FileInput,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  CheckSquare,
  CalendarCheck,
  MessageSquare,
  AlertTriangle,
  LayoutDashboard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const metadata = {
  title: 'Dashboard | EnsureOS',
};

function MetricCard({
  title,
  value,
  subtitle,
  href,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  let stats: Awaited<ReturnType<typeof api.getDashboardStats>> | null = null;
  let recentActivity: Awaited<ReturnType<typeof api.getDashboardRecentActivity>> = [];

  try {
    [stats, recentActivity] = await Promise.all([
      api.getDashboardStats(),
      api.getDashboardRecentActivity(20),
    ]);
  } catch (err) {
    console.error('frontend:DashboardPage - fetch failed:', err);
  }

  return (
    <>
      <SetPageHeader>
        <div className="flex w-full flex-wrap items-center gap-3">
          <LayoutDashboard className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h1 className="text-lg font-semibold leading-tight">Dashboard</h1>
        </div>
      </SetPageHeader>

      <div className="space-y-8">
        <DashboardSection title="Customers">
          <MetricCard
            title="Claims"
            value={stats?.totalClaims ?? 0}
            href="/claims"
            icon={FileText}
          />
          <MetricCard
            title="Jobs"
            value={stats?.totalJobs ?? 0}
            href="/jobs"
            icon={Briefcase}
          />
          <MetricCard
            title="Open Invoices"
            value={stats?.openInvoices ?? 0}
            href="/invoices"
            icon={Receipt}
          />
          <MetricCard
            title="Work Orders"
            value={stats?.openWorkOrders ?? 0}
            subtitle="open"
            href="/work-orders"
            icon={ClipboardCheck}
          />
        </DashboardSection>

        <DashboardSection title="Vendors">
          <MetricCard
            title="RFQs"
            value={stats?.pendingRfqs ?? 0}
            subtitle="pending"
            href="/rfqs"
            icon={FileQuestion}
          />
          <MetricCard
            title="Proposals"
            value={stats?.pendingProposals ?? 0}
            subtitle="under review"
            href="/proposals"
            icon={FileInput}
          />
          <MetricCard
            title="Bills"
            value={stats?.outstandingBills ?? 0}
            subtitle="outstanding"
            href="/bills"
            icon={ReceiptText}
          />
        </DashboardSection>

        <DashboardSection title="Finance">
          <MetricCard
            title="AR Outstanding"
            value={stats?.arTotalOutstanding != null ? `$${Number(stats.arTotalOutstanding).toLocaleString()}` : '$0'}
            subtitle={stats?.arOverdueCount ? `${stats.arOverdueCount} overdue` : undefined}
            href="/finance/ar"
            icon={TrendingUp}
          />
          <MetricCard
            title="AP Outstanding"
            value={stats?.apTotalOutstanding != null ? `$${Number(stats.apTotalOutstanding).toLocaleString()}` : '$0'}
            subtitle={stats?.apOverdueCount ? `${stats.apOverdueCount} overdue` : undefined}
            href="/finance/ap"
            icon={TrendingDown}
          />
        </DashboardSection>

        <DashboardSection title="Operations">
          <MetricCard
            title="Open Tasks"
            value={stats?.openTasks ?? 0}
            href="/tasks?status=Open"
            icon={CheckSquare}
          />
          <MetricCard
            title="Appointments"
            value={stats?.upcomingAppointments ?? 0}
            subtitle="next 7 days"
            href="/appointments"
            icon={CalendarCheck}
          />
          <MetricCard
            title="Messages"
            value={stats?.unreadMessages ?? 0}
            subtitle="unread"
            href="/messages"
            icon={MessageSquare}
          />
          <MetricCard
            title="Overdue Tasks"
            value={stats?.overdueTaskCount ?? 0}
            href="/tasks?status=Open&overdue=true"
            icon={AlertTriangle}
          />
        </DashboardSection>

        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Upcoming
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Upcoming Appointments</span>
              </CardHeader>
              <CardContent>
                {stats?.upcomingAppointments ? (
                  <div>
                    <p className="text-sm">
                      You have {stats.upcomingAppointments} appointment(s) in the next 7 days.
                    </p>
                    <Link
                      href="/appointments"
                      className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                      View all →
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Overdue Tasks</span>
              </CardHeader>
              <CardContent>
                {stats?.overdueTaskCount ? (
                  <div>
                    <p className="text-sm">
                      You have{' '}
                      <span className="font-semibold text-destructive">{stats.overdueTaskCount}</span>{' '}
                      overdue task(s) that need attention.
                    </p>
                    <Link
                      href="/tasks?status=Open&overdue=true"
                      className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                      View all →
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No overdue tasks.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent activity.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{item.description}</span>
                    <span className="text-muted-foreground">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
