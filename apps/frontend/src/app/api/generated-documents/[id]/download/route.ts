import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

async function authHeaders() {
  const auth = await getUpstreamApiAuth();
  return auth?.headers ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const format = req.nextUrl.searchParams.get('format') ?? '';
  const qs = format ? `?format=${format}` : '';

  const upstream = await fetch(
    `${getApiBaseUrl()}/generated-documents/${id}/download${qs}`,
    { headers },
  );

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  }

  const data = (await upstream.json()) as {
    url?: string;
    format?: string;
    streamFallback?: boolean;
    fileName?: string;
    mimeType?: string;
  };

  if (data.streamFallback || !data.url) {
    const streamUrl = `${getApiBaseUrl()}/generated-documents/${id}/stream${qs}`;
    const streamRes = await fetch(streamUrl, { headers });

    if (!streamRes.ok || !streamRes.body) {
      return NextResponse.json(
        { message: 'Stream download failed' },
        { status: streamRes.status },
      );
    }

    const disposition =
      req.nextUrl.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment';
    const fileName = encodeURIComponent(data.fileName || 'document');

    return new NextResponse(streamRes.body as ReadableStream, {
      headers: {
        'Content-Type': data.mimeType || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
      },
    });
  }

  return NextResponse.json({ url: data.url, format: data.format ?? 'pdf' });
}
