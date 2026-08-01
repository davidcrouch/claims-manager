import { Injectable, Logger } from '@nestjs/common';
import {
  InboundWebhookEventsRepository,
  type InboundWebhookEventInsert,
} from '../../database/repositories/inbound-webhook-events.repository';
import { IntegrationConnectionsRepository } from '../../database/repositories/integration-connections.repository';
import { ExternalProcessingLogRepository } from '../../database/repositories/external-processing-log.repository';
import { CredentialsCipher } from '../../common/credentials-cipher';
import { resolveEntityType as resolveEventTypeToEntity } from './event-type-resolver';
import { WebhookOrchestratorService } from './webhook-orchestrator.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('provider.WebhooksService');

  constructor(
    public readonly webhookRepo: InboundWebhookEventsRepository,
    private readonly connectionsRepo: IntegrationConnectionsRepository,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly orchestrator: WebhookOrchestratorService,
    private readonly cipher: CredentialsCipher,
  ) {}

  async resolveConnection(params: {
    payloadTenantId: string;
    payloadClient: string;
  }): Promise<{
    connectionId: string;
    tenantId: string;
    providerCode: string;
  } | null> {
    if (!params.payloadTenantId || !params.payloadClient) {
      return null;
    }

    const connection = await this.connectionsRepo.findByTenantIdAndClient({
      providerTenantId: params.payloadTenantId,
      clientIdentifier: params.payloadClient,
    });

    if (!connection) {
      this.logger.warn(
        `provider.WebhooksService.resolveConnection — no connection for providerTenantId=${params.payloadTenantId} client=${params.payloadClient}`,
      );
      return null;
    }

    return {
      connectionId: connection.id,
      tenantId: connection.tenantId,
      providerCode: connection.providerCode,
    };
  }

  async getWebhookSecret(params: { connectionId: string }): Promise<string> {
    const connection = await this.connectionsRepo.findById({
      id: params.connectionId,
    });
    if (!connection?.webhookSecret) return '';
    return this.cipher.decrypt(connection.webhookSecret);
  }

  async persistEvent(params: {
    rawBody: string;
    rawHeaders: Record<string, string>;
    signature: string;
    hmacVerified: boolean;
    tenantId?: string;
    connectionId?: string;
    providerCode?: string;
  }) {
    const payload = JSON.parse(params.rawBody);
    const entityType = resolveEventTypeToEntity(payload.type);

    const insertData: InboundWebhookEventInsert = {
      externalEventId: payload.id,
      eventType: payload.type,
      eventTimestamp: new Date(payload.timestamp),
      tenantId: params.tenantId,
      payloadEntityId: payload.payload?.id?.toString() ?? null,
      payloadTeamIds: payload.payload?.teamIds || [],
      payloadTenantId: payload.payload?.tenantId,
      payloadClient: payload.payload?.client,
      payloadProjectExternalReference:
        payload.payload?.projectExternalReference,
      signatureHeader: params.signature,
      hmacVerified: params.hmacVerified,
      rawHeaders: params.rawHeaders,
      rawBodyText: params.rawBody,
      rawBodyJson: payload,
      processingStatus: 'pending',
      connectionId: params.connectionId,
      providerCode: params.providerCode,
      providerEntityType: entityType,
    };
    return this.webhookRepo.create({ data: insertData });
  }

  async processEventAsync(params: {
    eventId: string;
    tenantId: string;
    connectionId: string;
    providerCode: string;
    eventType: string;
    providerEntityId: string;
  }): Promise<void> {
    const logPrefix = 'provider.WebhooksService.processEventAsync';
    const entityType = resolveEventTypeToEntity(params.eventType);
    if (!entityType) {
      this.logger.warn(`${logPrefix} — unknown event type: ${params.eventType}`);
      return;
    }

    const route = this.orchestrator.resolveRoute();
    if (route !== 'more0') {
      this.logger.warn(
        `${logPrefix} — eventId=${params.eventId} route=${route}; leaving pending`,
      );
      return;
    }

    this.logger.log(
      `${logPrefix} — eventId=${params.eventId} route=more0; dispatching`,
    );
    const logEntry = await this.processingLogRepo.create({
      data: {
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        eventId: params.eventId,
        providerEntityType: entityType,
        providerEntityId: params.providerEntityId,
        action: 'webhook_process',
        status: 'pending',
      },
    });

    await this.orchestrator.finalize({
      eventId: params.eventId,
      processingLogId: logEntry.id,
    });
  }
}
