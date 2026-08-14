import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SkillsListPanel } from '@/components/skills/SkillsListPanel';
import { Sparkles } from 'lucide-react';
import { SetPageHeader } from '@/components/layout/SetPageHeader';

export const metadata = { title: 'Skills — EnsureOS' };

export default async function SkillsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex flex-col px-6 pb-6">
      <SetPageHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-sidebar-foreground">AI Skills</h1>
            <p className="text-sm text-sidebar-foreground/65">
              Define reusable instruction prompts triggered by keywords or agent pins.
            </p>
          </div>
        </div>
      </SetPageHeader>
      <div className="pt-4">
        <SkillsListPanel />
      </div>
    </div>
  );
}
