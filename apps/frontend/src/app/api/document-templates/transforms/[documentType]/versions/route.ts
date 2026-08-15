import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentType: string }> },
) {
  const auth = await getUpstreamApiAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { documentType } = await params;
  const upstream = await fetch(
    `${getApiBaseUrl()}/generated-documents/transforms/${encodeURIComponent(documentType)}/versions`,
    { headers: auth.headers },
  );

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }
  return NextResponse.json(data);
}
