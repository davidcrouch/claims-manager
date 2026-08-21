import { Module, Global } from '@nestjs/common';
import { ExternalModule } from '../external/external.module';
import { OutboundEventsService } from './outbound-events.service';

/**
 * Global module that makes OutboundEventsService available to all modules.
 * Dispatches domain events to the more0-ensure capability server via the
 * per-tenant integration connection (OAuth2 client_credentials).
 */
@Global()
@Module({
  imports: [ExternalModule],
  providers: [OutboundEventsService],
  exports: [OutboundEventsService],
})
export class OutboundEventsModule {}
