import { Module, Global } from '@nestjs/common';
import { OutboundEventsService } from './outbound-events.service';

/**
 * Global module that makes OutboundEventsService available to all modules.
 * Dispatches domain events to the more0-ensure capability server.
 *
 * Configure via env: CAPABILITY_WEBHOOK_URL=http://localhost:4510/api/v1/webhooks
 */
@Global()
@Module({
  providers: [OutboundEventsService],
  exports: [OutboundEventsService],
})
export class OutboundEventsModule {}
