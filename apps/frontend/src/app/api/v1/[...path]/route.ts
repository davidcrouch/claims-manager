import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

const LOG = 'frontend:api:v1-proxy';

type RouteParams = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const auth = await getUpstreamApiAuth(
    req.method !== 'GET' && req.method !== 'HEAD'
      ? { contentType: req.headers.get('content-type') ?? 'application/json' }
      : undefined,
  );
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const subPath = pathSegments.map(encodeURIComponent).join('/');
  const search = req.nextUrl.search;
  const upstreamUrl = `${getApiBaseUrl()}/${subPath}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: auth.headers,
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const contentType = upstream.headers.get('content-type') ?? '';

    if (
      contentType.includes('application/json') ||
      contentType.includes('text/') ||
      contentType === ''
    ) {
      const data = await upstream.json().catch(async () => {
        const text = await upstream.text().catch(() => '');
        return text ? { message: text } : {};
      });
      return NextResponse.json(data, { status: upstream.status });
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        ...(upstream.headers.get('content-disposition')
          ? {
              'Content-Disposition': upstream.headers.get('content-disposition')!,
            }
          : {}),
      },
    });
  } catch (err) {
    console.error(`${LOG} — upstream failed`, {
      url: upstreamUrl,
      error: err instanceof Error ? err.message : err,
    });
    return NextResponse.json(
      { message: 'Upstream API unavailable' },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(req, path);
}
