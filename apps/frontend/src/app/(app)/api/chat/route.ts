import { getAccessToken, getSession } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/env';
import {
  fetchCloudRunIdToken,
  resolveApiAudience,
} from '@/lib/cloud-run-id-token';

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const token = await getAccessToken();

    if (!session.authenticated || !token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const tenantId =
      session.identity?.organization_id ??
      process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
      undefined;

    const idToken = await fetchCloudRunIdToken(resolveApiAudience());
    const upstream = await fetch(`${getApiBaseUrl()}/ai-chat/stream`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        ...(idToken
          ? { 'X-Serverless-Authorization': `Bearer ${idToken}` }
          : {}),
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const error = await upstream.text();
      console.error('[frontend:api/chat] upstream error', upstream.status, error);
      return new Response(error, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'text/event-stream');
    responseHeaders.set('Cache-Control', 'no-cache');

    const quotaWarning = upstream.headers.get('x-quota-warning');
    if (quotaWarning) {
      responseHeaders.set('X-Quota-Warning', quotaWarning);
    }

    const degradedServers = upstream.headers.get('x-degraded-servers');
    if (degradedServers) {
      responseHeaders.set('x-degraded-servers', degradedServers);
    }

    return new Response(upstream.body, { headers: responseHeaders });
  } catch (err) {
    console.error('[frontend:api/chat] proxy error', err);
    return new Response(
      JSON.stringify({ error: 'Chat proxy failed', message: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
