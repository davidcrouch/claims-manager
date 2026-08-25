import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { AdminPageHeader } from '@/components/layout/PageHeaderLayout';
import { McpIntegrationsPanel } from '@/components/integrations/McpIntegrationsPanel';
import { Server } from 'lucide-react';

export const metadata = { title: 'MCP Servers — EnsureOS' };

export default async function McpServersPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex flex-col px-6 pb-6">
      <SetPageHeader>
        <AdminPageHeader
          icon={Server}
          title="MCP Servers"
          description="Register MCP integrations available to your organisation."
        />
      </SetPageHeader>
      <div className="pt-4">
        <McpIntegrationsPanel />
      </div>
    </div>
  );
}
