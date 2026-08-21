import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

async function authHeaders() {
  const auth = await getUpstreamApiAuth({ contentType: 'application/json' });
  return auth?.headers ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentType: string }> },
) {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { documentType } = await params;
  const body = await req.text();

  const upstream = await fetch(
    `${getApiBaseUrl()}/generated-documents/data-context/${encodeURIComponent(documentType)}/preview`,
    {
      method: 'POST',
      headers,
      body,
    },
  );

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }
  return NextResponse.json(data);
}
