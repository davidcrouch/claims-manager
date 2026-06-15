import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ConnectionsPageClient } from '@/components/connections/ConnectionsPageClient';

export const metadata = { title: 'Connections — EnsureOS' };

export default async function ConnectionsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const connections = await api.getConnections().catch(() => []);

  return <ConnectionsPageClient connections={connections} />;
}
