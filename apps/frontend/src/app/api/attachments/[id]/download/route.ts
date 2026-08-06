import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUpstreamApiAuth();
  if (!auth) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  const disposition = _req.nextUrl.searchParams.get('disposition') ?? '';
  const qs = disposition ? `?disposition=${disposition}` : '';
  const url = `${getApiBaseUrl()}/attachments/${id}/download${qs}`;
  const upstream = await fetch(url, {
    headers: auth.headers,
  });

  if (!upstream.ok) {
    return new NextResponse('Download failed', { status: upstream.status });
  }

  const headers = new Headers();
  const ct = upstream.headers.get('content-type');
  const cd = upstream.headers.get('content-disposition');
  if (ct) headers.set('Content-Type', ct);
  if (cd) headers.set('Content-Disposition', cd);

  return new NextResponse(upstream.body, { status: 200, headers });
}
