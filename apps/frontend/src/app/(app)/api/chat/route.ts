import { getApiBaseUrl } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

export const maxDuration = 600;

export async function POST(req: Request) {
  try {
    const auth = await getUpstreamApiAuth({ contentType: 'application/json' });

    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    const upstream = await fetch(`${getApiBaseUrl()}/ai-chat/stream`, {
      method: 'POST',
      headers: auth.headers,
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
