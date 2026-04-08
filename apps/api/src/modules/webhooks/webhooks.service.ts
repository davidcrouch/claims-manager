import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import {
  InboundWebhookEventsRepository,
  IntegrationConnectionsRepository,
  ExternalProcessingLogRepository,
  type InboundWebhookEventInsert,
} from '../../database/repositories';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { More0Service } from '../../more0/more0.service';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ExternalObjectService } from '../external/external-object.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { CredentialsCipher } from '../../common/credentials-cipher';
import { ExternalToolsController } from '../external/tools/external-tools.controller';

@Injectable()
export class WebhooksService implements OnModuleInit {
  private readonly logger = new Logger('WebhooksService');

  constructor(
    public readonly webhookRepo: InboundWebhookEventsRepository,
    private readonly connectionsRepo: IntegrationConnectionsRepository,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly more0Service: More0Service,
    private readonly crunchworkService: CrunchworkService,
    private readonly externalObjectService: ExternalObjectService,
    private readonly connectionResolver: ConnectionResolverService,
    private readonly cipher: CredentialsCipher,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  onModuleInit(): void {
    this.crunchworkService.setConnectionResolver(this.connectionResolver);
  }

  async resolveConnection(params: {
    payloadTenantId: string;
    payloadClient: string;
  }): Promise<{ connectionId: string; providerCode: string; providerId: string } | null> {
    if (!params.payloadTenantId || !params.payloadClient) {
      return null;
    }

    const connection = await this.connectionsRepo.findByTenantIdAndClient({
      providerTenantId: params.payloadTenantId,
      clientIdentifier: params.payloadClient,
    });

    if (!connection) {
      this.logger.warn(
        `WebhooksService.resolveConnection — no connection found for tenantId=${params.payloadTenantId} client=${params.payloadClient}`,
      );
      return null;
    }

    return { connectionId: connection.id, providerCode: 'crunchwork', providerId: connection.providerId };
  }

  async getWebhookSecret(params: { connectionId: string }): Promise<string> {
    const connection = await this.connectionsRepo.findById({ id: params.connectionId });
    if (!connection?.webhookSecret) return '';
    return this.cipher.decrypt(connection.webhookSecret);
  }

  async persistEvent(params: {
    rawBody: string;
    rawHeaders: Record<string, string>;
    signature: string;
    hmacVerified: boolean;
    connectionId?: string;
    providerCode?: string;
    providerId?: string;
  }) {
    const payload = JSON.parse(params.rawBody);
    const entityType = ExternalToolsController.resolveEntityType(payload.type);

    const insertData: InboundWebhookEventInsert = {
      externalEventId: payload.id,
      eventType: payload.type,
      eventTimestamp: new Date(payload.timestamp),
      payloadEntityId: payload.payload?.id?.toString() ?? null,
      payloadTeamIds: payload.payload?.teamIds || [],
      payloadTenantId: payload.payload?.tenantId,
      payloadClient: payload.payload?.client,
      payloadProjectExternalReference: payload.payload?.projectExternalReference,
      signatureHeader: params.signature,
      hmacVerified: params.hmacVerified,
      rawHeaders: params.rawHeaders,
      rawBodyText: params.rawBody,
      rawBodyJson: payload,
      processingStatus: 'pending',
      connectionId: params.connectionId,
      providerId: params.providerId,
      providerCode: params.providerCode,
      providerEntityType: entityType,
    };
    return this.webhookRepo.create({ data: insertData });
  }

  /**
   * Fire-and-forget: fetches the full entity from Crunchwork, stores it
   * in a DB transaction (external_objects + processing_log + event status),
   * then invokes the More0 workflow. Errors are logged and written to DB
   * but never propagated to the caller so the webhook response is unaffected.
   */
  async processEventAsync(params: {
    eventId: string;
    tenantId: string;
    connectionId: string;
    providerId: string;
    eventType: string;
    providerEntityId: string;
    eventTimestamp?: Date;
  }): Promise<void> {
    const logPrefix = 'WebhooksService.processEventAsync';

    try {
      const entityType = this.resolveEntityType(params.eventType);
      if (!entityType) {
        this.logger.warn(`${logPrefix} — unknown event type: ${params.eventType}`);
        return;
      }

      let fullPayload: Record<string, unknown>;
      try {
        fullPayload = await this.crunchworkService.fetchEntityByType({
          connectionId: params.connectionId,
          entityType,
          entityId: params.providerEntityId,
        });
      } catch (fetchError) {
        const msg = (fetchError as Error).message;
        this.logger.error(`${logPrefix} — CW fetch failed for ${entityType}/${params.providerEntityId}: ${msg}`);
        await this.webhookRepo.updateProcessingStatus({
          id: params.eventId,
          processingStatus: 'fetch_failed',
          processingError: msg,
        });
        return;
      }

      let processingLogId: string | undefined;
      let externalObjectId: string | undefined;

      await this.db.transaction(async (tx) => {
        const { externalObject } = await this.externalObjectService.upsertFromFetch({
          tenantId: params.tenantId,
          connectionId: params.connectionId,
          providerId: params.providerId,
          providerCode: 'crunchwork',
          providerEntityType: entityType,
          providerEntityId: params.providerEntityId,
          normalizedEntityType: entityType,
          payload: fullPayload,
          sourceEventId: params.eventId,
          sourceEventType: params.eventType,
          sourceEventTimestamp: params.eventTimestamp,
          tx,
        });
        externalObjectId = externalObject.id;

        const logEntry = await this.processingLogRepo.create({
          data: {
            tenantId: params.tenantId,
            connectionId: params.connectionId,
            eventId: params.eventId,
            providerEntityType: entityType,
            providerEntityId: params.providerEntityId,
            action: 'webhook_process',
            status: 'pending',
            externalObjectId: externalObject.id,
          },
          tx,
        });
        processingLogId = logEntry.id;

        await this.webhookRepo.updateProcessingStatus({
          id: params.eventId,
          processingStatus: 'fetched',
          tx,
        });
      });

      try {
        const { runId } = await this.more0Service.invokeWorkflow({
          workflowName: 'process-webhook-event',
          input: {
            eventId: params.eventId,
            tenantId: params.tenantId,
            connectionId: params.connectionId,
            eventType: params.eventType,
            providerEntityId: params.providerEntityId,
            processingLogId,
            externalObjectId,
          },
          context: { tenantId: params.tenantId },
        });

        if (processingLogId) {
          await this.processingLogRepo.updateStatus({
            id: processingLogId,
            status: 'processing',
            workflowRunId: runId,
          });
        }

        await this.webhookRepo.updateProcessingStatus({
          id: params.eventId,
          processingStatus: 'dispatched',
        });
      } catch (workflowError) {
        const msg = (workflowError as Error).message;
        this.logger.error(`${logPrefix} — workflow invocation failed: ${msg}`);
        if (processingLogId) {
          await this.processingLogRepo.updateStatus({
            id: processingLogId,
            status: 'workflow_invoke_failed',
            errorMessage: msg,
          });
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`${logPrefix} — unexpected error: ${err.message}`, err.stack);
    }
  }

  private resolveEntityType(eventType: string): string | null {
    return ExternalToolsController.resolveEntityType(eventType);
  }

}
