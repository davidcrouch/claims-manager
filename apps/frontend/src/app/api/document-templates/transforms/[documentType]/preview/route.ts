import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentType: string }> },
) {
  const auth = await getUpstreamApiAuth({ contentType: 'application/json' });
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { documentType } = await params;
  const body = await req.json().catch(() => ({}));

  const upstream = await fetch(
    `${getApiBaseUrl()}/generated-documents/transforms/${encodeURIComponent(documentType)}/preview`,
    {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }
  return NextResponse.json(data);
}
