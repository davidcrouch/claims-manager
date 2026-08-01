import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { DomainModule } from '../domain.module';
import { OutboundModule } from '../outbound/outbound.module';
import { DocumentGenerationModule } from '../../document-generation/document-generation.module';
import { WorkflowEngineService } from './workflow-engine.service';

// Guards
import { HasLineItemsGuard } from './guards/has-line-items.guard';
import { HasRecipientGuard } from './guards/has-recipient.guard';
import { HasEmailOrPhoneGuard } from './guards/has-email-or-phone.guard';
import { AllTasksClosedGuard } from './guards/all-tasks-closed.guard';

// Hooks
import { IssueDocumentHook } from './hooks/issue-document.hook';
import { SyncOutboundHook } from './hooks/sync-outbound.hook';
import { GenerateDocumentHook } from './hooks/generate-document.hook';
import { PublishCrossTenantEventHook } from './hooks/publish-cross-tenant-event.hook';

// Definitions
import { purchaseOrderStandard } from './definitions/purchase-order.workflows';
import { workOrderStandard } from './definitions/work-order.workflows';
import { contactOnboarding, contactRemoval } from './definitions/contact.workflows';
import { jobStandard } from './definitions/job.workflows';

@Module({
  imports: [DomainModule, OutboundModule, forwardRef(() => DocumentGenerationModule)],
  providers: [
    WorkflowEngineService,
    HasLineItemsGuard,
    HasRecipientGuard,
    HasEmailOrPhoneGuard,
    AllTasksClosedGuard,
    IssueDocumentHook,
    SyncOutboundHook,
    GenerateDocumentHook,
    PublishCrossTenantEventHook,
  ],
  exports: [WorkflowEngineService],
})
export class WorkflowModule implements OnModuleInit {
  constructor(
    private readonly engine: WorkflowEngineService,
    private readonly hasLineItems: HasLineItemsGuard,
    private readonly hasRecipient: HasRecipientGuard,
    private readonly hasEmailOrPhone: HasEmailOrPhoneGuard,
    private readonly allTasksClosed: AllTasksClosedGuard,
    private readonly issueDocHook: IssueDocumentHook,
    private readonly syncOutboundHook: SyncOutboundHook,
    private readonly generateDocHook: GenerateDocumentHook,
    private readonly publishCrossTenantHook: PublishCrossTenantEventHook,
  ) {}

  onModuleInit(): void {
    // Register workflow definitions
    this.engine.registerDefinition(purchaseOrderStandard);
    this.engine.registerDefinition(workOrderStandard);
    this.engine.registerDefinition(contactOnboarding);
    this.engine.registerDefinition(contactRemoval);
    this.engine.registerDefinition(jobStandard);

    // Register guards
    this.engine.registerGuard(this.hasLineItems);
    this.engine.registerGuard(this.hasRecipient);
    this.engine.registerGuard(this.hasEmailOrPhone);
    this.engine.registerGuard(this.allTasksClosed);

    // Register hooks
    this.engine.registerHook(this.issueDocHook);
    this.engine.registerHook(this.syncOutboundHook);
    this.engine.registerHook(this.generateDocHook);
    this.engine.registerHook(this.publishCrossTenantHook);
  }
}
