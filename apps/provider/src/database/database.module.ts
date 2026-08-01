import { Global, Module } from '@nestjs/common';
import { DrizzleModule } from './drizzle.module';
import { InboundWebhookEventsRepository } from './repositories/inbound-webhook-events.repository';
import { IntegrationConnectionsRepository } from './repositories/integration-connections.repository';
import { ExternalProcessingLogRepository } from './repositories/external-processing-log.repository';

@Global()
@Module({
  imports: [DrizzleModule],
  providers: [
    InboundWebhookEventsRepository,
    IntegrationConnectionsRepository,
    ExternalProcessingLogRepository,
  ],
  exports: [
    InboundWebhookEventsRepository,
    IntegrationConnectionsRepository,
    ExternalProcessingLogRepository,
  ],
})
export class DatabaseModule {}
