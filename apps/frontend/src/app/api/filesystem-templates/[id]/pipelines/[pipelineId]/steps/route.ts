import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pipelineId: string }> },
) {
  const auth = await getUpstreamApiAuth({ contentType: 'application/json' });
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id, pipelineId } = await params;
  const body = await req.text();
  const upstream = await fetch(
    `${getApiBaseUrl()}/filesystem-templates/${id}/pipelines/${pipelineId}/steps`,
    { method: 'PUT', headers: auth.headers, body },
  );

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
