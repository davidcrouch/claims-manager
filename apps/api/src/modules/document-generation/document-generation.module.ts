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
  ],
  exports: [DocumentGenerationService, TemplateRegistryService],
})
export class DocumentGenerationModule {}
