import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { rfqs, jobs } from '../../../database/schema';
import type { EventHandler } from '../pubsub-subscriber.service';
import type { DomainEventEnvelope } from '../envelope';

@Injectable()
export class RfqEventHandler implements EventHandler {
  readonly entityType = 'rfq';
  readonly eventTypes = [
    'rfq.send',
    'rfq.cancel',
    'rfq.close',
  ];

  private readonly logger = new Logger('RfqEventHandler');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(envelope: DomainEventEnvelope): Promise<void> {
    const logPrefix = 'RfqEventHandler.handle';
    const { eventType, payload } = envelope;

    this.logger.log(
      `${logPrefix} — processing ${eventType} for entity=${envelope.entityId}`,
    );

    switch (eventType) {
      case 'rfq.cancel':
      case 'rfq.close': {
        await this.updateLinkedJob(envelope, {
          rfqClosed: true,
          rfqClosedAt: envelope.occurredAt,
        });
        break;
      }
      default:
        this.logger.debug(`${logPrefix} — unhandled eventType=${eventType}`);
    }
  }

  private async updateLinkedJob(
    envelope: DomainEventEnvelope,
    statusUpdate: Record<string, unknown>,
  ) {
    const logPrefix = 'RfqEventHandler.updateLinkedJob';

    const [job] = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(sql`${jobs.apiPayload}->>'sourceRfqId' = ${envelope.entityId}`)
      .limit(1);

    if (!job) {
      this.logger.debug(`${logPrefix} — no linked job for rfq=${envelope.entityId}`);
      return;
    }

    await this.db
      .update(jobs)
      .set({
        apiPayload: sql`COALESCE(${jobs.apiPayload}, '{}'::jsonb) || ${JSON.stringify(statusUpdate)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));

    this.logger.log(`${logPrefix} — updated job=${job.id} with RFQ status: ${JSON.stringify(statusUpdate)}`);
  }
}
