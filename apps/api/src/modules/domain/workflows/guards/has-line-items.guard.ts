import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../../database/drizzle.module';
import {
  purchaseOrderGroups,
  quoteGroups,
} from '../../../../database/schema';
import type { WorkflowGuard, WorkflowContext } from '../workflow.interface';

@Injectable()
export class HasLineItemsGuard implements WorkflowGuard {
  name = 'hasLineItems';

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async evaluate(context: WorkflowContext): Promise<boolean> {
    const db = context.tx ?? this.db;

    switch (context.entityType) {
      case 'purchase_order': {
        const groups = await db
          .select({ id: purchaseOrderGroups.id })
          .from(purchaseOrderGroups)
          .where(eq(purchaseOrderGroups.purchaseOrderId, context.entityId))
          .limit(1);
        return groups.length > 0;
      }
      case 'quote': {
        const groups = await db
          .select({ id: quoteGroups.id })
          .from(quoteGroups)
          .where(eq(quoteGroups.quoteId, context.entityId))
          .limit(1);
        return groups.length > 0;
      }
      default:
        return true;
    }
  }
}
