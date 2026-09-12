import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';
import {
  InvoiceSendRequestsRepository,
  GeneratedDocumentsRepository,
  InvoicesRepository,
  JobsRepository,
  FilesystemsRepository,
  type GeneratedDocumentRow,
  type InvoiceViewRow,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { EmailService } from '../communications/email/email.service';
import { EmailTemplateService } from '../communications/templates/email-template.service';
import { DocumentsService } from '../filesystem/documents.service';
import { FilesystemService } from '../filesystem/filesystem.service';
import { InvoicesService } from '../invoices/invoices.service';
import type {
  CreateInvoiceSendRequestDto,
  RetryInvoiceSendRequestDto,
  InvoiceSendRequestListItem,
  InvoiceSendRequestDetail,
} from './invoice-issues.types';

@Injectable()
export class InvoiceIssuesService {
  private readonly logger = new Logger('api:InvoiceIssuesService');

  constructor(
    private readonly sendRequestsRepo: InvoiceSendRequestsRepository,
    private readonly generatedDocsRepo: GeneratedDocumentsRepository,
    private readonly invoicesRepo: InvoicesRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly filesystemsRepo: FilesystemsRepository,
    private readonly filesystemService: FilesystemService,
    private readonly gcsStorage: GcsStorageService,
    private readonly documentsService: DocumentsService,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly invoicesService: InvoicesService,
    private readonly tenantContext: TenantContext,
  ) {}

  async listByInvoice(invoiceId: string): Promise<InvoiceSendRequestListItem[]> {
    const tenantId = this.tenantContext.getTenantId();
    const requests = await this.sendRequestsRepo.findAllByInvoice({
      tenantId,
      invoiceId,
    });

    const results: InvoiceSendRequestListItem[] = [];
    for (const req of requests) {
      const recipients = await this.sendRequestsRepo.findRecipientsByRequestId({
        sendRequestId: req.id,
      });
      results.push({
        id: req.id,
        invoiceId: req.invoiceId,
        status: req.status,
        initiatedBy: req.initiatedBy,
        emailSubject: req.emailSubject,
        replyTo: req.replyTo,
        recipientCount: recipients.length,
        recipients: recipients.map((r) => ({
          id: r.id,
          recipientName: r.recipientName,
          recipientEmail: r.recipientEmail,
          status: r.status,
        })),
        createdAt: req.createdAt,
      });
    }
    return results;
  }

  async getDetail(invoiceId: string, requestId: string): Promise<InvoiceSendRequestDetail> {
    const tenantId = this.tenantContext.getTenantId();
    const request = await this.sendRequestsRepo.findById({ tenantId, id: requestId });
    if (!request || request.invoiceId !== invoiceId) {
      throw new NotFoundException('Invoice send request not found');
    }

    const recipients = await this.sendRequestsRepo.findRecipientsByRequestId({
      sendRequestId: request.id,
    });

    return {
      id: request.id,
      invoiceId: request.invoiceId,
      status: request.status,
      initiatedBy: request.initiatedBy,
      generatedDocId: request.generatedDocId,
      emailSubject: request.emailSubject,
      emailBodyHtml: request.emailBodyHtml,
      replyTo: request.replyTo,
      recipients: recipients.map((r) => ({
        id: r.id,
        contactId: r.contactId,
        recipientName: r.recipientName,
        recipientEmail: r.recipientEmail,
        status: r.status,
        errorMessage: r.errorMessage,
        sentAt: r.sentAt,
        retryCount: r.retryCount,
      })),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  async create(
    invoiceId: string,
    dto: CreateInvoiceSendRequestDto,
    userId?: string,
    userEmail?: string,
  ): Promise<InvoiceSendRequestDetail> {
    const tenantId = this.tenantContext.getTenantId();
    const logPrefix = 'api:InvoiceIssuesService.create';

    const invoice = await this.invoicesRepo.findOne({ id: invoiceId, tenantId });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const recipientType = (invoice.recipientType ?? '').toLowerCase();
    if (recipientType !== 'insured' && recipientType !== 'other') {
      throw new BadRequestException(
        'Email delivery is only available for invoices with Insured or Other recipient',
      );
    }

    if (!dto.recipients || dto.recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    const invalidRecipients = dto.recipients.filter((r) => !r.email?.trim());
    if (invalidRecipients.length > 0) {
      throw new BadRequestException('All recipients must have a valid email address');
    }

    const generatedDoc = await this.generatedDocsRepo.findById({
      id: dto.generatedDocumentId,
      tenantId,
    });
    if (!generatedDoc) {
      throw new BadRequestException('Generated document not found');
    }
    if (generatedDoc.status !== 'completed') {
      throw new BadRequestException(
        'Generated document is not ready (status: ' + generatedDoc.status + ')',
      );
    }

    const template = await this.emailTemplateService.resolve({
      tenantId,
      templateType: 'invoice_send',
    });

    const replyTo = userEmail ?? undefined;
    const emailSubject = dto.emailSubject ?? template.subject;
    const emailBodyHtml = dto.emailBodyHtml ?? template.bodyHtml;
    const emailBodyText = dto.emailBodyText ?? template.bodyText;

    await this.trySavePdfToJobFolder({
      tenantId,
      invoice,
      generatedDoc,
      userId,
    });

    const request = await this.sendRequestsRepo.create({
      data: {
        tenantId,
        invoiceId,
        status: 'pending',
        initiatedBy: userId ?? null,
        generatedDocId: dto.generatedDocumentId,
        emailSubject,
        emailBodyHtml,
        emailBodyText,
        replyTo: replyTo ?? null,
      },
    });

    const recipientRows = await this.sendRequestsRepo.createRecipients({
      data: dto.recipients.map((r) => ({
        sendRequestId: request.id,
        contactId: r.contactId ?? null,
        recipientName: r.name,
        recipientEmail: r.email,
        status: 'pending',
      })),
    });

    this.logger.log(
      `${logPrefix} - Created batch ${request.id} with ${recipientRows.length} recipients`,
    );

    // Lock invoice locally (Reviewed → Invoiced) without Crunchwork push
    await this.invoicesService.publishLocal({ id: invoiceId, userId });

    this.dispatchEmails(
      request.id,
      invoice,
      generatedDoc,
      emailSubject,
      emailBodyHtml,
      emailBodyText,
      replyTo,
    );

    return {
      id: request.id,
      invoiceId: request.invoiceId,
      status: request.status,
      initiatedBy: request.initiatedBy,
      generatedDocId: request.generatedDocId,
      emailSubject: request.emailSubject,
      emailBodyHtml: request.emailBodyHtml,
      replyTo: request.replyTo,
      recipients: recipientRows.map((r) => ({
        id: r.id,
        contactId: r.contactId,
        recipientName: r.recipientName,
        recipientEmail: r.recipientEmail,
        status: r.status,
        errorMessage: r.errorMessage,
        sentAt: r.sentAt,
        retryCount: r.retryCount,
      })),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  async retry(
    invoiceId: string,
    requestId: string,
    dto: RetryInvoiceSendRequestDto,
  ): Promise<InvoiceSendRequestDetail> {
    const tenantId = this.tenantContext.getTenantId();
    const request = await this.sendRequestsRepo.findById({ tenantId, id: requestId });
    if (!request || request.invoiceId !== invoiceId) {
      throw new NotFoundException('Invoice send request not found');
    }

    const recipients = await this.sendRequestsRepo.findRecipientsByRequestId({
      sendRequestId: requestId,
    });

    for (const retryItem of dto.recipients) {
      const recipient = recipients.find((r) => r.id === retryItem.recipientId);
      if (!recipient) continue;
      if (recipient.status !== 'failed') continue;

      if (retryItem.email) {
        await this.sendRequestsRepo.updateRecipientStatus({
          id: recipient.id,
          status: 'pending',
          errorMessage: null,
          recipientEmail: retryItem.email,
        });
      } else {
        await this.sendRequestsRepo.updateRecipientStatus({
          id: recipient.id,
          status: 'pending',
          errorMessage: null,
        });
      }
    }

    await this.sendRequestsRepo.updateStatus({ id: requestId, status: 'pending' });

    const invoice = await this.invoicesRepo.findOne({ id: invoiceId, tenantId });
    const generatedDoc = request.generatedDocId
      ? await this.generatedDocsRepo.findById({ id: request.generatedDocId, tenantId })
      : null;

    if (invoice && generatedDoc) {
      this.dispatchEmails(
        requestId,
        invoice,
        generatedDoc,
        request.emailSubject,
        request.emailBodyHtml,
        request.emailBodyText ?? undefined,
        request.replyTo ?? undefined,
      );
    }

    return this.getDetail(invoiceId, requestId);
  }

  private async trySavePdfToJobFolder(params: {
    tenantId: string;
    invoice: InvoiceViewRow;
    generatedDoc: GeneratedDocumentRow;
    userId?: string;
  }): Promise<void> {
    const logPrefix = 'api:InvoiceIssuesService.trySavePdfToJobFolder';
    const { tenantId, invoice, generatedDoc, userId } = params;

    if (!invoice.jobId) {
      this.logger.log(`${logPrefix} - Invoice has no jobId; skipping folder save`);
      return;
    }

    const pdfKey = generatedDoc.s3KeyPdf?.trim();
    const docxKey = generatedDoc.s3KeyDocx?.trim();
    const objectKey = pdfKey || docxKey;
    if (!objectKey) {
      this.logger.warn(
        `${logPrefix} - No PDF/DOCX key on generated doc ${generatedDoc.id}; skipping`,
      );
      return;
    }
    const isPdf = !!pdfKey;
    const ext = isPdf ? 'pdf' : 'docx';
    const mimeType = isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    try {
      const filesystem = await this.filesystemsRepo.findByJob(tenantId, invoice.jobId);
      if (!filesystem) {
        this.logger.log(
          `${logPrefix} - No project filesystem for job ${invoice.jobId}; skipping folder save`,
        );
        return;
      }

      const categories = await this.filesystemsRepo.getCategoryTree(filesystem.id);
      let preferredSlug: string | null = null;
      try {
        const exportSettings = await this.filesystemService.getArtifactExportSettings('project');
        preferredSlug = exportSettings.defaultCategoryId ?? null;
      } catch {
        // Settings may be stubs / unset — fall through to heuristic.
      }

      const category =
        (preferredSlug
          ? categories.find((c) => c.slug === preferredSlug || c.id === preferredSlug)
          : undefined) ??
        categories.find((c) => /report/i.test(c.slug) || /report/i.test(c.displayName)) ??
        null;

      if (!category) {
        this.logger.log(
          `${logPrefix} - No suitable folder on filesystem ${filesystem.id}; skipping folder save`,
        );
        return;
      }

      const fileBuffer = await this.gcsStorage.downloadBuffer(objectKey);
      const dateStamp = new Date().toISOString().slice(0, 10);
      const safeNumber = (
        invoice.invoiceNumber ??
        invoice.internalNumber ??
        invoice.id
      ).replace(/[^a-zA-Z0-9._-]+/g, '-');
      const fileName = `Invoice-${safeNumber}-${dateStamp}.${ext}`;

      await this.documentsService.createFromBuffer({
        fileName,
        mimeType,
        buffer: fileBuffer,
        categoryId: category.id,
        relatedRecordType: 'INVOICE',
        relatedRecordId: invoice.id,
        userId,
        tenantId,
      });

      this.logger.log(
        `${logPrefix} - Saved ${ext.toUpperCase()} to category ${category.slug} (${category.id}) on job ${invoice.jobId}`,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `${logPrefix} - Folder save skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private dispatchEmails(
    requestId: string,
    invoice: InvoiceViewRow,
    generatedDoc: { s3KeyPdf: string | null; s3KeyDocx: string | null },
    emailSubject: string,
    emailBodyHtml: string,
    emailBodyText: string | undefined,
    replyTo: string | undefined,
  ): void {
    setImmediate(() => {
      void this.executeDispatch(
        requestId,
        invoice,
        generatedDoc,
        emailSubject,
        emailBodyHtml,
        emailBodyText,
        replyTo,
      ).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `api:InvoiceIssuesService.dispatchEmails - Background dispatch failed: ${msg}`,
        );
      });
    });
  }

  private async executeDispatch(
    requestId: string,
    invoice: InvoiceViewRow,
    generatedDoc: { s3KeyPdf: string | null; s3KeyDocx: string | null },
    emailSubject: string,
    emailBodyHtml: string,
    emailBodyText: string | undefined,
    replyTo: string | undefined,
  ): Promise<void> {
    const logPrefix = 'api:InvoiceIssuesService.executeDispatch';
    const tenantId = this.tenantContext.getTenantId();

    let attachment:
      | { filename: string; content: Buffer; contentType: string }
      | undefined;

    const invoiceNumber =
      invoice.invoiceNumber ?? invoice.internalNumber ?? '';
    const pdfKey = generatedDoc.s3KeyPdf?.trim();
    const docxKey = generatedDoc.s3KeyDocx?.trim();
    if (pdfKey) {
      try {
        const pdfBuffer = await this.gcsStorage.downloadBuffer(pdfKey);
        attachment = {
          filename: `${invoiceNumber || 'Invoice'}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        };
      } catch (err: unknown) {
        this.logger.error(
          `${logPrefix} - Failed to download PDF: ${err instanceof Error ? err.message : err}`,
        );
      }
    } else if (docxKey) {
      try {
        const docxBuffer = await this.gcsStorage.downloadBuffer(docxKey);
        attachment = {
          filename: `${invoiceNumber || 'Invoice'}.docx`,
          content: docxBuffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
      } catch (err: unknown) {
        this.logger.error(
          `${logPrefix} - Failed to download DOCX: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    const recipients = await this.sendRequestsRepo.findRecipientsByRequestId({
      sendRequestId: requestId,
    });
    const pendingRecipients = recipients.filter((r) => r.status === 'pending');

    if (pendingRecipients.length === 0) {
      await this.sendRequestsRepo.updateStatus({ id: requestId, status: 'success' });
      return;
    }

    let jobName = '';
    if (invoice.jobId) {
      const job = await this.jobsRepo.findOne({ id: invoice.jobId, tenantId });
      jobName =
        job?.name?.trim() ||
        job?.externalJobId?.trim() ||
        job?.internalNumber?.trim() ||
        '';
    }

    const amount =
      invoice.totalAmount != null
        ? `$${Number(invoice.totalAmount).toLocaleString('en-AU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : '';

    let sentCount = 0;
    let failCount = 0;

    for (const recipient of pendingRecipients) {
      const fields: Record<string, string | undefined> = {
        invoice_number: invoiceNumber,
        invoice_amount: amount,
        job_name: jobName,
        recipient_name: recipient.recipientName,
        sender_name: 'Team',
        company_name: '',
        reply_to_email: replyTo ?? '',
      };

      const renderedTemplate = this.emailTemplateService.renderTemplate(
        { subject: emailSubject, bodyHtml: emailBodyHtml, bodyText: emailBodyText },
        fields,
      );

      try {
        const result = await this.emailService.send({
          to: recipient.recipientEmail,
          subject: renderedTemplate.subject,
          html: renderedTemplate.bodyHtml,
          text: renderedTemplate.bodyText,
          replyTo,
          attachments: attachment ? [attachment] : undefined,
          tags: [
            { name: 'category', value: 'invoice-send' },
            ...(invoiceNumber
              ? [
                  {
                    name: 'invoice-number',
                    value: String(invoiceNumber)
                      .replace(/[^a-zA-Z0-9_-]/g, '-')
                      .slice(0, 50),
                  },
                ]
              : []),
          ],
        });

        if (result.success) {
          await this.sendRequestsRepo.updateRecipientStatus({
            id: recipient.id,
            status: 'sent',
            resendMessageId: result.id ?? null,
            sentAt: new Date(),
            errorMessage: null,
          });
          sentCount++;
        } else {
          await this.sendRequestsRepo.updateRecipientStatus({
            id: recipient.id,
            status: 'failed',
            errorMessage: result.error ?? 'Send failed',
            retryCount: recipient.retryCount + 1,
          });
          failCount++;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `${logPrefix} - Send failed for ${recipient.recipientEmail}: ${errMsg}`,
        );
        await this.sendRequestsRepo.updateRecipientStatus({
          id: recipient.id,
          status: 'failed',
          errorMessage: errMsg,
          retryCount: recipient.retryCount + 1,
        });
        failCount++;
      }
    }

    const finalStatus =
      failCount === 0 ? 'success' : sentCount === 0 ? 'failed' : 'partial';
    await this.sendRequestsRepo.updateStatus({ id: requestId, status: finalStatus });
    this.logger.log(
      `${logPrefix} - Request ${requestId} finished status=${finalStatus} sent=${sentCount} failed=${failCount}`,
    );
  }
}
