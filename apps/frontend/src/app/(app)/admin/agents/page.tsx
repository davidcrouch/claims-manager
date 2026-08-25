import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { AgentsListPanel } from '@/components/agents/AgentsListPanel';
import { Bot } from 'lucide-react';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { AdminPageHeader } from '@/components/layout/PageHeaderLayout';

export const metadata = { title: 'Agents — EnsureOS' };

export default async function AgentsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex flex-col px-6 pb-6">
      <SetPageHeader>
        <AdminPageHeader
          icon={Bot}
          title="AI Agents"
          description="Configure chat agents, models, and tool access."
        />
      </SetPageHeader>
      <div className="pt-4">
        <AgentsListPanel />
      </div>
    </div>
  );
}
