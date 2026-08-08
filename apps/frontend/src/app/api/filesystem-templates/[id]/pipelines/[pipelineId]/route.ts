import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

async function getAuth() {
  return getUpstreamApiAuth({ contentType: 'application/json' });
}

type RouteParams = { params: Promise<{ id: string; pipelineId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id, pipelineId } = await params;
  const upstream = await fetch(
    `${getApiBaseUrl()}/filesystem-templates/${id}/pipelines/${pipelineId}`,
    { headers: auth.headers },
  );

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id, pipelineId } = await params;
  const body = await req.text();
  const upstream = await fetch(
    `${getApiBaseUrl()}/filesystem-templates/${id}/pipelines/${pipelineId}`,
    { method: 'PUT', headers: auth.headers, body },
  );

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id, pipelineId } = await params;
  const upstream = await fetch(
    `${getApiBaseUrl()}/filesystem-templates/${id}/pipelines/${pipelineId}`,
    { method: 'DELETE', headers: auth.headers },
  );

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
