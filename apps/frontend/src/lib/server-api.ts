/**
 * Server-side helper to create an authenticated API client.
 * Use in server components and server actions.
 * Passes organization_id from JWT claims or NEXT_PUBLIC_DEFAULT_TENANT_ID for API tenant context.
 */

import { getSession, getAccessToken } from './auth';
import { createApiClient } from './api-client';

export async function getServerApiClient() {
  const session = await getSession();
  if (!session.authenticated || !session.identity) {
    return null;
  }

  const token = await getAccessToken();
  if (!token) {
    return null;
  }

  const tenantId =
    session.identity.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    undefined;

  return createApiClient({ token, tenantId });
}
