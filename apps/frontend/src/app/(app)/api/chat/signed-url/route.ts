import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getSession } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';

export async function GET(req: NextRequest) {
  const uri = req.nextUrl.searchParams.get('uri');
  if (!uri) {
    return NextResponse.json({ error: 'uri query parameter is required' }, { status: 400 });
  }

  const session = await getSession();
  const token = await getAccessToken();

  if (!session.authenticated || !token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    '';

  const response = await fetch(
    `${getApiBaseUrl()}/ai-chat/signed-url?uri=${encodeURIComponent(uri)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    },
  );

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
