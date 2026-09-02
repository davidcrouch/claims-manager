/**
 * Cloud Run IAM invoker token for service-to-service calls.
 * Keeps the user JWT on Authorization and puts the platform token on
 * X-Serverless-Authorization (same pattern as api-server mcp-client).
 */

const LOG_PREFIX = 'claims-mcp.cloudRunInvoker';
const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

let cached: { audience: string; token: string; expiresAt: number } | null = null;

export async function cloudRunInvokerAuthorization(
  targetUrl: string,
): Promise<string | undefined> {
  if (!process.env.K_SERVICE) {
    return undefined;
  }

  let audience: string;
  try {
    audience = new URL(targetUrl).origin;
  } catch {
    console.warn(`[${LOG_PREFIX}.cloudRunInvokerAuthorization] invalid target URL`);
    return undefined;
  }

  const now = Date.now();
  if (cached && cached.audience === audience && cached.expiresAt > now) {
    return `Bearer ${cached.token}`;
  }

  try {
    const url = `${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(audience)}`;
    const res = await fetch(url, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) {
      console.warn(
        `[${LOG_PREFIX}.cloudRunInvokerAuthorization] metadata identity status=${res.status}`,
      );
      return undefined;
    }

    const token = (await res.text()).trim();
    if (!token) {
      return undefined;
    }

    cached = { audience, token, expiresAt: now + 50 * 60 * 1000 };
    return `Bearer ${token}`;
  } catch (err) {
    console.warn(
      `[${LOG_PREFIX}.cloudRunInvokerAuthorization] failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return undefined;
  }
}
