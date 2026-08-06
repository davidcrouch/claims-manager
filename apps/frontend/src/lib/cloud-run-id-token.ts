/**
 * Fetch a Google-signed ID token for invoking IAM-protected Cloud Run services.
 * Only works when running on GCP (Cloud Run sets K_SERVICE). Returns null locally.
 *
 * Use as `X-Serverless-Authorization: Bearer <token>` so the app can keep
 * `Authorization: Bearer <user JWT>` for Nest auth.
 */

const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

const LOG = 'frontend:cloud-run-id-token';

export async function fetchCloudRunIdToken(
  audience: string,
): Promise<string | null> {
  if (!process.env.K_SERVICE) {
    return null;
  }

  try {
    const url = `${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(audience)}`;
    const res = await fetch(url, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2_000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(
        `${LOG}:fetchCloudRunIdToken — metadata identity non-2xx status=${res.status}`,
      );
      return null;
    }
    const token = (await res.text()).trim();
    return token || null;
  } catch (err) {
    console.warn(
      `${LOG}:fetchCloudRunIdToken — failed:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Audience for api-server is the origin of API_URL / NEXT_PUBLIC_API_URL. */
export function resolveApiAudience(): string {
  const env = process.env as Record<string, string | undefined>;
  const url =
    env.API_URL?.trim() ||
    env.NEXT_PUBLIC_API_URL?.trim() ||
    'http://localhost:5001';
  return url.replace(/\/+$/, '');
}

/**
 * Headers for frontend (Cloud Run) → api-server (IAM-private) calls.
 * Empty locally where K_SERVICE is unset.
 */
export async function cloudRunInvokerHeaders(): Promise<Record<string, string>> {
  const idToken = await fetchCloudRunIdToken(resolveApiAudience());
  return idToken
    ? { 'X-Serverless-Authorization': `Bearer ${idToken}` }
    : {};
}
