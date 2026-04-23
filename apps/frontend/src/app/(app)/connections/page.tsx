import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
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

  return <ConnectionsPageClient connections={connections} />;
}
