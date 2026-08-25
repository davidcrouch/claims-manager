import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { AdminPageHeader } from '@/components/layout/PageHeaderLayout';
import { McpConnectionsPanel } from '@/components/connections/McpConnectionsPanel';
import { Cable } from 'lucide-react';

export const metadata = { title: 'MCP Connections — EnsureOS' };

export default async function McpConnectionsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex flex-col px-6 pb-6">
      <SetPageHeader>
        <AdminPageHeader
          icon={Cable}
          title="MCP Connections"
          description="Connect to MCP servers and manage discovered tools."
        />
      </SetPageHeader>
      <div className="pt-4">
        <McpConnectionsPanel />
      </div>
    </div>
  );
}
