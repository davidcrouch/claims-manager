import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhooksController } from './webhooks.controller';
import { WebhookAliasController } from './webhook-alias.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookHmacService } from './webhook-hmac.service';
import { WebhookOrchestratorService } from './webhook-orchestrator.service';
import { WebhookRetryService } from './webhook-retry.service';
import { More0Module } from '../../more0/more0.module';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { ExternalModule } from '../external/external.module';
import more0Config from '../../config/more0.config';
import webhookConfig from '../../config/webhook.config';

@Module({
  imports: [
    ConfigModule.forFeature(more0Config),
    ConfigModule.forFeature(webhookConfig),
    More0Module,
    CrunchworkModule,
    ExternalModule,
  ],
  controllers: [WebhooksController, WebhookAliasController],
  providers: [
    WebhooksService,
    WebhookHmacService,
    WebhookOrchestratorService,
    WebhookRetryService,
  ],
  exports: [WebhooksService, WebhookOrchestratorService],
})
export class WebhooksModule {}
