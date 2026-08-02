import { Inject, Injectable, Logger } from '@nestjs/common';

const LOG_PREFIX = 'api.AuthServerClient';

export type AuthRoleCatalogueItem = {
  id: string;
  roleName: string;
  scope: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  sortOrder: number;
};

@Injectable()
export class AuthServerClient {
  private readonly log = new Logger('AuthServerClient');
  private readonly baseUrl: string;

  constructor(@Inject('AUTH_SERVER_URL') authServerUrl: string) {
    this.baseUrl = (authServerUrl ?? '').replace(/\/+$/, '');
    if (!this.baseUrl) {
      this.log.warn(`${LOG_PREFIX}:constructor - AUTH_SERVER_URL not configured`);
    }
  }

  private requireBaseUrl(): string {
    if (!this.baseUrl) {
      throw new Error(`${LOG_PREFIX}:requireBaseUrl - AUTH_SERVER_URL is not configured`);
    }
    return this.baseUrl;
  }

  async inviteUser(
    input: {
      email: string;
      givenName?: string;
      familyName?: string;
      roles: string[];
    },
    accessToken: string,
  ): Promise<{
    userId: string;
    email: string;
    givenName: string | null;
    familyName: string | null;
    roles: string[];
    inviteUrl: string;
    status: string;
  }> {
    const url = `${this.requireBaseUrl()}/admin/users/invite`;
    this.log.log(`${LOG_PREFIX}:inviteUser - POST ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.error(`${LOG_PREFIX}:inviteUser - ${res.status}: ${body}`);
      throw new Error(
        `Auth-server invite failed (${res.status}): ${body || res.statusText}`,
      );
    }

    return (await res.json()) as {
      userId: string;
      email: string;
      givenName: string | null;
      familyName: string | null;
      roles: string[];
      inviteUrl: string;
      status: string;
    };
  }

  async setUserRoles(
    userId: string,
    organizationId: string,
    roles: string[],
    accessToken: string,
  ): Promise<void> {
    const url = `${this.requireBaseUrl()}/admin/users/${encodeURIComponent(userId)}/roles`;
    this.log.log(`${LOG_PREFIX}:setUserRoles - PUT ${url}`);

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId, roles }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.error(`${LOG_PREFIX}:setUserRoles - ${res.status}: ${body}`);
      throw new Error(
        `Auth-server setUserRoles failed (${res.status}): ${body || res.statusText}`,
      );
    }
  }

  async getUserRoles(
    userId: string,
    organizationId: string,
    accessToken: string,
  ): Promise<string[]> {
    const url = `${this.requireBaseUrl()}/admin/users/${encodeURIComponent(userId)}/roles?organizationId=${encodeURIComponent(organizationId)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.error(`${LOG_PREFIX}:getUserRoles - ${res.status}: ${body}`);
      throw new Error(
        `Auth-server getUserRoles failed (${res.status}): ${body || res.statusText}`,
      );
    }

    const data = (await res.json()) as {
      data?: { roles?: string[] };
      roles?: string[];
    };
    return data.data?.roles ?? data.roles ?? [];
  }

  async listRoleCatalogue(
    accessToken: string,
    scope?: string,
  ): Promise<AuthRoleCatalogueItem[]> {
    const params = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    const url = `${this.requireBaseUrl()}/admin/roles${params}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.error(`${LOG_PREFIX}:listRoleCatalogue - ${res.status}: ${body}`);
      throw new Error(
        `Auth-server listRoleCatalogue failed (${res.status}): ${body || res.statusText}`,
      );
    }

    const payload = (await res.json()) as {
      data?: AuthRoleCatalogueItem[];
      roles?: AuthRoleCatalogueItem[];
    };
    return payload.data ?? payload.roles ?? [];
  }
}
