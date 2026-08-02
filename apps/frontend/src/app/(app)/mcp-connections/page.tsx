import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { McpConnectionsPanel } from '@/components/connections/McpConnectionsPanel';
import { Cable } from 'lucide-react';

export const metadata = { title: 'MCP Connections — EnsureOS' };

export default async function McpConnectionsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
      <SetPageHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Cable className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">MCP Connections</h1>
            <p className="text-sm text-slate-500">
              Connect to MCP servers and manage discovered tools.
            </p>
          </div>
        </div>
      </SetPageHeader>
      <div className="pt-4">
        <McpConnectionsPanel />
      </div>
    </div>
  );
}
