import { redirect } from 'next/navigation';
import { getSession, getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import { AppLayoutClient } from '@/components/layout/AppLayoutClient';
import { ProvisioningScreen } from '@/components/provisioning/ProvisioningScreen';

async function checkProvisioningStatus(
  token: string,
  tenantId: string,
): Promise<'complete' | 'pending' | 'provisioning' | 'failed' | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/provisioning/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.provisioningStatus ?? null;
  } catch {
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.authenticated || !session.identity) {
    redirect('/api/auth/login');
  }

  const token = await getAccessToken();
  if (!token) {
    redirect('/api/auth/login');
  }

  const { identity } = session;
  const tenantId =
    identity.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    '';

  const provisioningStatus = await checkProvisioningStatus(token, tenantId);

  if (
    provisioningStatus &&
    provisioningStatus !== 'complete'
  ) {
    return <ProvisioningScreen />;
  }

  const headerUser = {
    given_name: identity.given_name ?? identity.name?.split(' ')[0],
    family_name: identity.family_name ?? identity.name?.split(' ').slice(1).join(' '),
    email: identity.email,
    picture: identity.picture,
  };

  return <AppLayoutClient user={headerUser}>{children}</AppLayoutClient>;
}
