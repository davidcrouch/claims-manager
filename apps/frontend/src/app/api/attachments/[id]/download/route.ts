import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.authenticated) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const token = await getAccessToken();
  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    '';

  const disposition = _req.nextUrl.searchParams.get('disposition') ?? '';
  const qs = disposition ? `?disposition=${disposition}` : '';
  const url = `${getApiBaseUrl()}/attachments/${id}/download${qs}`;
  const upstream = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    },
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
