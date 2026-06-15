import { Module, forwardRef } from '@nestjs/common';
import { ExternalModule } from '../external/external.module';

// Transformers
import { ClaimTransformer } from './transformers/claim.transformer';
import { JobTransformer } from './transformers/job.transformer';
import { QuoteTransformer } from './transformers/quote.transformer';
import { PurchaseOrderTransformer } from './transformers/purchase-order.transformer';
import { InvoiceTransformer } from './transformers/invoice.transformer';
import { TaskTransformer } from './transformers/task.transformer';
import { MessageTransformer } from './transformers/message.transformer';
import { AppointmentTransformer } from './transformers/appointment.transformer';
import { ReportTransformer } from './transformers/report.transformer';
import { AttachmentTransformer } from './transformers/attachment.transformer';
import { TransformerRegistry } from './transformers/transformer.registry';

// Domain services
import { EntityRelationshipService } from './services/entity-relationship.service';
import { LookupResolutionService } from './services/lookup-resolution.service';
import { ContactSyncService } from './services/contact-sync.service';
import { AssigneeSyncService } from './services/assignee-sync.service';
import { LineItemSyncService } from './services/line-item-sync.service';
import { VersioningService } from './services/versioning.service';
import { VisibilityService } from './services/visibility.service';
import { ItemLineageService } from './services/item-lineage.service';
import { DocumentIssuanceService } from './services/document-issuance.service';

// Use cases
import { ProjectClaimUseCase } from './use-cases/project-claim.use-case';
import { ProjectJobUseCase } from './use-cases/project-job.use-case';
import { ProjectQuoteUseCase } from './use-cases/project-quote.use-case';
import { ProjectPurchaseOrderUseCase } from './use-cases/project-purchase-order.use-case';
import { ProjectInvoiceUseCase } from './use-cases/project-invoice.use-case';
import { ProjectTaskUseCase } from './use-cases/project-task.use-case';
import { ProjectMessageUseCase } from './use-cases/project-message.use-case';
import { ProjectAppointmentUseCase } from './use-cases/project-appointment.use-case';
import { ProjectReportUseCase } from './use-cases/project-report.use-case';
import { ProjectAttachmentUseCase } from './use-cases/project-attachment.use-case';
import { UseCaseRegistry } from './use-cases/use-case.registry';

@Module({
  imports: [forwardRef(() => ExternalModule)],
  providers: [
    // Transformers
    ClaimTransformer,
    JobTransformer,
    QuoteTransformer,
    PurchaseOrderTransformer,
    InvoiceTransformer,
    TaskTransformer,
    MessageTransformer,
    AppointmentTransformer,
    ReportTransformer,
    AttachmentTransformer,
    TransformerRegistry,

    // Domain services
    EntityRelationshipService,
    LookupResolutionService,
    ContactSyncService,
    AssigneeSyncService,
    LineItemSyncService,
    VersioningService,
    VisibilityService,
    ItemLineageService,
    DocumentIssuanceService,

    // Use cases
    ProjectClaimUseCase,
    ProjectJobUseCase,
    ProjectQuoteUseCase,
    ProjectPurchaseOrderUseCase,
    ProjectInvoiceUseCase,
    ProjectTaskUseCase,
    ProjectMessageUseCase,
    ProjectAppointmentUseCase,
    ProjectReportUseCase,
    ProjectAttachmentUseCase,
    UseCaseRegistry,
  ],
  exports: [
    UseCaseRegistry,
    TransformerRegistry,
    EntityRelationshipService,
    LookupResolutionService,
    ContactSyncService,
    AssigneeSyncService,
    LineItemSyncService,
    VersioningService,
    VisibilityService,
    ItemLineageService,
    DocumentIssuanceService,
  ],
})
export class DomainModule {}
