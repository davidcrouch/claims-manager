import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getUpstreamApiAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const url = `${getApiBaseUrl()}/documents/${id}/download-url`;
  const upstream = await fetch(url, { headers: auth.headers });

  if (!upstream.ok) {
    return NextResponse.json(
      { message: 'Download failed' },
      { status: upstream.status },
    );
  }

  const data = await upstream.json();

  if (data.streamFallback || !data.downloadUrl) {
    const streamUrl = `${getApiBaseUrl()}/documents/${id}/stream`;
    const streamRes = await fetch(streamUrl, { headers: auth.headers });

    if (!streamRes.ok || !streamRes.body) {
      return NextResponse.json(
        { message: 'Stream download failed' },
        { status: streamRes.status },
      );
    }

    return new NextResponse(streamRes.body as ReadableStream, {
      headers: {
        'Content-Type': data.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(data.fileName || 'download')}"`,
      },
    });
  }

  return NextResponse.json(data);
}
