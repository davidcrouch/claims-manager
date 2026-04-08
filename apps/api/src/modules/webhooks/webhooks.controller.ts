import { Controller, Headers, Post, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';
import { WebhookHmacService } from './webhook-hmac.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly hmacService: WebhookHmacService,
  ) {}

  @Post('crunchwork')
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
      providerId: connection?.providerId,
    });

    if (hmacVerified && connection) {
      this.webhooksService
        .processEventAsync({
          eventId: event.id,
          tenantId: event.payloadTenantId ?? '',
          connectionId: connection.connectionId,
          providerId: connection.providerId,
          eventType: event.eventType,
          providerEntityId: event.payloadEntityId ?? '',
          eventTimestamp: event.eventTimestamp,
        })
        .catch(() => {});
    }

    return { received: true };
  }
}
