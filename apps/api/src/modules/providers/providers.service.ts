import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationProvidersRepository } from '../../database/repositories/integration-providers.repository';
import { IntegrationConnectionsRepository } from '../../database/repositories/integration-connections.repository';
import { InboundWebhookEventsRepository } from '../../database/repositories/inbound-webhook-events.repository';
import type { CreateProviderDto } from './dto/create-provider.dto';
import type { CreateConnectionDto } from './dto/create-provider.dto';
import type { UpdateProviderDto } from './dto/update-provider.dto';
import type { UpdateConnectionDto } from './dto/update-provider.dto';

export interface ProviderSummary {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  metadata: unknown;
  connectionCount: number;
  totalWebhookEvents: number;
  recentErrorCount: number;
  lastEventAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    private readonly providersRepo: IntegrationProvidersRepository,
    private readonly connectionsRepo: IntegrationConnectionsRepository,
    private readonly webhookEventsRepo: InboundWebhookEventsRepository,
  ) {}

  async findAll(tenantId: string): Promise<ProviderSummary[]> {
    this.logger.debug('[ProvidersService.findAll] Listing all providers');
    const providers = await this.providersRepo.findAll();

    const summaries = await Promise.all(
      providers.map(async (p) => {
        const [connections, totalEvents, errorCount, lastEventAt] =
          await Promise.all([
            this.connectionsRepo.findByProviderId({ providerId: p.id }),
            this.webhookEventsRepo.countByProviderId({
              providerId: p.id,
              tenantId,
            }),
            this.webhookEventsRepo.countErrorsByProviderId({
              providerId: p.id,
              tenantId,
            }),
            this.webhookEventsRepo.lastEventAtByProviderId({
              providerId: p.id,
              tenantId,
            }),
          ]);

        return {
          id: p.id,
          code: p.code,
          name: p.name,
          isActive: p.isActive,
          metadata: p.metadata,
          connectionCount: connections.length,
          totalWebhookEvents: totalEvents,
          recentErrorCount: errorCount,
          lastEventAt: lastEventAt?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
    );

    return summaries;
  }

  async findOne(params: { id: string }) {
    this.logger.debug(`[ProvidersService.findOne] id=${params.id}`);
    const provider = await this.providersRepo.findById({ id: params.id });
    if (!provider) {
      throw new NotFoundException(`Provider ${params.id} not found`);
    }
    const connections = await this.connectionsRepo.findByProviderId({
      providerId: params.id,
    });
    return { ...provider, connections };
  }

  /**
   * @param tenantId Claims-manager org tenant (scopes `integration_connections.tenant_id`).
   * Crunchwork tenant identifiers belong on `dto.connection.providerTenantId` / `dto.connection.credentials`, not here.
   */
  async create(dto: CreateProviderDto, tenantId: string) {
    this.logger.log(`[ProvidersService.create] code=${dto.code}`);

    let provider = await this.providersRepo.findByCode({ code: dto.code });
    if (!provider) {
      provider = await this.providersRepo.create({
        data: {
          code: dto.code,
          name: dto.name,
          isActive: dto.isActive ?? true,
          metadata: dto.metadata ?? {},
        },
      });
    }

    let connection = null;
    if (dto.connection) {
      connection = await this.connectionsRepo.create({
        data: {
          tenantId,
          providerId: provider.id,
          name: dto.connection.name,
          environment: dto.connection.environment,
          baseUrl: dto.connection.baseUrl,
          authUrl: dto.connection.authUrl,
          authType: dto.connection.authType ?? 'client_credentials',
          clientIdentifier: dto.connection.clientIdentifier,
          providerTenantId: dto.connection.providerTenantId,
          credentials: dto.connection.credentials ?? {},
          webhookSecret: dto.connection.webhookSecret,
          config: dto.connection.config ?? {},
        },
      });
    }

    const connections = await this.connectionsRepo.findByProviderId({
      providerId: provider.id,
    });
    return { ...provider, connections };
  }

  async update(params: { id: string; dto: UpdateProviderDto }) {
    this.logger.log(`[ProvidersService.update] id=${params.id}`);
    const updated = await this.providersRepo.update({
      id: params.id,
      data: params.dto,
    });
    if (!updated) {
      throw new NotFoundException(`Provider ${params.id} not found`);
    }
    return updated;
  }

  async deactivate(params: { id: string }) {
    this.logger.log(`[ProvidersService.deactivate] id=${params.id}`);
    const updated = await this.providersRepo.update({
      id: params.id,
      data: { isActive: false },
    });
    if (!updated) {
      throw new NotFoundException(`Provider ${params.id} not found`);
    }
    return updated;
  }

  async findConnections(params: { providerId: string }) {
    this.logger.debug(
      `[ProvidersService.findConnections] providerId=${params.providerId}`,
    );
    await this.ensureProviderExists(params.providerId);
    return this.connectionsRepo.findByProviderId({
      providerId: params.providerId,
    });
  }

  async createConnection(params: {
    providerId: string;
    tenantId: string;
    dto: CreateConnectionDto;
  }) {
    this.logger.log(
      `[ProvidersService.createConnection] providerId=${params.providerId}`,
    );
    await this.ensureProviderExists(params.providerId);
    return this.connectionsRepo.create({
      data: {
        tenantId: params.tenantId,
        providerId: params.providerId,
        name: params.dto.name,
        environment: params.dto.environment,
        baseUrl: params.dto.baseUrl,
        authUrl: params.dto.authUrl,
        authType: params.dto.authType ?? 'client_credentials',
        clientIdentifier: params.dto.clientIdentifier,
        providerTenantId: params.dto.providerTenantId,
        credentials: params.dto.credentials ?? {},
        webhookSecret: params.dto.webhookSecret,
        config: params.dto.config ?? {},
      },
    });
  }

  async updateConnection(params: {
    providerId: string;
    connectionId: string;
    dto: UpdateConnectionDto;
  }) {
    this.logger.log(
      `[ProvidersService.updateConnection] providerId=${params.providerId} connectionId=${params.connectionId}`,
    );
    await this.ensureProviderExists(params.providerId);
    const updated = await this.connectionsRepo.update({
      id: params.connectionId,
      data: params.dto,
    });
    if (!updated) {
      throw new NotFoundException(`Connection ${params.connectionId} not found`);
    }
    return updated;
  }

  async findWebhookEvents(params: {
    providerId: string;
    tenantId: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    this.logger.debug(
      `[ProvidersService.findWebhookEvents] providerId=${params.providerId}`,
    );
    await this.ensureProviderExists(params.providerId);
    return this.webhookEventsRepo.findByProviderId({
      providerId: params.providerId,
      tenantId: params.tenantId,
      status: params.status,
      page: params.page,
      limit: params.limit,
    });
  }

  private async ensureProviderExists(id: string): Promise<void> {
    const provider = await this.providersRepo.findById({ id });
    if (!provider) {
      throw new NotFoundException(`Provider ${id} not found`);
    }
  }
}
