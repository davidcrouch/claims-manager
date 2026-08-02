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

async function fetchOrgName(
  token: string,
  tenantId: string,
): Promise<string | null> {
  const LOG = 'frontend:AppLayout:fetchOrgName';
  try {
    const res = await fetch(`${getApiBaseUrl()}/organisations/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`${LOG} — failed status=${res.status} tenantId=${tenantId}`);
      return null;
    }
    const data = (await res.json()) as {
      tradingName?: string | null;
      name?: string | null;
    };
    const name = (data.tradingName || data.name || '').trim();
    if (!name) {
      console.warn(`${LOG} — empty name tenantId=${tenantId}`);
      return null;
    }
    return name;
  } catch (err) {
    console.warn(
      `${LOG} — error:`,
      err instanceof Error ? err.message : String(err),
    );
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

  const [provisioningStatus, orgName] = await Promise.all([
    checkProvisioningStatus(token, tenantId),
    fetchOrgName(token, tenantId),
  ]);

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

  return (
    <AppLayoutClient user={headerUser} features={identity.features ?? []} orgName={orgName}>
      {children}
    </AppLayoutClient>
  );
}
