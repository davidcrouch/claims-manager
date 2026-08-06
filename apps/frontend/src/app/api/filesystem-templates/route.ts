import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

async function getAuth() {
  return getUpstreamApiAuth({ contentType: 'application/json' });
}

export async function GET() {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const upstream = await fetch(`${getApiBaseUrl()}/filesystem-templates`, {
    headers: auth.headers,
  });

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  const upstream = await fetch(`${getApiBaseUrl()}/filesystem-templates`, {
    method: 'POST',
    headers: auth.headers,
    body: JSON.stringify(body),
  });

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  return NextResponse.json(data);
}
