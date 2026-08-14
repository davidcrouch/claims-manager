import {
  Controller,
  Get,
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

/**
 * Internal webhook ingest path used by the Cloudflare fanout Worker.
 *
 * The public path POST /api/v1/webhooks/crunchwork is intercepted by
 * the crunchwork-webhook-proxy Worker on Cloudflare Edge. The Worker
 * forwards to this internal path on the Cloud Run origin directly,
 * so requests here bypass the Cloudflare proxy entirely.
 */
@Controller('internal/webhooks')
export class WebhookInternalController {
  private readonly logger = new Logger('provider.WebhookInternalController');

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly hmacService: WebhookHmacService,
  ) {}

  /** Browser / ops probe — ingest is POST-only. */
  @Get('crunchwork')
  @Public()
  describeCrunchwork() {
    return {
      service: 'provider-server',
      path: '/api/v1/internal/webhooks/crunchwork',
      method: 'POST',
      status: 'ready',
    };
  }

  @Post('crunchwork')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('event-signature') signature: string,
    @Req() req: RawBodyRequest,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body || {}));
    const rawBodyText = rawBody.toString();
    const payload =
      typeof req.body === 'object' ? req.body : JSON.parse(rawBodyText);

    const payloadTenantId = payload?.payload?.tenantId ?? '';
    const payloadClient = payload?.payload?.client ?? '';

    this.logger.log(
      `provider.WebhookInternalController.handleWebhook — externalEventId=${payload?.id ?? 'unknown'} ` +
        `eventType=${payload?.type ?? payload?.eventType ?? 'unknown'} ` +
        `tenantId=${payloadTenantId} client=${payloadClient} bytes=${rawBody.length}`,
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

    this.logger.log(
      `provider.WebhookInternalController.handleWebhook — persisted eventId=${event.id} hmacVerified=${hmacVerified}`,
    );

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
            `provider.WebhookInternalController.handleWebhook — async failed eventId=${event.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    }

    return { received: true };
  }
}
