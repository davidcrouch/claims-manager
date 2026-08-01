import {
  Controller,
  Headers,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';
import { WebhookHmacService } from './webhook-hmac.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/** Alias path used by Cloudflare Worker / Crunchwork configs: POST /api/webhook */
@Controller('api/webhook')
export class WebhookAliasController {
  private readonly logger = new Logger('provider.WebhookAliasController');

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
    // Delegate to the same logic as /api/v1/webhooks/crunchwork via shared service.
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body || {}));
    const rawBodyText = rawBody.toString();
    const payload =
      typeof req.body === 'object' ? req.body : JSON.parse(rawBodyText);

    const payloadTenantId = payload?.payload?.tenantId ?? '';
    const payloadClient = payload?.payload?.client ?? '';

    this.logger.log(
      `provider.WebhookAliasController.handleWebhook — externalEventId=${payload?.id ?? 'unknown'}`,
    );

    const existing = await this.webhooksService.webhookRepo.findByExternalEventId({
      externalEventId: payload.id,
    });
    if (existing) {
      return { received: true };
    }

    const connection = await this.webhooksService.resolveConnection({
      payloadTenantId,
      payloadClient,
    });

    const hmacSecret = connection
      ? await this.webhooksService.getWebhookSecret({
          connectionId: connection.connectionId,
        })
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
    });

    if (hmacVerified && connection) {
      this.webhooksService
        .processEventAsync({
          eventId: event.id,
          tenantId: connection.tenantId,
          connectionId: connection.connectionId,
          providerCode: connection.providerCode,
          eventType: event.eventType,
          providerEntityId: event.payloadEntityId ?? '',
        })
        .catch((err: unknown) => {
          this.logger.error(
            `provider.WebhookAliasController.handleWebhook — async failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    }

    return { received: true };
  }
}
