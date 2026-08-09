import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await getUpstreamApiAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;
  const qs = new URL(_req.url).searchParams.toString();
  const upstream = await fetch(
    `${getApiBaseUrl()}/filesystems/jobs/${jobId}${qs ? `?${qs}` : ''}`,
    {
      headers: auth.headers,
    },
  );

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
