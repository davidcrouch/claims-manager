import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhookAliasController } from './webhook-alias.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookHmacService } from './webhook-hmac.service';
import { More0Module } from '../../more0/more0.module';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { ExternalModule } from '../external/external.module';

@Module({
  imports: [More0Module, CrunchworkModule, ExternalModule],
  controllers: [WebhooksController, WebhookAliasController],
  providers: [WebhooksService, WebhookHmacService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
