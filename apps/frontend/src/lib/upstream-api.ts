/**
 * Shared auth context for Next.js route handlers that proxy to api-server.
 */

import { getSession, getAccessToken } from './auth';
import { cloudRunInvokerHeaders } from './cloud-run-id-token';

export type UpstreamApiAuth = {
  token: string;
  tenantId: string;
  headers: Record<string, string>;
};

/**
 * Returns null when the browser session is missing / unauthenticated.
 * Always includes Cloud Run invoker headers when running on GCP.
 */
export async function getUpstreamApiAuth(options?: {
  contentType?: string;
}): Promise<UpstreamApiAuth | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    '';

  return {
    token,
    tenantId,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options?.contentType
        ? { 'Content-Type': options.contentType }
        : {}),
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      ...(await cloudRunInvokerHeaders()),
    },
  };
}
