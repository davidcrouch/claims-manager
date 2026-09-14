import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import {
  resolveOpenApiSpec,
  type ConnectionDocsCredentials,
} from '../resolve-openapi';

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
  const api = createApiClient({ token });

  let creds: ConnectionDocsCredentials;
  try {
    creds = await api.getConnectionDocsUrl(id);
  } catch {
    return new NextResponse('Failed to retrieve API documentation credentials', {
      status: 502,
    });
  }

  const resolved = await resolveOpenApiSpec(creds);
  if (!resolved) {
    return new NextResponse('OpenAPI specification could not be resolved', {
      status: 502,
    });
  }

  return new NextResponse(resolved.body, {
    status: 200,
    headers: {
      'Content-Type': resolved.contentType,
      'Cache-Control': 'no-store',
      'X-OpenAPI-Source': resolved.sourceUrl,
    },
  });
}
