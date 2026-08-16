import { redirect } from 'next/navigation';
import { RolesManagementPage } from '@/components/admin/RolesManagementPage';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const metadata = { title: 'Roles & Permissions — EnsureOS' };

export default async function AdminRolesPage() {
  const session = await getSession();
  if (!session.authenticated) redirect('/api/auth/login');
  if (!hasPermission(session.identity?.permissions, 'org.roles.read')) {
    redirect('/dashboard');
  }
  return <RolesManagementPage />;
}
