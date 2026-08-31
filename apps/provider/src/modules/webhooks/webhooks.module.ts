import { Module } from '@nestjs/common';
import { More0Module } from '../../more0/more0.module';
import { WebhooksController } from './webhooks.controller';
import { WebhookAliasController } from './webhook-alias.controller';
import { WebhookInternalController } from './webhook-internal.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookHmacService } from './webhook-hmac.service';
import { WebhookOrchestratorService } from './webhook-orchestrator.service';
import { ApiProcessClient } from './api-process.client';

@Module({
  imports: [More0Module],
  controllers: [WebhooksController, WebhookAliasController, WebhookInternalController],
  providers: [
    WebhooksService,
    WebhookHmacService,
    WebhookOrchestratorService,
    ApiProcessClient,
  ],
})
export class WebhooksModule {}
