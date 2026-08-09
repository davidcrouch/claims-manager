import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../../database/drizzle.module';
import { workOrders, purchaseOrders } from '../../../../database/schema';
import type { OnEnterHook, WorkflowContext } from '../workflow.interface';

@Injectable()
export class EnableInvoiceCreationHook implements OnEnterHook {
  name = 'enableInvoiceCreation';
  private readonly logger = new Logger('EnableInvoiceCreationHook');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(context: WorkflowContext): Promise<void> {
    const logPrefix = 'EnableInvoiceCreationHook.execute';

    if (context.entityType !== 'work_order' || context.targetStep !== 'completed') {
      return;
    }

    const [wo] = await context.tx
      .select()
      .from(workOrders)
      .where(eq(workOrders.id, context.entityId))
      .limit(1);

    if (!wo) {
      this.logger.warn(`${logPrefix} — work order ${context.entityId} not found`);
      return;
    }

    await context.tx
      .update(workOrders)
      .set({
        workOrderPayload: sql`COALESCE(${workOrders.workOrderPayload}, '{}'::jsonb) || '{"invoiceCreationEnabled": true}'::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(workOrders.id, context.entityId));

    if (wo.purchaseOrderId) {
      await context.tx
        .update(purchaseOrders)
        .set({
          purchaseOrderPayload: sql`COALESCE(${purchaseOrders.purchaseOrderPayload}, '{}'::jsonb) || '{"woCompleted": true}'::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, wo.purchaseOrderId));
    }

    this.logger.log(
      `${logPrefix} — enabled invoice creation for WO=${context.entityId} PO=${wo.purchaseOrderId}`,
    );
  }
}
