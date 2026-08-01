import { Body, Controller, Post, HttpCode, Logger } from '@nestjs/common';
import { PubSubSubscriberService } from './pubsub-subscriber.service';
import type { DomainEventEnvelope } from './envelope';

interface PushRequestBody {
  message: {
    data?: string;
    attributes?: Record<string, string>;
    messageId?: string;
  };
  subscription?: string;
}

@Controller('_internal/pubsub')
export class PubSubPushController {
  private readonly logger = new Logger('PubSubPushController');

  constructor(private readonly subscriber: PubSubSubscriberService) {}

  @Post('push')
  @HttpCode(200)
  async handlePush(@Body() body: PushRequestBody) {
    const { message } = body;
    if (!message?.data) {
      this.logger.warn('PubSubPushController.handlePush — empty message data, acking');
      return { status: 'ack' };
    }

    let envelope: DomainEventEnvelope;
    try {
      const decoded = Buffer.from(message.data, 'base64').toString('utf8');
      envelope = JSON.parse(decoded) as DomainEventEnvelope;
    } catch (err) {
      this.logger.error(
        `PubSubPushController.handlePush — failed to parse envelope, acking poison: ${err}`,
      );
      return { status: 'ack', reason: 'poison_message' };
    }

    this.logger.log(
      `PubSubPushController.handlePush — eventType=${envelope.eventType} entity=${envelope.entityType}:${envelope.entityId} messageId=${message.messageId}`,
    );

    await this.subscriber.handleEvent(envelope);

    return { status: 'ack' };
  }
}
