import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { S3Service } from '../../common/s3/s3.service';
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
import type { DataMapper } from './data-mappers/base.mapper';
import {
  DOCUMENT_TYPE_TO_ENTITY_TYPE,
  type DocumentType,
  type GenerationTrigger,
} from './types/document-types';

@Injectable()
export class DocumentGenerationService {
  private readonly logger = new Logger('DocumentGenerationService');
  private readonly mappers: Record<DocumentType, DataMapper>;

  constructor(
    private readonly tenantContext: TenantContext,
    private readonly templateRegistry: TemplateRegistryService,
    private readonly templateEngine: TemplateEngineService,
    private readonly pdfConverter: PdfConverterService,
    private readonly s3Service: S3Service,
    private readonly generatedDocsRepo: GeneratedDocumentsRepository,
    quoteMapper: QuoteMapper,
    invoiceMapper: InvoiceMapper,
    purchaseOrderMapper: PurchaseOrderMapper,
    workOrderMapper: WorkOrderMapper,
    proposalMapper: ProposalMapper,
    reportMapper: ReportMapper,
    billMapper: BillMapper,
    rfqMapper: RfqMapper,
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

      const { template, fileBuffer: templateBuffer } = await this.templateRegistry.resolve({
        tenantId,
        documentType: params.documentType,
        templateId: params.templateId,
      });

      const populatedDocx = this.templateEngine.populate({
        templateBuffer,
        data,
      });

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await this.pdfConverter.convertDocxToPdf({ docxBuffer: populatedDocx });
      } catch {
        this.logger.warn(
          `${logPrefix} — PDF conversion unavailable, storing .docx only. Install LibreOffice for PDF support.`,
        );
        const docxKey = this.buildOutputKey({ tenantId, entityType, entityId: params.entityId, ext: 'docx' });
        await this.s3Service.putJson({
          key: docxKey,
          body: populatedDocx,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        const updated = await this.generatedDocsRepo.updateStatus({
          id: record.id,
          status: 'completed',
          s3KeyPdf: docxKey,
          s3KeyDocx: docxKey,
        });

        return updated;
      }

      const pdfKey = this.buildOutputKey({ tenantId, entityType, entityId: params.entityId, ext: 'pdf' });
      const docxKey = this.buildOutputKey({ tenantId, entityType, entityId: params.entityId, ext: 'docx' });

      await Promise.all([
        this.s3Service.putJson({
          key: pdfKey,
          body: pdfBuffer,
          contentType: 'application/pdf',
        }),
        this.s3Service.putJson({
          key: docxKey,
          body: populatedDocx,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

    const url = await this.s3Service.getSignedDownloadUrl({ key });
    this.logger.debug(`${logPrefix} — presigned URL for id=${params.id} format=${params.format ?? 'pdf'}`);
    return { url, format: params.format ?? 'pdf' };
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
    return `generated/${params.tenantId}/${params.entityType}/${params.entityId}/${ts}.${params.ext}`;
  }
}
