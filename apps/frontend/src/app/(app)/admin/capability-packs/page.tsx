import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { CapabilityPacksPanel } from '@/components/capability-packs/CapabilityPacksPanel';
import { Package } from 'lucide-react';

export const metadata = { title: 'Capability Packs — EnsureOS' };

export default async function CapabilityPacksPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex flex-col px-6 pb-6">
      <SetPageHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-sidebar-foreground">Capability Packs</h1>
            <p className="text-sm text-sidebar-foreground/65">
              Functional packs of agents, skills, and MCP tools for workflows.
            </p>
          </div>
        </div>
      </SetPageHeader>
      <div className="pt-4">
        <CapabilityPacksPanel />
      </div>
    </div>
  );
}
