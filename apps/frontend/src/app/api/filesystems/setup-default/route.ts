import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function POST() {
  const auth = await getUpstreamApiAuth({ contentType: 'application/json' });
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const upstream = await fetch(`${getApiBaseUrl()}/filesystems/setup-default`, {
    method: 'POST',
    headers: auth.headers,
  });

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  return NextResponse.json(data);
}
