import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { workOrders } from '../../../database/schema';
import type { EventHandler } from '../pubsub-subscriber.service';
import type { DomainEventEnvelope } from '../envelope';

@Injectable()
export class WorkOrderEventHandler implements EventHandler {
  readonly entityType = 'work_order';
  readonly eventTypes = [
    'purchase_order.issue',
    'purchase_order.close',
  ];

  private readonly logger = new Logger('WorkOrderEventHandler');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(envelope: DomainEventEnvelope): Promise<void> {
    const logPrefix = 'WorkOrderEventHandler.handle';
    const { eventType } = envelope;

    this.logger.log(
      `${logPrefix} — processing ${eventType} for entity=${envelope.entityId}`,
    );

    switch (eventType) {
      case 'purchase_order.issue': {
        await this.markWoSourceIssued(envelope);
        break;
      }
      case 'purchase_order.close': {
        await this.markWoSourceClosed(envelope);
        break;
      }
      default:
        this.logger.debug(`${logPrefix} — unhandled eventType=${eventType}`);
    }
  }

  private async markWoSourceIssued(envelope: DomainEventEnvelope) {
    const logPrefix = 'WorkOrderEventHandler.markWoSourceIssued';

    const [wo] = await this.db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(eq(workOrders.purchaseOrderId, envelope.entityId))
      .limit(1);

    if (!wo) {
      this.logger.debug(
        `${logPrefix} — no linked WO for PO=${envelope.entityId}`,
      );
      return;
    }

    await this.db
      .update(workOrders)
      .set({
        workOrderPayload: sql`COALESCE(${workOrders.workOrderPayload}, '{}'::jsonb) || ${JSON.stringify({ poIssued: true, poIssuedAt: envelope.occurredAt })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(workOrders.id, wo.id));

    this.logger.log(`${logPrefix} — marked WO=${wo.id} as source PO issued`);
  }

  private async markWoSourceClosed(envelope: DomainEventEnvelope) {
    const logPrefix = 'WorkOrderEventHandler.markWoSourceClosed';

    const [wo] = await this.db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(eq(workOrders.purchaseOrderId, envelope.entityId))
      .limit(1);

    if (!wo) {
      this.logger.debug(
        `${logPrefix} — no linked WO for PO=${envelope.entityId}`,
      );
      return;
    }

    await this.db
      .update(workOrders)
      .set({
        workOrderPayload: sql`COALESCE(${workOrders.workOrderPayload}, '{}'::jsonb) || ${JSON.stringify({ poClosed: true, poClosedAt: envelope.occurredAt })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(workOrders.id, wo.id));

    this.logger.log(`${logPrefix} — marked WO=${wo.id} as source PO closed`);
  }
}
