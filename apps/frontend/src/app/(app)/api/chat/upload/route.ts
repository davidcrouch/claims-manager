import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getSession } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';

export async function POST(req: NextRequest) {
  const session = await getSession();
  const token = await getAccessToken();

  if (!session.authenticated || !token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    '';

  const response = await fetch(`${getApiBaseUrl()}/ai-chat/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
    body: formData,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
