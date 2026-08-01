import { Injectable, Logger } from '@nestjs/common';
import type { DomainEventEnvelope } from './envelope';

export interface EventHandler {
  readonly entityType: string;
  readonly eventTypes: string[];
  handle(envelope: DomainEventEnvelope): Promise<void>;
}

@Injectable()
export class PubSubSubscriberService {
  private readonly logger = new Logger('PubSubSubscriberService');
  private readonly handlers: EventHandler[] = [];

  registerHandler(handler: EventHandler) {
    this.handlers.push(handler);
    this.logger.log(
      `PubSubSubscriberService.registerHandler — registered ${handler.entityType}:[${handler.eventTypes.join(',')}]`,
    );
  }

  async handleEvent(envelope: DomainEventEnvelope): Promise<void> {
    const matching = this.handlers.filter(
      (h) =>
        h.entityType === envelope.entityType &&
        h.eventTypes.includes(envelope.eventType),
    );

    if (matching.length === 0) {
      this.logger.debug(
        `PubSubSubscriberService.handleEvent — no handler for ${envelope.entityType}:${envelope.eventType}, skipping`,
      );
      return;
    }

    for (const handler of matching) {
      try {
        await handler.handle(envelope);
      } catch (err) {
        this.logger.error(
          `PubSubSubscriberService.handleEvent — handler failed for ${envelope.entityType}:${envelope.eventType}: ${err}`,
        );
        throw err;
      }
    }
  }
}
