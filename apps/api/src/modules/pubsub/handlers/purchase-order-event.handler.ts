import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { purchaseOrders } from '../../../database/schema';
import type { EventHandler } from '../pubsub-subscriber.service';
import type { DomainEventEnvelope } from '../envelope';

@Injectable()
export class PurchaseOrderEventHandler implements EventHandler {
  readonly entityType = 'purchase_order';
  readonly eventTypes = [
    'purchase_order.acknowledge',
    'purchase_order.close',
    'work_order.accept',
    'work_order.decline',
    'work_order.complete',
  ];

  private readonly logger = new Logger('PurchaseOrderEventHandler');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(envelope: DomainEventEnvelope): Promise<void> {
    const logPrefix = 'PurchaseOrderEventHandler.handle';
    const { eventType, payload } = envelope;
    const snapshot = payload.entitySnapshot as Record<string, unknown> | undefined;

    this.logger.log(
      `${logPrefix} — processing ${eventType} for entity=${envelope.entityId}`,
    );

    switch (eventType) {
      case 'work_order.accept': {
        await this.updateLinkedPo(envelope, { woAccepted: true });
        break;
      }
      case 'work_order.decline': {
        await this.updateLinkedPo(envelope, { woDeclined: true });
        break;
      }
      case 'work_order.complete': {
        await this.updateLinkedPo(envelope, { woCompleted: true });
        break;
      }
      default:
        this.logger.debug(`${logPrefix} — unhandled eventType=${eventType}`);
    }
  }

  private async updateLinkedPo(
    envelope: DomainEventEnvelope,
    statusUpdate: Record<string, unknown>,
  ) {
    const logPrefix = 'PurchaseOrderEventHandler.updateLinkedPo';
    const sourceTenantId = envelope.sourceTenantId ?? envelope.tenantId;

    const [po] = await this.db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, envelope.entityId))
      .limit(1);

    if (!po) {
      this.logger.warn(
        `${logPrefix} — no PO found for entityId=${envelope.entityId} from tenant=${sourceTenantId}`,
      );
      return;
    }

    await this.db
      .update(purchaseOrders)
      .set({
        purchaseOrderPayload: sql`COALESCE(${purchaseOrders.purchaseOrderPayload}, '{}'::jsonb) || ${JSON.stringify(statusUpdate)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, po.id));

    this.logger.log(
      `${logPrefix} — updated PO=${po.id} with cross-tenant status: ${JSON.stringify(statusUpdate)}`,
    );
  }
}
