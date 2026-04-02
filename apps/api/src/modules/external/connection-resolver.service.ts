import { Injectable, Logger } from '@nestjs/common';
import {
  IntegrationConnectionsRepository,
  type IntegrationConnectionRow,
} from '../../database/repositories';
import { CredentialsCipher } from '../../common/credentials-cipher';

interface CachedConnection {
  row: IntegrationConnectionRow;
  expiresAt: number;
}

@Injectable()
export class ConnectionResolverService {
  private readonly logger = new Logger('ConnectionResolverService');
  private readonly cache = new Map<string, CachedConnection>();
  private readonly cacheTtlMs = 60000;

  constructor(
    private readonly connectionsRepo: IntegrationConnectionsRepository,
    private readonly cipher: CredentialsCipher,
  ) {}

  async resolveForWebhook(params: {
    payloadTenantId: string;
    payloadClient: string;
  }): Promise<IntegrationConnectionRow | null> {
    if (!params.payloadTenantId || !params.payloadClient) return null;

    const cacheKey = `webhook:${params.payloadTenantId}:${params.payloadClient}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const connection = await this.connectionsRepo.findByTenantIdAndClient({
      providerTenantId: params.payloadTenantId,
      clientIdentifier: params.payloadClient,
    });

    if (connection) {
      this.setCache(cacheKey, connection);
    }

    return connection;
  }

  async resolveForTenant(params: {
    tenantId: string;
    providerCode?: string;
  }): Promise<IntegrationConnectionRow | null> {
    const providerCode = params.providerCode ?? 'crunchwork';
    const cacheKey = `tenant:${params.tenantId}:${providerCode}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const connection = await this.connectionsRepo.findByTenantAndProvider({
      tenantId: params.tenantId,
      providerCode,
    });

    if (connection) {
      this.setCache(cacheKey, connection);
    }

    return connection;
  }

  async getCredentials(params: {
    connectionId: string;
  }): Promise<{
    clientId: string;
    clientSecret: string;
    authUrl: string;
    baseUrl: string;
    activeTenantId: string;
  }> {
    const cacheKey = `creds:${params.connectionId}`;
    const cached = this.getFromCache(cacheKey);
    const connection = cached ?? await this.connectionsRepo.findById({ id: params.connectionId });

    if (!connection) {
      throw new Error(
        `ConnectionResolverService.getCredentials — connection not found: ${params.connectionId}`,
      );
    }

    if (!cached) {
      this.setCache(cacheKey, connection);
    }

    const creds = this.cipher.decryptJson(connection.credentials as string);

    return {
      clientId: creds.clientId ?? '',
      clientSecret: creds.clientSecret ?? '',
      authUrl: connection.authUrl ?? '',
      baseUrl: connection.baseUrl,
      activeTenantId: connection.providerTenantId ?? '',
    };
  }

  private getFromCache(key: string): IntegrationConnectionRow | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.row;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache(key: string, row: IntegrationConnectionRow): void {
    this.cache.set(key, { row, expiresAt: Date.now() + this.cacheTtlMs });
  }
}
