import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';
import { GeneratedDocumentsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { TemplateRegistryService } from './services/template-registry.service';
import { TemplateEngineService } from './services/template-engine.service';
import { PdfConverterService } from './services/pdf-converter.service';
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
import type { DataMapper } from './data-mappers/base.mapper';
import {
  DOCUMENT_TYPE_TO_ENTITY_TYPE,
  type DocumentType,
  type GenerationTrigger,
} from './types/document-types';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Injectable()
export class DocumentGenerationService {
  private readonly logger = new Logger('DocumentGenerationService');
  private readonly mappers: Record<DocumentType, DataMapper>;

  constructor(
    private readonly tenantContext: TenantContext,
    private readonly templateRegistry: TemplateRegistryService,
    private readonly templateEngine: TemplateEngineService,
    private readonly pdfConverter: PdfConverterService,
    private readonly gcsStorage: GcsStorageService,
    private readonly generatedDocsRepo: GeneratedDocumentsRepository,
    quoteMapper: QuoteMapper,
    invoiceMapper: InvoiceMapper,
    purchaseOrderMapper: PurchaseOrderMapper,
    workOrderMapper: WorkOrderMapper,
    proposalMapper: ProposalMapper,
    reportMapper: ReportMapper,
    billMapper: BillMapper,
    rfqMapper: RfqMapper,
    jobMapper: JobMapper,
    claimMapper: ClaimMapper,
    contactMapper: ContactMapper,
    taskMapper: TaskMapper,
    appointmentMapper: AppointmentMapper,
    messageMapper: MessageMapper,
    journalMapper: JournalMapper,
    vendorMapper: VendorMapper,
    jobsListMapper: JobsListMapper,
    quotesListMapper: QuotesListMapper,
    invoicesListMapper: InvoicesListMapper,
    billsListMapper: BillsListMapper,
    workOrdersListMapper: WorkOrdersListMapper,
    purchaseOrdersListMapper: PurchaseOrdersListMapper,
    proposalsListMapper: ProposalsListMapper,
    rfqsListMapper: RfqsListMapper,
    reportsListMapper: ReportsListMapper,
    claimsListMapper: ClaimsListMapper,
    contactsListMapper: ContactsListMapper,
    tasksListMapper: TasksListMapper,
    appointmentsListMapper: AppointmentsListMapper,
    messagesListMapper: MessagesListMapper,
    journalsListMapper: JournalsListMapper,
    vendorsListMapper: VendorsListMapper,
  ) {
    this.mappers = {
      quote: quoteMapper,
      invoice: invoiceMapper,
      purchase_order: purchaseOrderMapper,
      work_order: workOrderMapper,
      proposal: proposalMapper,
      report: reportMapper,
      bill: billMapper,
      rfq: rfqMapper,
      job_details: jobMapper,
      scope_of_work: jobMapper,
      claim: claimMapper,
      contact: contactMapper,
      task: taskMapper,
      appointment: appointmentMapper,
      message: messageMapper,
      journal: journalMapper,
      vendor: vendorMapper,
      jobs_list: jobsListMapper,
      quotes_list: quotesListMapper,
      invoices_list: invoicesListMapper,
      bills_list: billsListMapper,
      work_orders_list: workOrdersListMapper,
      purchase_orders_list: purchaseOrdersListMapper,
      proposals_list: proposalsListMapper,
      rfqs_list: rfqsListMapper,
      reports_list: reportsListMapper,
      claims_list: claimsListMapper,
      contacts_list: contactsListMapper,
      tasks_list: tasksListMapper,
      appointments_list: appointmentsListMapper,
      messages_list: messagesListMapper,
      journals_list: journalsListMapper,
      vendors_list: vendorsListMapper,
    };
  }

  async generate(params: {
    documentType: DocumentType;
    entityId: string;
    templateId?: string;
    trigger?: GenerationTrigger;
    userId?: string;
  }) {
    const logPrefix = 'DocumentGenerationService.generate';
    const tenantId = this.tenantContext.getTenantId();
    const entityType = DOCUMENT_TYPE_TO_ENTITY_TYPE[params.documentType];
    const trigger = params.trigger ?? 'manual';

    this.logger.log(
      `${logPrefix} — type=${params.documentType} entityId=${params.entityId} trigger=${trigger}`,
    );

    const record = await this.generatedDocsRepo.create({
      data: {
        tenantId,
        documentType: params.documentType,
        entityId: params.entityId,
        entityType,
        templateId: params.templateId ?? null,
        s3KeyPdf: '',
        trigger,
        status: 'pending',
        generatedBy: params.userId ?? null,
      },
    });

    try {
      await this.generatedDocsRepo.updateStatus({ id: record.id, status: 'processing' });

      const mapper = this.mappers[params.documentType];
      if (!mapper) {
        throw new BadRequestException(`No mapper for document type "${params.documentType}"`);
      }

      const data = await mapper.aggregate({ tenantId, entityId: params.entityId });

      const { fileBuffer: templateBuffer } = await this.templateRegistry.resolve({
        tenantId,
        documentType: params.documentType,
        templateId: params.templateId,
      });

      const populatedDocx = this.templateEngine.populate({
        templateBuffer,
        data,
      });

      const pdfBuffer = await this.pdfConverter.convertDocxToPdf({
        docxBuffer: populatedDocx,
      });

      const pdfKey = this.buildOutputKey({
        tenantId,
        entityType,
        entityId: params.entityId,
        ext: 'pdf',
      });
      const docxKey = this.buildOutputKey({
        tenantId,
        entityType,
        entityId: params.entityId,
        ext: 'docx',
      });

      await Promise.all([
        this.gcsStorage.uploadBuffer({
          objectPath: pdfKey,
          buffer: pdfBuffer,
          contentType: 'application/pdf',
        }),
        this.gcsStorage.uploadBuffer({
          objectPath: docxKey,
          buffer: populatedDocx,
          contentType: DOCX_MIME,
        }),
      ]);

      const updated = await this.generatedDocsRepo.updateStatus({
        id: record.id,
        status: 'completed',
        s3KeyPdf: pdfKey,
        s3KeyDocx: docxKey,
      });

      this.logger.log(`${logPrefix} — completed id=${record.id} pdf=${pdfKey}`);
      return updated;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`${logPrefix} — failed id=${record.id}: ${err.message}`);
      await this.generatedDocsRepo.updateStatus({
        id: record.id,
        status: 'failed',
        errorMessage: err.message,
      });
      throw error;
    }
  }

  async getDownloadUrl(params: { id: string; format?: 'pdf' | 'docx' }) {
    const logPrefix = 'DocumentGenerationService.getDownloadUrl';
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.generatedDocsRepo.findById({ id: params.id, tenantId });
    if (!doc) throw new NotFoundException('Generated document not found');

    const key = params.format === 'docx' && doc.s3KeyDocx ? doc.s3KeyDocx : doc.s3KeyPdf;
    if (!key) throw new NotFoundException('Document file not available');

    const format =
      params.format ??
      (key.endsWith('.docx') ? 'docx' : 'pdf');
    const fileName = `${doc.entityType}-${doc.entityId}.${format}`;
    const mimeType = format === 'docx' ? DOCX_MIME : 'application/pdf';

    const url = await this.gcsStorage.getSignedDownloadUrl({ objectPath: key });
    if (!url) {
      this.logger.debug(`${logPrefix} — streamFallback for id=${params.id} format=${format}`);
      return {
        url: '',
        format,
        streamFallback: true,
        fileName,
        mimeType,
      };
    }

    this.logger.debug(`${logPrefix} — signed URL for id=${params.id} format=${format}`);
    return { url, format, streamFallback: false, fileName, mimeType };
  }

  async getDownloadStream(params: { id: string; format?: 'pdf' | 'docx' }) {
    const logPrefix = 'DocumentGenerationService.getDownloadStream';
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.generatedDocsRepo.findById({ id: params.id, tenantId });
    if (!doc) throw new NotFoundException('Generated document not found');

    const key = params.format === 'docx' && doc.s3KeyDocx ? doc.s3KeyDocx : doc.s3KeyPdf;
    if (!key) throw new NotFoundException('Document file not available');

    const format =
      params.format ??
      (key.endsWith('.docx') ? 'docx' : 'pdf');
    const fileName = `${doc.entityType}-${doc.entityId}.${format}`;
    const mimeType = format === 'docx' ? DOCX_MIME : 'application/pdf';

    this.logger.debug(`${logPrefix} — streaming id=${params.id} path=${key}`);
    return {
      stream: this.gcsStorage.getReadStream(key),
      fileName,
      mimeType,
      format,
    };
  }

  async findAll(params: { documentType?: string; page?: number; limit?: number }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.generatedDocsRepo.findAll({ tenantId, ...params });
  }

  async findById(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.generatedDocsRepo.findById({ id: params.id, tenantId });
  }

  async regenerate(params: { id: string; templateId?: string }) {
    const logPrefix = 'DocumentGenerationService.regenerate';
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.generatedDocsRepo.findById({ id: params.id, tenantId });
    if (!existing) throw new NotFoundException('Generated document not found');

    this.logger.log(`${logPrefix} — regenerating from id=${params.id}`);

    return this.generate({
      documentType: existing.documentType as DocumentType,
      entityId: existing.entityId,
      templateId: params.templateId ?? existing.templateId ?? undefined,
      trigger: 'manual',
    });
  }

  private buildOutputKey(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    ext: string;
  }): string {
    const ts = Date.now();
    return `tenants/${params.tenantId}/generated/${params.entityType}/${params.entityId}/${ts}.${params.ext}`;
  }
}
