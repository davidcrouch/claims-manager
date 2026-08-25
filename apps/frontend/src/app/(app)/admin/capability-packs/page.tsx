import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { AdminPageHeader } from '@/components/layout/PageHeaderLayout';
import { CapabilityPacksPanel } from '@/components/capability-packs/CapabilityPacksPanel';
import { Package } from 'lucide-react';

export const metadata = { title: 'Capability Packs — EnsureOS' };

export default async function CapabilityPacksPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex flex-col px-6 pb-6">
      <SetPageHeader>
        <AdminPageHeader
          icon={Package}
          title="Capability Packs"
          description="Functional packs of agents, skills, and MCP tools for workflows."
        />
      </SetPageHeader>
      <div className="pt-4">
        <CapabilityPacksPanel />
      </div>
    </div>
  );
}
