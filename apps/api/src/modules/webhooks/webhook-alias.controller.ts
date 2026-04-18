import { Controller, Headers, Post, Req, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';
import { WebhookHmacService } from './webhook-hmac.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('api/webhook')
export class WebhookAliasController {
  private readonly logger = new Logger('WebhookAliasController');

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly hmacService: WebhookHmacService,
  ) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('event-signature') signature: string,
    @Req() req: RawBodyRequest,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body || {}));
    const rawBodyText = rawBody.toString();

    const payload = typeof req.body === 'object' ? req.body : JSON.parse(rawBodyText);

    const payloadTenantId = payload?.payload?.tenantId ?? '';
    const payloadClient = payload?.payload?.client ?? '';
    const entityType = payload?.payload?.entity?.type ?? payload?.entityType ?? '';
    const entityId = payload?.payload?.entity?.id ?? payload?.entityId ?? '';

    this.logger.log(
      `WebhookAliasController.handleWebhook — inbound externalEventId=${payload?.id ?? 'unknown'} ` +
        `eventType=${payload?.eventType ?? 'unknown'} entity=${entityType}/${entityId} ` +
        `tenantId=${payloadTenantId} client=${payloadClient} ` +
        `bytes=${rawBody.length} hasSignature=${Boolean(signature)}`,
    );
    this.logger.debug(
      `WebhookAliasController.handleWebhook — rawBody externalEventId=${payload?.id ?? 'unknown'} ${rawBodyText}`,
    );

    const existing = await this.webhooksService.webhookRepo.findByExternalEventId({
      externalEventId: payload.id,
    });
    if (existing) {
      this.logger.debug(
        `WebhookAliasController.handleWebhook — duplicate event ${payload.id}, skipping`,
      );
      return { received: true };
    }

    const connection = await this.webhooksService.resolveConnection({
      payloadTenantId,
      payloadClient,
    });

    const hmacSecret = connection
      ? await this.webhooksService.getWebhookSecret({ connectionId: connection.connectionId })
      : '';

    const hmacVerified = signature
      ? this.hmacService.verify({ rawBody, signature, hmacSecret })
      : false;

    const event = await this.webhooksService.persistEvent({
      rawBody: rawBodyText,
      rawHeaders: req.headers as Record<string, string>,
      signature: signature || '',
      hmacVerified,
      tenantId: connection?.tenantId,
      connectionId: connection?.connectionId,
      providerCode: connection?.providerCode,
      providerId: connection?.providerId,
    });

    this.logger.log(
      `WebhookAliasController.handleWebhook — persisted eventId=${event.id} ` +
        `externalEventId=${payload?.id ?? 'unknown'} connectionId=${connection?.connectionId ?? 'none'} ` +
        `tenantId=${connection?.tenantId ?? 'none'} ` +
        `providerCode=${connection?.providerCode ?? 'none'} hmacVerified=${hmacVerified}`,
    );

    if (hmacVerified && connection) {
      this.logger.debug(
        `WebhookAliasController.handleWebhook — dispatching async processing eventId=${event.id}`,
      );
      this.webhooksService
        .processEventAsync({
          eventId: event.id,
          tenantId: connection.tenantId,
          connectionId: connection.connectionId,
          providerId: connection.providerId,
          eventType: event.eventType,
          providerEntityId: event.payloadEntityId ?? '',
          eventTimestamp: event.eventTimestamp,
        })
        .catch((err: unknown) => {
          this.logger.error(
            `WebhookAliasController.handleWebhook — async processing failed eventId=${event.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    } else {
      this.logger.warn(
        `WebhookAliasController.handleWebhook — not processing eventId=${event.id} ` +
          `(hmacVerified=${hmacVerified} connectionResolved=${Boolean(connection)})`,
      );
    }

    return { received: true };
  }
}
