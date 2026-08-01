import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, lte, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { outboundSyncQueue } from '../../database/schema';
import { PubSubClientService } from './pubsub-client.service';
import { buildEventAttributes, type DomainEventEnvelope } from './envelope';
import { resolveTopicForEntity } from './topic-resolver';

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 5_000;

@Injectable()
export class PubSubPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PubSubPublisherService');
  private publishing = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly pubsubClient: PubSubClientService,
  ) {}

  onModuleInit() {
    if (process.env.PUBSUB_ENABLED !== 'true') {
      this.logger.log('PubSubPublisherService.onModuleInit — PUBSUB_ENABLED!=true, poller disabled');
      return;
    }
    this.timer = setInterval(() => this.pollAndPublish(), POLL_INTERVAL_MS);
    this.logger.log('PubSubPublisherService.onModuleInit — poller started');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollAndPublish() {
    if (this.publishing) return;

    this.publishing = true;
    try {
      await this.processBatch();
    } finally {
      this.publishing = false;
    }
  }

  private async processBatch() {
    const rows = await this.db
      .select()
      .from(outboundSyncQueue)
      .where(
        and(
          eq(outboundSyncQueue.channel, 'pubsub'),
          eq(outboundSyncQueue.status, 'pending'),
          lte(outboundSyncQueue.scheduledAt, new Date()),
        ),
      )
      .orderBy(outboundSyncQueue.priority, outboundSyncQueue.scheduledAt)
      .limit(BATCH_SIZE);

    if (rows.length === 0) return;

    this.logger.debug(
      `PubSubPublisherService.processBatch — found ${rows.length} pending pubsub messages`,
    );

    for (const row of rows) {
      await this.publishRow(row);
    }
  }

  private async publishRow(row: typeof outboundSyncQueue.$inferSelect) {
    const topicName = resolveTopicForEntity(row.entityType);
    if (!topicName) {
      this.logger.warn(
        `PubSubPublisherService.publishRow — no topic for entityType=${row.entityType}, marking failed`,
      );
      await this.markFailed(row.id, `No topic mapped for entityType: ${row.entityType}`);
      return;
    }

    try {
      // Mark as processing
      await this.db
        .update(outboundSyncQueue)
        .set({ status: 'processing' })
        .where(eq(outboundSyncQueue.id, row.id));

      const envelope = row.payload as unknown as DomainEventEnvelope;
      const attributes = buildEventAttributes(envelope);
      const data = Buffer.from(JSON.stringify(envelope), 'utf8');

      const { messageId } = await this.pubsubClient.publish({
        topicName,
        data,
        attributes,
      });

      await this.db
        .update(outboundSyncQueue)
        .set({
          status: 'sent',
          lastAttemptedAt: new Date(),
          attempts: sql`${outboundSyncQueue.attempts} + 1`,
          processedAt: new Date(),
          lastError: null,
        })
        .where(eq(outboundSyncQueue.id, row.id));

      this.logger.debug(
        `PubSubPublisherService.publishRow — sent id=${row.id} topic=${topicName} messageId=${messageId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `PubSubPublisherService.publishRow — failed id=${row.id}: ${message}`,
      );
      await this.markFailed(row.id, message);
    }
  }

  private async markFailed(id: string, errorMessage: string) {
    await this.db
      .update(outboundSyncQueue)
      .set({
        status: 'failed',
        lastAttemptedAt: new Date(),
        attempts: sql`${outboundSyncQueue.attempts} + 1`,
        lastError: errorMessage,
      })
      .where(eq(outboundSyncQueue.id, id));
  }
}
