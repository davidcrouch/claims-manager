import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function GET(req: NextRequest) {
  const uri = req.nextUrl.searchParams.get('uri');
  if (!uri) {
    return NextResponse.json({ error: 'uri query parameter is required' }, { status: 400 });
  }

  const auth = await getUpstreamApiAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = await fetch(
    `${getApiBaseUrl()}/ai-chat/signed-url?uri=${encodeURIComponent(uri)}`,
    {
      headers: auth.headers,
    },
  );

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
