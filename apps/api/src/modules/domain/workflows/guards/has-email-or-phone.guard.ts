import { Injectable } from '@nestjs/common';
import type { WorkflowGuard, WorkflowContext } from '../workflow.interface';

@Injectable()
export class HasEmailOrPhoneGuard implements WorkflowGuard {
  name = 'hasEmailOrPhone';

  async evaluate(context: WorkflowContext): Promise<boolean> {
    const entity = context.entity;
    return !!(entity.email || entity.mobilePhone || entity.homePhone || entity.workPhone);
  }
}
