import { NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';

export async function GET() {
  const session = await getSession();
  if (!session.authenticated) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    '';

  const upstream = await fetch(`${getApiBaseUrl()}/provisioning/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    },
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
