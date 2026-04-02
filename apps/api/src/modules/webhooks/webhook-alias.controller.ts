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
      payloadTenantId: payload.payload?.tenantId ?? '',
      payloadClient: payload.payload?.client ?? '',
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
      connectionId: connection?.connectionId,
      providerCode: connection?.providerCode,
    });

    if (hmacVerified && connection) {
      this.webhooksService
        .processEventAsync({
          eventId: event.id,
          tenantId: event.payloadTenantId ?? '',
          connectionId: connection.connectionId,
          eventType: event.eventType,
          providerEntityId: event.payloadEntityId ?? '',
        })
        .catch(() => {});
    }

    return { received: true };
  }
}
