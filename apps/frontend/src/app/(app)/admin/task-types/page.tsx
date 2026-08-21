import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { TaskTypesSettingsPanel } from '@/components/admin/TaskTypesSettingsPanel';
import { listTaskTypeMappingsAction } from './actions';

export const metadata = { title: 'Task Types — EnsureOS' };

export default async function TaskTypesAdminPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const session = await getSession();
  const permissions = session.identity?.permissions ?? [];
  const canManage = hasPermission(permissions, 'org.settings.manage');

  const { mappings, taskTypes, error } = await listTaskTypeMappingsAction();

  return (
    <TaskTypesSettingsPanel
      initialMappings={mappings}
      taskTypes={taskTypes}
      initialError={error}
      canManage={canManage}
    />
  );
}
