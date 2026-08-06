import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

async function getAuth() {
  return getUpstreamApiAuth({ contentType: 'application/json' });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> },
) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id, categoryId } = await params;
  const body = await req.json();

  const upstream = await fetch(
    `${getApiBaseUrl()}/filesystems/${id}/categories/${categoryId}`,
    {
      method: 'PATCH',
      headers: auth.headers,
      body: JSON.stringify(body),
    },
  );

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> },
) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id, categoryId } = await params;

  const upstream = await fetch(
    `${getApiBaseUrl()}/filesystems/${id}/categories/${categoryId}`,
    {
      method: 'DELETE',
      headers: auth.headers,
    },
  );

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  }

  return new NextResponse(null, { status: 204 });
}
