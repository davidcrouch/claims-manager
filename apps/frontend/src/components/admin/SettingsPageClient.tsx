'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Settings,
  Plug,
  Bell,
  CreditCard,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { cn } from '@/lib/utils';

interface Connection {
  id: string;
  name?: string;
  providerCode?: string;
  isActive?: boolean;
  lastSyncAt?: string;
}

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'connections', label: 'Connections', icon: Plug },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'billing', label: 'Billing', icon: CreditCard },
] as const;

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

interface Props {
  initialTab: string;
  connections: Connection[];
}

export function SettingsPageClient({ initialTab, connections }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? initialTab;

  function switchTab(tabId: string) {
    router.push(`/admin/settings?tab=${tabId}`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Settings}
          title="Settings"
          total={0}
          accent="slate"
        />
      </SetPageHeader>

      <div className="px-6 pt-1">
        <div className="flex gap-0 border-b border-slate-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md',
                  active
                    ? 'border-slate-600 bg-slate-50 text-slate-800'
                    : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 pt-4" style={{ minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'general' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Organisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Organisation Name</label>
                    <input type="text" disabled placeholder="Your organisation name" className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">ABN / Business Number</label>
                    <input type="text" disabled placeholder="Business registration number" className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Contact Email</label>
                    <input type="email" disabled placeholder="admin@example.com" className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <input type="tel" disabled placeholder="+61 ..." className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <input type="text" disabled placeholder="Organisation address" className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Organisation settings will be editable once the settings API is connected.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Manage your integration connections.{' '}
                {connections.length} connection(s) configured.
              </p>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Add Connection
              </Button>
            </div>

            {connections.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No connections configured.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-4 py-3">Provider</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3">Last Sync</th>
                      <th scope="col" className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {connections.map((conn) => (
                      <tr key={conn.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {conn.name ?? conn.providerCode ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={conn.isActive ? 'Connected' : 'Disconnected'}
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDateTime(conn.lastSyncAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                            >
                              Test
                            </button>
                            <button
                              type="button"
                              className="text-xs text-destructive hover:underline"
                            >
                              Disconnect
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Email Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {['New claim received', 'Job status changed', 'Invoice submitted', 'Work order issued', 'Task overdue'].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                    <span className="text-sm">{item}</span>
                    <div className="h-5 w-9 rounded-full bg-muted/50" title="Toggle will be functional once the notifications API is connected" />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Notification preferences will be configurable once the notifications API is connected.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Webhook Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Configure webhook endpoints to receive real-time event notifications from the platform.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Plan information unavailable</p>
                    <p className="text-xs text-muted-foreground">Subscription details will appear here once billing is configured.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No payment method on file. Payment configuration will be available once billing is set up.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Billing History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No billing history available yet.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
