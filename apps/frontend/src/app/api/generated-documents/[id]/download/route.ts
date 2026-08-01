import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';

async function authHeaders() {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    '';

  return {
    Authorization: `Bearer ${token}`,
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
  };
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

    return new NextResponse(streamRes.body as ReadableStream, {
      headers: {
        'Content-Type': data.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(data.fileName || 'document')}"`,
      },
    });
  }

  return NextResponse.json({ url: data.url, format: data.format ?? 'pdf' });
}
