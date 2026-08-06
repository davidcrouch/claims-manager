import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

/**
 * Serves the thumbnail as image bytes so the browser can use this route
 * directly as an <img src>. In production Nest returns a signed GCS URL and
 * we 302-redirect. When signing is unavailable (local ADC), Nest sets
 * streamFallback and we proxy /thumbnail/stream bytes with Bearer auth.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUpstreamApiAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const url = `${getApiBaseUrl()}/documents/${id}/thumbnail`;
  const upstream = await fetch(url, { headers: auth.headers });

  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }

  const data = (await upstream.json().catch(() => ({}))) as {
    url?: string;
    streamFallback?: boolean;
  };

  if (data.streamFallback || !data.url) {
    const streamUrl = `${getApiBaseUrl()}/documents/${id}/thumbnail/stream`;
    const streamRes = await fetch(streamUrl, { headers: auth.headers });

    if (!streamRes.ok || !streamRes.body) {
      return new NextResponse(null, { status: streamRes.status || 502 });
    }

    return new NextResponse(streamRes.body as ReadableStream, {
      headers: {
        'Content-Type': streamRes.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  return NextResponse.redirect(data.url, 302);
}
