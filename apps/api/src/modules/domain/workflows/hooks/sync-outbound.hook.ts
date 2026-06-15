import { Injectable, Logger } from '@nestjs/common';
import { OutboundSyncService } from '../../outbound/outbound-sync.service';
import type { OnEnterHook, WorkflowContext } from '../workflow.interface';

@Injectable()
export class SyncOutboundHook implements OnEnterHook {
  name = 'syncOutbound';
  private readonly logger = new Logger('SyncOutboundHook');

  constructor(private readonly outboundSync: OutboundSyncService) {}

  async execute(context: WorkflowContext): Promise<void> {
    const result = await this.outboundSync.enqueueIfConnected({
      tenantId: context.tenantId,
      entityType: context.entityType,
      entityId: context.entityId,
      action: 'status_change',
      payload: { step: context.targetStep, entity: context.entity },
      sourceEvent: `workflow:${context.action}`,
      tx: context.tx,
    });

    if (result) {
      this.logger.log(
        `SyncOutboundHook.execute — enqueued outbound sync ${result} for ${context.entityType}:${context.entityId}`,
      );
    } else {
      this.logger.debug(
        `SyncOutboundHook.execute — no active connection for tenant ${context.tenantId}, skipped`,
      );
    }
  }
}
