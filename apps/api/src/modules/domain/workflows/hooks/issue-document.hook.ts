import { Injectable } from '@nestjs/common';
import { DocumentIssuanceService } from '../../services/document-issuance.service';
import type { OnEnterHook, WorkflowContext } from '../workflow.interface';

@Injectable()
export class IssueDocumentHook implements OnEnterHook {
  name = 'issueDocument';

  constructor(private readonly issuanceService: DocumentIssuanceService) {}

  async execute(context: WorkflowContext): Promise<void> {
    const recipientTenantId = context.entity.recipientTenantId as string | undefined;

    await this.issuanceService.execute({
      tenantId: context.tenantId,
      userId: context.userId,
      documentType: context.entityType as 'purchase_order' | 'quote' | 'invoice' | 'rfq',
      documentId: context.entityId,
      recipientTenantId,
      tx: context.tx,
    });
  }
}
