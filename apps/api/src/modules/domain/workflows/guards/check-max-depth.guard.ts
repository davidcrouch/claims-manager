import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { rfqs, purchaseOrders, organizations } from '../../../../database/schema';
import type { WorkflowGuard, WorkflowContext } from '../workflow.interface';

const DEFAULT_MAX_DEPTH = 5;

@Injectable()
export class CheckMaxDepthGuard implements WorkflowGuard {
  name = 'checkMaxDepth';
  private readonly logger = new Logger('CheckMaxDepthGuard');

  async evaluate(context: WorkflowContext): Promise<boolean> {
    const tx = context.tx;

    let currentDepth = 0;
    if (context.entityType === 'rfq') {
      const [rfq] = await tx
        .select({ supplyChainDepth: rfqs.supplyChainDepth })
        .from(rfqs)
        .where(eq(rfqs.id, context.entityId))
        .limit(1);
      currentDepth = rfq?.supplyChainDepth ?? 0;
    } else if (context.entityType === 'purchase_order') {
      const [po] = await tx
        .select({ supplyChainDepth: purchaseOrders.supplyChainDepth })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, context.entityId))
        .limit(1);
      currentDepth = po?.supplyChainDepth ?? 0;
    } else {
      return true;
    }

    const [org] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, context.tenantId))
      .limit(1);

    const settings = (org as any)?.settings as Record<string, unknown> | undefined;
    const maxDepth = (settings?.maxSupplyChainDepth as number) ?? DEFAULT_MAX_DEPTH;

    if (currentDepth >= maxDepth) {
      this.logger.warn(
        `CheckMaxDepthGuard — blocked issuance of ${context.entityType} ${context.entityId}: depth ${currentDepth} >= max ${maxDepth}`,
      );
      return false;
    }

    return true;
  }
}
