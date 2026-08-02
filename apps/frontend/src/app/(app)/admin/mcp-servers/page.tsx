import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { McpIntegrationsPanel } from '@/components/integrations/McpIntegrationsPanel';
import { Server } from 'lucide-react';

export const metadata = { title: 'MCP Servers — EnsureOS' };

export default async function McpServersPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
      <SetPageHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">MCP Servers</h1>
            <p className="text-sm text-slate-500">
              Register MCP integrations available to your organisation.
            </p>
          </div>
        </div>
      </SetPageHeader>
      <div className="pt-4">
        <McpIntegrationsPanel />
      </div>
    </div>
  );
}
