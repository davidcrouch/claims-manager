import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';
import { GeneratedDocumentsRepository } from '../../database/repositories';
import { DocumentsService } from '../filesystem/documents.service';
import { TenantContext } from '../../tenant/tenant-context';
import { SCENARIO_META, TemplateRegistryService } from './services/template-registry.service';
import { TemplateEngineService } from './services/template-engine.service';
import { PdfConverterService } from './services/pdf-converter.service';
import { TransformService } from './services/transform.service';
import { DataContextService, hasContextDefinition } from './data-context';
import { formatDocumentGenerationError } from './utils/format-generation-error';
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
import { DocumentMapper } from './data-mappers/document.mapper';
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
import { AssessmentsListMapper } from './data-mappers/assessments-list.mapper';
import { DocumentsListMapper } from './data-mappers/documents-list.mapper';
import { ScheduleListMapper } from './data-mappers/schedule-list.mapper';
import type { DataMapper } from './data-mappers/base.mapper';
import {
  DOCUMENT_TYPE_TO_ENTITY_TYPE,
  type DocumentType,
  type GenerationTrigger,
  type TemplateData,
} from './types/document-types';
import { SOURCE_SCHEMAS } from './schemas';

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
    private readonly transformService: TransformService,
    private readonly dataContextService: DataContextService,
    private readonly gcsStorage: GcsStorageService,
    private readonly generatedDocsRepo: GeneratedDocumentsRepository,
    private readonly documentsService: DocumentsService,
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
    assessmentMapper: AssessmentMapper,
    documentMapper: DocumentMapper,
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
    assessmentsListMapper: AssessmentsListMapper,
    documentsListMapper: DocumentsListMapper,
    scheduleListMapper: ScheduleListMapper,
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
      scope_of_work: quoteMapper,
      claim: claimMapper,
      contact: contactMapper,
      task: taskMapper,
      appointment: appointmentMapper,
      message: messageMapper,
      journal: journalMapper,
      vendor: vendorMapper,
      assessment: assessmentMapper,
      document: documentMapper,
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
      assessments_list: assessmentsListMapper,
      documents_list: documentsListMapper,
      schedule_list: scheduleListMapper,
    };
  }

  async getSampleData(params: {
    documentType: DocumentType;
    entityId: string;
    enabledSlugs?: string[];
  }): Promise<TemplateData> {
    const logPrefix = 'DocumentGenerationService.getSampleData';
    const tenantId = this.tenantContext.getTenantId();
    const mapper = this.mappers[params.documentType];
    if (!mapper) {
      throw new NotFoundException(
        `No mapper registered for document type "${params.documentType}"`,
      );
    }
    this.logger.log(
      `${logPrefix} — type=${params.documentType} entityId=${params.entityId}`,
    );
    const mapperData = await mapper.aggregate({
      tenantId,
      entityId: params.entityId,
    });
    return this.enrichWithContext({
      tenantId,
      documentType: params.documentType,
      entityId: params.entityId,
      mapperData,
      enabledSlugs: params.enabledSlugs,
    });
  }

  async generate(params: {
    documentType: DocumentType;
    entityId?: string;
    templateId?: string;
    filesystemDocumentId?: string;
    destinationCategoryId?: string;
    enabledSlugs?: string[];
    trigger?: GenerationTrigger;
    userId?: string;
  }) {
    const logPrefix = 'DocumentGenerationService.generate';
    const tenantId = this.tenantContext.getTenantId();
    const entityType = DOCUMENT_TYPE_TO_ENTITY_TYPE[params.documentType];
    const trigger = params.trigger ?? 'manual';
    const entityId = this.resolveEntityId({
      documentType: params.documentType,
      entityId: params.entityId,
      tenantId,
    });

    this.logger.log(
      `${logPrefix} — type=${params.documentType} entityId=${entityId} trigger=${trigger}` +
        (params.destinationCategoryId
          ? ` destinationCategoryId=${params.destinationCategoryId}`
          : ''),
    );

    const record = await this.generatedDocsRepo.create({
      data: {
        tenantId,
        documentType: params.documentType,
        entityId,
        entityType,
        templateId: params.templateId ?? null,
        s3KeyPdf: '',
        trigger,
        status: 'pending',
        generatedBy: params.userId ?? null,
      },
    });

    setImmediate(() => {
      void this.runGenerate({
        recordId: record.id,
        tenantId,
        entityId,
        entityType,
        documentType: params.documentType,
        templateId: params.templateId,
        filesystemDocumentId: params.filesystemDocumentId,
        destinationCategoryId: params.destinationCategoryId,
        enabledSlugs: params.enabledSlugs,
        userId: params.userId,
      }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`${logPrefix} — background failed id=${record.id}: ${message}`);
      });
    });

    return record;
  }

  private async runGenerate(params: {
    recordId: string;
    tenantId: string;
    entityId: string;
    entityType: string;
    documentType: DocumentType;
    templateId?: string;
    filesystemDocumentId?: string;
    destinationCategoryId?: string;
    enabledSlugs?: string[];
    userId?: string;
  }) {
    const logPrefix = 'DocumentGenerationService.runGenerate';
    try {
      await this.generatedDocsRepo.updateStatus({
        id: params.recordId,
        status: 'processing',
      });

      const mapper = this.mappers[params.documentType];
      if (!mapper) {
        throw new BadRequestException(`No mapper for document type "${params.documentType}"`);
      }

      const mapperData = await mapper.aggregate({
        tenantId: params.tenantId,
        entityId: params.entityId,
      });
      const data = await this.enrichWithContext({
        tenantId: params.tenantId,
        documentType: params.documentType,
        entityId: params.entityId,
        mapperData,
        enabledSlugs: params.enabledSlugs,
      });

      const sourceSchema = SOURCE_SCHEMAS[params.documentType];
      if (sourceSchema && !hasContextDefinition(params.documentType)) {
        const result = sourceSchema.safeParse(data);
        if (!result.success) {
          const issues = result.error.issues.map(
            (issue) => `${issue.path.join('.')}: ${issue.message}`,
          );
          this.logger.warn(
            `${logPrefix} — source schema validation failed for type=${params.documentType}: ${issues.join('; ')}`,
          );
        }
      }

      const mergeData = await this.transformService.applyTransform({
        documentType: params.documentType,
        sourceData: data,
      });

      const { fileBuffer: templateBuffer } = await this.templateRegistry.resolve({
        tenantId: params.tenantId,
        documentType: params.documentType,
        templateId: params.templateId,
        filesystemDocumentId: params.filesystemDocumentId,
      });

      const populatedDocx = await this.templateEngine.populate({
        templateBuffer,
        data: mergeData,
      });

      const canConvertPdf = this.pdfConverter.isAvailable();
      let pdfBuffer: Buffer | null = null;
      if (canConvertPdf) {
        pdfBuffer = await this.pdfConverter.convertDocxToPdf({
          docxBuffer: populatedDocx,
        });
      } else {
        this.logger.warn(
          `${logPrefix} — no PDF converter available; completing with DOCX only id=${params.recordId}`,
        );
      }

      const pdfKey = pdfBuffer
        ? this.buildOutputKey({
            tenantId: params.tenantId,
            entityType: params.entityType,
            entityId: params.entityId,
            ext: 'pdf',
          })
        : '';
      const docxKey = this.buildOutputKey({
        tenantId: params.tenantId,
        entityType: params.entityType,
        entityId: params.entityId,
        ext: 'docx',
      });

      const uploads: Promise<unknown>[] = [
        this.gcsStorage.uploadBuffer({
          objectPath: docxKey,
          buffer: populatedDocx,
          contentType: DOCX_MIME,
        }),
      ];
      if (pdfBuffer && pdfKey) {
        uploads.push(
          this.gcsStorage.uploadBuffer({
            objectPath: pdfKey,
            buffer: pdfBuffer,
            contentType: 'application/pdf',
          }),
        );
      }
      await Promise.all(uploads);

      if (params.destinationCategoryId) {
        const label =
          SCENARIO_META[params.documentType]?.label ?? params.documentType;
        const dateStamp = new Date().toISOString().slice(0, 10);
        const ext = pdfBuffer ? 'pdf' : 'docx';
        const fileName = `${label.replace(/[^a-zA-Z0-9._-]+/g, '-')}-${dateStamp}.${ext}`;
        await this.documentsService.createFromBuffer({
          fileName,
          mimeType: pdfBuffer ? 'application/pdf' : DOCX_MIME,
          buffer: pdfBuffer ?? populatedDocx,
          categoryId: params.destinationCategoryId,
          relatedRecordType: params.entityType === 'Organization' ? null : params.entityType,
          relatedRecordId: params.entityType === 'Organization' ? null : params.entityId,
          userId: params.userId,
          tenantId: params.tenantId,
        });
        this.logger.log(
          `${logPrefix} — saved ${ext.toUpperCase()} to folder categoryId=${params.destinationCategoryId}`,
        );
      }

      await this.generatedDocsRepo.updateStatus({
        id: params.recordId,
        status: 'completed',
        s3KeyPdf: pdfKey,
        s3KeyDocx: docxKey,
      });

      this.logger.log(
        `${logPrefix} — completed id=${params.recordId} pdf=${pdfKey || 'none'} docx=${docxKey}`,
      );
    } catch (error) {
      const detail = formatDocumentGenerationError(error);
      this.logger.error(`${logPrefix} — failed id=${params.recordId}: ${detail}`);
      await this.generatedDocsRepo.updateStatus({
        id: params.recordId,
        status: 'failed',
        errorMessage: detail,
      });
    }
  }

  async getDownloadUrl(params: { id: string; format?: 'pdf' | 'docx' }) {
    const logPrefix = 'DocumentGenerationService.getDownloadUrl';
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.generatedDocsRepo.findById({ id: params.id, tenantId });
    if (!doc) throw new NotFoundException('Generated document not found');

    const resolved = this.resolveDownloadTarget(doc, params.format);
    const { key, format, fileName, mimeType } = resolved;

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

    const { key, format, fileName, mimeType } = this.resolveDownloadTarget(
      doc,
      params.format,
    );

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

  private async enrichWithContext(params: {
    tenantId: string;
    documentType: DocumentType;
    entityId: string;
    mapperData: TemplateData;
    enabledSlugs?: string[];
  }): Promise<TemplateData> {
    const envelope = await this.dataContextService.resolveForGeneration({
      tenantId: params.tenantId,
      documentType: params.documentType,
      entityId: params.entityId,
      enabledSlugs: params.enabledSlugs,
    });
    if (!envelope) return params.mapperData;

    // Line-item groups remain presentation-shaped (from mapper helpers) under `_context.groups`.
    if (Array.isArray(params.mapperData.groups)) {
      envelope.groups = params.mapperData.groups;
    }

    // Computed totals for types that lack entity-level sum columns (e.g. RFQ).
    if (params.mapperData._totals) {
      envelope._totals = params.mapperData._totals;
    }

    return { _context: envelope };
  }

  private resolveDownloadTarget(
    doc: { entityType: string; entityId: string; s3KeyPdf: string | null; s3KeyDocx: string | null },
    requested?: 'pdf' | 'docx',
  ): { key: string; format: 'pdf' | 'docx'; fileName: string; mimeType: string } {
    const pdfKey = doc.s3KeyPdf?.trim() ? doc.s3KeyPdf : null;
    const docxKey = doc.s3KeyDocx?.trim() ? doc.s3KeyDocx : null;
    const key =
      requested === 'docx'
        ? (docxKey ?? pdfKey)
        : (pdfKey ?? docxKey);
    if (!key) throw new NotFoundException('Document file not available');

    const format: 'pdf' | 'docx' = key.endsWith('.docx') ? 'docx' : 'pdf';
    return {
      key,
      format,
      fileName: `${doc.entityType}-${doc.entityId}.${format}`,
      mimeType: format === 'docx' ? DOCX_MIME : 'application/pdf',
    };
  }

  private resolveEntityId(params: {
    documentType: DocumentType;
    entityId?: string;
    tenantId: string;
  }): string {
    if (params.entityId) return params.entityId;
    const entityType = DOCUMENT_TYPE_TO_ENTITY_TYPE[params.documentType];
    if (entityType === 'Organization') return params.tenantId;
    throw new BadRequestException(
      `entityId is required for document type "${params.documentType}"`,
    );
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
