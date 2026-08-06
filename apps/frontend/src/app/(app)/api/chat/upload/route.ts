import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function POST(req: NextRequest) {
  // No Content-Type — fetch must set multipart boundary from FormData.
  const auth = await getUpstreamApiAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();

  const response = await fetch(`${getApiBaseUrl()}/ai-chat/upload`, {
    method: 'POST',
    headers: auth.headers,
    body: formData,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
