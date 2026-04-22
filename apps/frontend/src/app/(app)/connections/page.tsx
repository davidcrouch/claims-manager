import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { ConnectionsPageClient } from '@/components/connections/ConnectionsPageClient';

export default async function ConnectionsPage() {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const connections = await api.getConnections().catch((err: unknown) => {
    console.error(
      'frontend:ConnectionsPage - getConnections failed:',
      err instanceof Error ? err.message : err,
    );
    return [];
  });

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Connections', href: '/connections' }]} />
      <ConnectionsPageClient connections={connections} />
    </>
  );
}
