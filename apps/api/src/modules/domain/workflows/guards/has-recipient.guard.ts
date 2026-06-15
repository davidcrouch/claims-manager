import { Injectable } from '@nestjs/common';
import type { WorkflowGuard, WorkflowContext } from '../workflow.interface';

@Injectable()
export class HasRecipientGuard implements WorkflowGuard {
  name = 'hasRecipient';

  async evaluate(context: WorkflowContext): Promise<boolean> {
    const entity = context.entity;
    return !!(entity.vendorId || entity.poTo || entity.recipientTenantId);
  }
}
