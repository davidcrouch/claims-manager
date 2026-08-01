import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ClaimsAdminPanel } from './ClaimsAdminPanel';

export const metadata = { title: 'Organisation Claims — EnsureOS' };

export default async function ClaimsAdminPage() {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const [claimsResult, ghostsResult] = await Promise.allSettled([
    api.getOrganisationClaims(),
    api.getGhostOrganisations(),
  ]);

  const claims = claimsResult.status === 'fulfilled' ? claimsResult.value : [];
  const ghosts = ghostsResult.status === 'fulfilled' ? ghostsResult.value : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <ClaimsAdminPanel initialClaims={claims} initialGhosts={ghosts} />
        </div>
      </div>
    </div>
  );
}
