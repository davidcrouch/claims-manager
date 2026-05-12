'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Construction } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'connections', label: 'Connections' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'notifications', label: 'Notifications' },
] as const;

interface Props {
  initialTab: string;
  connections: unknown[];
}

export function SettingsPageClient({ initialTab, connections }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? initialTab;

  function switchTab(tabId: string) {
    router.push(`/admin/settings?tab=${tabId}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>
        {activeTab === 'connections' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manage your integration connections. {connections.length}{' '}
              connection(s) configured.
            </p>
            {connections.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No connections configured.
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">
                        Provider
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((conn: any) => (
                      <tr key={conn.id} className="border-b">
                        <td className="px-4 py-3 font-medium">
                          {conn.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {conn.providerCode ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {conn.isActive ? 'Active' : 'Inactive'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
            <Construction className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {activeTab === 'general' &&
                'Organisation settings coming soon.'}
              {activeTab === 'integrations' &&
                'Integration settings coming soon.'}
              {activeTab === 'notifications' &&
                'Notification preferences coming soon.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
