import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FileText, Briefcase, ClipboardCheck, Receipt } from 'lucide-react';

export const metadata = {
  title: 'Dashboard | EnsureOS',
};

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
    console.error('[DashboardPage] Failed to fetch dashboard data:', err);
  }

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Dashboard', href: '/dashboard' }]} />
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>

        {/* KPI widgets */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Claims
              </span>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalClaims ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Jobs
              </span>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalJobs ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Pending Approvals
              </span>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.pendingApprovals ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Open Invoices
              </span>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.openInvoices ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
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
