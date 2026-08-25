import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SkillsListPanel } from '@/components/skills/SkillsListPanel';
import { Sparkles } from 'lucide-react';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { AdminPageHeader } from '@/components/layout/PageHeaderLayout';

export const metadata = { title: 'Skills — EnsureOS' };

export default async function SkillsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  return (
    <div className="flex flex-col px-6 pb-6">
      <SetPageHeader>
        <AdminPageHeader
          icon={Sparkles}
          title="AI Skills"
          description="Define reusable instruction prompts triggered by keywords or agent pins."
        />
      </SetPageHeader>
      <div className="pt-4">
        <SkillsListPanel />
      </div>
    </div>
  );
}
