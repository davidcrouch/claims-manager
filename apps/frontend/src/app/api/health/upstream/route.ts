import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';
import { fetchWithTransientRetry } from '@/lib/transient-network';

const LOG = 'frontend:api:health:upstream';

/**
 * Lightweight public probe: is Nest reachable?
 * Used by ApiConnectionMonitor for reconnect detection.
 */
export async function GET() {
  const url = `${getApiBaseUrl()}/health`;
  try {
    const res = await fetchWithTransientRetry(
      url,
      { cache: 'no-store', method: 'GET' },
      { logLabel: LOG, maxAttempts: 2 },
    );
    if (!res.ok) {
      console.warn(`${LOG} — upstream non-2xx status=${res.status}`);
      return NextResponse.json(
        { ok: false, status: res.status },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: true },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (err) {
    console.warn(
      `${LOG} — unreachable:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { ok: false },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
