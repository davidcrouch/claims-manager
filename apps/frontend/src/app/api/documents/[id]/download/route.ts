import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.authenticated) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    '';

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
  };

  const url = `${getApiBaseUrl()}/documents/${id}/download-url`;
  const upstream = await fetch(url, { headers: authHeaders });

  if (!upstream.ok) {
    return NextResponse.json(
      { message: 'Download failed' },
      { status: upstream.status },
    );
  }

  const data = await upstream.json();

  if (data.streamFallback || !data.downloadUrl) {
    const streamUrl = `${getApiBaseUrl()}/documents/${id}/stream`;
    const streamRes = await fetch(streamUrl, { headers: authHeaders });

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
