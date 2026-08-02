import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';

async function getAuth() {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    '';

  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    },
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const upstream = await fetch(
    `${getApiBaseUrl()}/filesystems/${id}/categories`,
    {
      method: 'POST',
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

/**
 * Bulk-replaces the flat category list for a filesystem. Used by
 * FilesystemEditorPanel after flattening the nested category tree.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const upstream = await fetch(
    `${getApiBaseUrl()}/filesystems/${id}/categories`,
    {
      method: 'PUT',
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
