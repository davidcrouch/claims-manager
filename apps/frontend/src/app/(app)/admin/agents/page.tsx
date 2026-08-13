import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { AgentsListPanel } from '@/components/agents/AgentsListPanel';
import { Bot } from 'lucide-react';
import { SetPageHeader } from '@/components/layout/SetPageHeader';

export const metadata = { title: 'Agents — EnsureOS' };

export default async function AgentsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex flex-col px-6 pb-6">
      <SetPageHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">AI Agents</h1>
            <p className="text-sm text-slate-500">
              Configure chat agents, models, and tool access.
            </p>
          </div>
        </div>
      </SetPageHeader>
      <div className="pt-4">
        <AgentsListPanel />
      </div>
    </div>
  );
}
