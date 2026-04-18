import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationConnectionsRepository } from '../../database/repositories/integration-connections.repository';
import { InboundWebhookEventsRepository } from '../../database/repositories/inbound-webhook-events.repository';
import { CredentialsCipher } from '../../common/credentials-cipher';
import {
  PROVIDER_REGISTRY,
  findProviderByCode,
  type ProviderRegistryEntry,
} from './provider-registry';
import type { CreateConnectionDto } from './dto/create-connection.dto';
import type { UpdateConnectionDto } from './dto/update-connection.dto';

export interface ProviderSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  metadata: unknown;
  connectionCount: number;
  totalWebhookEvents: number;
  recentErrorCount: number;
  lastEventAt: string | null;
}

export interface ConnectionListItem {
  id: string;
  tenantId: string;
  providerCode: string;
  providerName: string;
  providerIsActive: boolean;
  name: string;
  environment: string;
  isActive: boolean;
  clientIdentifier: string | null;
  providerTenantId: string | null;
  baseUrl: string;
  baseApi: string | null;
  authUrl: string | null;
  authType: string;
  createdAt: string;
  updatedAt: string;
  totalWebhookEvents: number;
  recentErrorCount: number;
  lastEventAt: string | null;
}

export interface ConnectionDetail extends ConnectionListItem {
  credentials: Record<string, unknown>;
  webhookSecret: string | null;
  config: Record<string, unknown>;
  lastSyncAt: string | null;
}

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    private readonly connectionsRepo: IntegrationConnectionsRepository,
    private readonly webhookEventsRepo: InboundWebhookEventsRepository,
    private readonly cipher: CredentialsCipher,
  ) {}

  private encryptCredentials(
    credentials: Record<string, unknown> | undefined,
  ): string | Record<string, unknown> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return {};
    }
    return this.cipher.encryptJson(credentials);
  }

  private encryptWebhookSecret(secret: string | undefined): string | undefined {
    if (!secret) return undefined;
    if (secret.startsWith('enc:')) return secret;
    return this.cipher.encrypt(secret);
  }

  async findAll(tenantId: string): Promise<ProviderSummary[]> {
    this.logger.debug('[ProvidersService.findAll] Listing providers from registry');

    const summaries = await Promise.all(
      PROVIDER_REGISTRY.map(async (p) => this.buildSummary({ entry: p, tenantId })),
    );

    return summaries;
  }

  private async buildSummary(params: {
    entry: ProviderRegistryEntry;
    tenantId: string;
  }): Promise<ProviderSummary> {
    const { entry, tenantId } = params;
    const [connections, totalEvents, errorCount, lastEventAt] = await Promise.all([
      this.connectionsRepo.findByTenantAndProviderCode({
        tenantId,
        providerCode: entry.code,
      }),
      this.webhookEventsRepo.countByProviderCode({
        providerCode: entry.code,
        tenantId,
      }),
      this.webhookEventsRepo.countErrorsByProviderCode({
        providerCode: entry.code,
        tenantId,
      }),
      this.webhookEventsRepo.lastEventAtByProviderCode({
        providerCode: entry.code,
        tenantId,
      }),
    ]);

    return {
      id: entry.code,
      code: entry.code,
      name: entry.name,
      description: entry.description,
      isActive: entry.isActive,
      metadata: entry.metadata,
      connectionCount: connections.length,
      totalWebhookEvents: totalEvents,
      recentErrorCount: errorCount,
      lastEventAt: lastEventAt?.toISOString() ?? null,
    };
  }

  async findOne(params: { code: string; tenantId: string }) {
    this.logger.debug(`[ProvidersService.findOne] code=${params.code}`);
    const entry = this.requireProvider(params.code);
    const connections = await this.connectionsRepo.findByTenantAndProviderCode({
      tenantId: params.tenantId,
      providerCode: params.code,
    });
    return {
      id: entry.code,
      code: entry.code,
      name: entry.name,
      description: entry.description,
      isActive: entry.isActive,
      metadata: entry.metadata,
      connections,
    };
  }

  async findConnections(params: { providerCode: string; tenantId: string }) {
    this.logger.debug(
      `[ProvidersService.findConnections] providerCode=${params.providerCode}`,
    );
    this.requireProvider(params.providerCode);
    return this.connectionsRepo.findByTenantAndProviderCode({
      tenantId: params.tenantId,
      providerCode: params.providerCode,
    });
  }

  async createConnection(params: {
    providerCode: string;
    tenantId: string;
    dto: CreateConnectionDto;
  }) {
    this.logger.log(
      `[ProvidersService.createConnection] providerCode=${params.providerCode}`,
    );
    this.requireProvider(params.providerCode);
    return this.connectionsRepo.create({
      data: {
        tenantId: params.tenantId,
        providerCode: params.providerCode,
        name: params.dto.name,
        environment: params.dto.environment,
        baseUrl: params.dto.baseUrl,
        baseApi: params.dto.baseApi,
        authUrl: params.dto.authUrl,
        authType: params.dto.authType ?? 'client_credentials',
        clientIdentifier: params.dto.clientIdentifier,
        providerTenantId: params.dto.providerTenantId,
        credentials: this.encryptCredentials(params.dto.credentials),
        webhookSecret: this.encryptWebhookSecret(params.dto.webhookSecret),
        config: params.dto.config ?? {},
      },
    });
  }

  async updateConnection(params: {
    providerCode: string;
    connectionId: string;
    dto: UpdateConnectionDto;
  }) {
    this.logger.log(
      `[ProvidersService.updateConnection] providerCode=${params.providerCode} connectionId=${params.connectionId}`,
    );
    this.requireProvider(params.providerCode);

    const { credentials, webhookSecret, ...rest } = params.dto;
    const data: Parameters<typeof this.connectionsRepo.update>[0]['data'] = {
      ...rest,
    };
    if (credentials !== undefined) {
      data.credentials = this.encryptCredentials(credentials);
    }
    if (webhookSecret !== undefined) {
      data.webhookSecret = this.encryptWebhookSecret(webhookSecret);
    }

    const updated = await this.connectionsRepo.update({
      id: params.connectionId,
      data,
    });
    if (!updated) {
      throw new NotFoundException(`Connection ${params.connectionId} not found`);
    }
    return updated;
  }

  async findWebhookEvents(params: {
    providerCode: string;
    tenantId: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    this.logger.debug(
      `[ProvidersService.findWebhookEvents] providerCode=${params.providerCode}`,
    );
    this.requireProvider(params.providerCode);
    return this.webhookEventsRepo.findByProviderCode({
      providerCode: params.providerCode,
      tenantId: params.tenantId,
      status: params.status,
      page: params.page,
      limit: params.limit,
    });
  }

  async listTenantConnections(params: { tenantId: string }): Promise<ConnectionListItem[]> {
    this.logger.debug(
      `[ProvidersService.listTenantConnections] tenantId=${params.tenantId}`,
    );
    const connections = await this.connectionsRepo.findAll({ tenantId: params.tenantId });
    const items = await Promise.all(
      connections.map((conn) => this.enrichConnection({ connection: conn })),
    );
    return items;
  }

  async findConnectionById(params: {
    id: string;
    tenantId: string;
  }): Promise<ConnectionDetail> {
    this.logger.debug(`[ProvidersService.findConnectionById] id=${params.id}`);
    const conn = await this.connectionsRepo.findById({ id: params.id });
    if (!conn || conn.tenantId !== params.tenantId) {
      throw new NotFoundException(`Connection ${params.id} not found`);
    }
    const summary = await this.enrichConnection({ connection: conn });
    return {
      ...summary,
      credentials: (conn.credentials ?? {}) as Record<string, unknown>,
      webhookSecret: conn.webhookSecret ?? null,
      config: (conn.config ?? {}) as Record<string, unknown>,
      lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
    };
  }

  async updateConnectionById(params: {
    id: string;
    tenantId: string;
    dto: UpdateConnectionDto;
  }) {
    this.logger.log(
      `[ProvidersService.updateConnectionById] id=${params.id}`,
    );
    const existing = await this.connectionsRepo.findById({ id: params.id });
    if (!existing || existing.tenantId !== params.tenantId) {
      throw new NotFoundException(`Connection ${params.id} not found`);
    }
    return this.updateConnection({
      providerCode: existing.providerCode,
      connectionId: params.id,
      dto: params.dto,
    });
  }

  async findWebhookEventsByConnection(params: {
    connectionId: string;
    tenantId: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    this.logger.debug(
      `[ProvidersService.findWebhookEventsByConnection] connectionId=${params.connectionId}`,
    );
    const conn = await this.connectionsRepo.findById({ id: params.connectionId });
    if (!conn || conn.tenantId !== params.tenantId) {
      throw new NotFoundException(`Connection ${params.connectionId} not found`);
    }
    return this.webhookEventsRepo.findByConnectionId({
      connectionId: params.connectionId,
      tenantId: params.tenantId,
      status: params.status,
      page: params.page,
      limit: params.limit,
    });
  }

  private async enrichConnection(params: {
    connection: Awaited<ReturnType<IntegrationConnectionsRepository['findById']>>;
  }): Promise<ConnectionListItem> {
    const conn = params.connection!;
    const entry = findProviderByCode(conn.providerCode);
    const [totalEvents, errorCount, lastEventAt] = await Promise.all([
      this.webhookEventsRepo.countByConnectionId({
        connectionId: conn.id,
        tenantId: conn.tenantId,
      }),
      this.webhookEventsRepo.countErrorsByConnectionId({
        connectionId: conn.id,
        tenantId: conn.tenantId,
      }),
      this.webhookEventsRepo.lastEventAtByConnectionId({
        connectionId: conn.id,
        tenantId: conn.tenantId,
      }),
    ]);

    return {
      id: conn.id,
      tenantId: conn.tenantId,
      providerCode: conn.providerCode,
      providerName: entry?.name ?? conn.providerCode,
      providerIsActive: entry?.isActive ?? false,
      name: conn.name,
      environment: conn.environment,
      isActive: conn.isActive,
      clientIdentifier: conn.clientIdentifier ?? null,
      providerTenantId: conn.providerTenantId ?? null,
      baseUrl: conn.baseUrl,
      baseApi: conn.baseApi ?? null,
      authUrl: conn.authUrl ?? null,
      authType: conn.authType,
      createdAt: conn.createdAt.toISOString(),
      updatedAt: conn.updatedAt.toISOString(),
      totalWebhookEvents: totalEvents,
      recentErrorCount: errorCount,
      lastEventAt: lastEventAt?.toISOString() ?? null,
    };
  }

  private requireProvider(code: string): ProviderRegistryEntry {
    const entry = findProviderByCode(code);
    if (!entry) {
      throw new NotFoundException(`Provider ${code} not found in registry`);
    }
    return entry;
  }
}
