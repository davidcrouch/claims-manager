import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import { PUBSUB_CONFIG } from '../../config/pubsub.config';

export interface PublishInput {
  topicName: string;
  data: Buffer;
  attributes: Record<string, string>;
}

export interface PublishResult {
  messageId: string;
}

@Injectable()
export class PubSubClientService implements OnModuleDestroy {
  private readonly logger = new Logger('PubSubClientService');
  private client: PubSub | null = null;

  private getClient(): PubSub {
    if (!this.client) {
      this.client = new PubSub({
        projectId: PUBSUB_CONFIG.projectId || undefined,
      });
    }
    return this.client;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const client = this.getClient();
    const topic = client.topic(input.topicName, {
      batching: { maxMessages: 100, maxMilliseconds: 50 },
    });

    const messageId = await topic.publishMessage({
      data: input.data,
      attributes: input.attributes,
    });

    this.logger.debug(
      `PubSubClientService.publish — topic=${input.topicName} messageId=${messageId}`,
    );

    return { messageId };
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
