import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { FilesystemModule } from '../filesystem/filesystem.module';
import { DocumentGenerationController } from './document-generation.controller';
import { DocumentGenerationService } from './document-generation.service';
import { TemplatesController } from './templates/templates.controller';
import { TemplateEngineService } from './services/template-engine.service';
import { PdfConverterService } from './services/pdf-converter.service';
import { TemplateRegistryService } from './services/template-registry.service';
import { QuoteMapper } from './data-mappers/quote.mapper';
import { InvoiceMapper } from './data-mappers/invoice.mapper';
import { PurchaseOrderMapper } from './data-mappers/purchase-order.mapper';
import { WorkOrderMapper } from './data-mappers/work-order.mapper';
import { ProposalMapper } from './data-mappers/proposal.mapper';
import { ReportMapper } from './data-mappers/report.mapper';
import { BillMapper } from './data-mappers/bill.mapper';
import { RfqMapper } from './data-mappers/rfq.mapper';
import { JobMapper } from './data-mappers/job.mapper';
import { ClaimMapper } from './data-mappers/claim.mapper';
import { ContactMapper } from './data-mappers/contact.mapper';
import { TaskMapper } from './data-mappers/task.mapper';
import { AppointmentMapper } from './data-mappers/appointment.mapper';
import { MessageMapper } from './data-mappers/message.mapper';
import { JournalMapper } from './data-mappers/journal.mapper';
import { VendorMapper } from './data-mappers/vendor.mapper';
import { AssessmentMapper } from './data-mappers/assessment.mapper';
import { JobsListMapper } from './data-mappers/jobs-list.mapper';
import { QuotesListMapper } from './data-mappers/quotes-list.mapper';
import { InvoicesListMapper } from './data-mappers/invoices-list.mapper';
import { BillsListMapper } from './data-mappers/bills-list.mapper';
import { WorkOrdersListMapper } from './data-mappers/work-orders-list.mapper';
import { PurchaseOrdersListMapper } from './data-mappers/purchase-orders-list.mapper';
import { ProposalsListMapper } from './data-mappers/proposals-list.mapper';
import { RfqsListMapper } from './data-mappers/rfqs-list.mapper';
import { ReportsListMapper } from './data-mappers/reports-list.mapper';
import { ClaimsListMapper } from './data-mappers/claims-list.mapper';
import { ContactsListMapper } from './data-mappers/contacts-list.mapper';
import { TasksListMapper } from './data-mappers/tasks-list.mapper';
import { AppointmentsListMapper } from './data-mappers/appointments-list.mapper';
import { MessagesListMapper } from './data-mappers/messages-list.mapper';
import { JournalsListMapper } from './data-mappers/journals-list.mapper';
import { VendorsListMapper } from './data-mappers/vendors-list.mapper';
import { DocumentsRepository } from '../../database/repositories/documents.repository';

@Module({
  imports: [TenantModule, FilesystemModule],
  controllers: [DocumentGenerationController, TemplatesController],
  providers: [
    DocumentGenerationService,
    TemplateEngineService,
    PdfConverterService,
    TemplateRegistryService,
    DocumentsRepository,
    QuoteMapper,
    InvoiceMapper,
    PurchaseOrderMapper,
    WorkOrderMapper,
    ProposalMapper,
    ReportMapper,
    BillMapper,
    RfqMapper,
    JobMapper,
    ClaimMapper,
    ContactMapper,
    TaskMapper,
    AppointmentMapper,
    MessageMapper,
    JournalMapper,
    VendorMapper,
    AssessmentMapper,
    JobsListMapper,
    QuotesListMapper,
    InvoicesListMapper,
    BillsListMapper,
    WorkOrdersListMapper,
    PurchaseOrdersListMapper,
    ProposalsListMapper,
    RfqsListMapper,
    ReportsListMapper,
    ClaimsListMapper,
    ContactsListMapper,
    TasksListMapper,
    AppointmentsListMapper,
    MessagesListMapper,
    JournalsListMapper,
    VendorsListMapper,
  ],
  exports: [DocumentGenerationService, TemplateRegistryService],
})
export class DocumentGenerationModule {}
