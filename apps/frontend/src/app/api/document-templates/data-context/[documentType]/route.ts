import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

async function authHeaders(contentType?: string) {
  const auth = await getUpstreamApiAuth({ contentType });
  return auth?.headers ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentType: string }> },
) {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { documentType } = await params;
  const upstream = await fetch(
    `${getApiBaseUrl()}/generated-documents/data-context/${encodeURIComponent(documentType)}`,
    { headers },
  );

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }
  return NextResponse.json(data);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ documentType: string }> },
) {
  const headers = await authHeaders('application/json');
  if (!headers) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { documentType } = await params;
  const body = await req.json().catch(() => ({}));

  const upstream = await fetch(
    `${getApiBaseUrl()}/generated-documents/data-context/${encodeURIComponent(documentType)}`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }
  return NextResponse.json(data);
}
