import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function POST(req: NextRequest) {
  const auth = await getUpstreamApiAuth({ contentType: 'application/json' });
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.text();
  const upstream = await fetch(`${getApiBaseUrl()}/provisioning/start`, {
    method: 'POST',
    headers: auth.headers,
    body: body || '{}',
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
