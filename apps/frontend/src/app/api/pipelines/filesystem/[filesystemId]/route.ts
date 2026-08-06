import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

async function getAuth() {
  return getUpstreamApiAuth();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filesystemId: string }> },
) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { filesystemId } = await params;

  const upstream = await fetch(`${getApiBaseUrl()}/pipelines/filesystem/${filesystemId}`, {
    headers: auth.headers,
  });

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  return NextResponse.json(data);
}
