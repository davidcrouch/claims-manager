import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';
import {
  RfqSendRequestsRepository,
  GeneratedDocumentsRepository,
  RfqsRepository,
  FilesystemsRepository,
} from '../../database/repositories';
import type { GeneratedDocumentRow, RfqRow } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { EmailService } from '../communications/email/email.service';
import { EmailTemplateService } from '../communications/templates/email-template.service';
import { DocumentsService } from '../filesystem/documents.service';
import { FilesystemService } from '../filesystem/filesystem.service';
import type {
  CreateSendRequestDto,
  RetrySendRequestDto,
  SendRequestListItem,
  SendRequestDetail,
} from './rfq-requests.types';

@Injectable()
export class RfqRequestsService {
  private readonly logger = new Logger('api:RfqRequestsService');

  constructor(
    private readonly sendRequestsRepo: RfqSendRequestsRepository,
    private readonly generatedDocsRepo: GeneratedDocumentsRepository,
    private readonly rfqsRepo: RfqsRepository,
    private readonly filesystemsRepo: FilesystemsRepository,
    private readonly filesystemService: FilesystemService,
    private readonly gcsStorage: GcsStorageService,
    private readonly documentsService: DocumentsService,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly tenantContext: TenantContext,
  ) {}

  async listByRfq(rfqId: string): Promise<SendRequestListItem[]> {
    const tenantId = this.tenantContext.getTenantId();
    const requests = await this.sendRequestsRepo.findAllByRfq({ tenantId, rfqId });

    const results: SendRequestListItem[] = [];
    for (const req of requests) {
      const recipients = await this.sendRequestsRepo.findRecipientsByRequestId({
        sendRequestId: req.id,
      });
      results.push({
        id: req.id,
        rfqId: req.rfqId,
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

  async getDetail(rfqId: string, requestId: string): Promise<SendRequestDetail> {
    const tenantId = this.tenantContext.getTenantId();
    const request = await this.sendRequestsRepo.findById({ tenantId, id: requestId });
    if (!request || request.rfqId !== rfqId) {
      throw new NotFoundException('Send request not found');
    }

    const recipients = await this.sendRequestsRepo.findRecipientsByRequestId({
      sendRequestId: request.id,
    });

    return {
      id: request.id,
      rfqId: request.rfqId,
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
    rfqId: string,
    dto: CreateSendRequestDto,
    userId?: string,
    userEmail?: string,
  ): Promise<SendRequestDetail> {
    const tenantId = this.tenantContext.getTenantId();
    const logPrefix = 'api:RfqRequestsService.create';

    const rfq = await this.rfqsRepo.findOne({ id: rfqId, tenantId });
    if (!rfq) {
      throw new NotFoundException('RFQ not found');
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
      templateType: 'rfq_send',
    });

    const replyTo = userEmail ?? rfq.rfqToEmail ?? undefined;
    const emailSubject = dto.emailSubject ?? template.subject;
    const emailBodyHtml = dto.emailBodyHtml ?? template.bodyHtml;
    const emailBodyText = dto.emailBodyText ?? template.bodyText;

    // File the PDF into the job folder only on send (best-effort; settings may be stubs).
    await this.trySavePdfToJobFolder({
      tenantId,
      rfq,
      generatedDoc,
      userId,
    });

    const request = await this.sendRequestsRepo.create({
      data: {
        tenantId,
        rfqId,
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

    this.dispatchEmails(
      request.id,
      rfq,
      generatedDoc,
      emailSubject,
      emailBodyHtml,
      emailBodyText,
      replyTo,
    );

    return {
      id: request.id,
      rfqId: request.rfqId,
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

  async retry(rfqId: string, requestId: string, dto: RetrySendRequestDto): Promise<SendRequestDetail> {
    const tenantId = this.tenantContext.getTenantId();
    const request = await this.sendRequestsRepo.findById({ tenantId, id: requestId });
    if (!request || request.rfqId !== rfqId) {
      throw new NotFoundException('Send request not found');
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

    const rfq = await this.rfqsRepo.findOne({ id: rfqId, tenantId });
    const generatedDoc = request.generatedDocId
      ? await this.generatedDocsRepo.findById({ id: request.generatedDocId, tenantId })
      : null;

    if (rfq && generatedDoc) {
      this.dispatchEmails(
        requestId,
        rfq,
        generatedDoc,
        request.emailSubject,
        request.emailBodyHtml,
        request.emailBodyText ?? undefined,
        request.replyTo ?? undefined,
      );
    }

    return this.getDetail(rfqId, requestId);
  }

  /**
   * Best-effort save of the generated RFQ PDF into the job project filesystem.
   * Preview generation never files the document — only Send does.
   * Skips quietly when the job has no filesystem / no suitable folder (settings may be stubs).
   */
  private async trySavePdfToJobFolder(params: {
    tenantId: string;
    rfq: RfqRow;
    generatedDoc: GeneratedDocumentRow;
    userId?: string;
  }): Promise<void> {
    const logPrefix = 'api:RfqRequestsService.trySavePdfToJobFolder';
    const { tenantId, rfq, generatedDoc, userId } = params;

    if (!rfq.jobId) {
      this.logger.log(`${logPrefix} - RFQ has no jobId; skipping folder save`);
      return;
    }

    const pdfKey = generatedDoc.s3KeyPdf?.trim();
    if (!pdfKey) {
      this.logger.warn(`${logPrefix} - No PDF key on generated doc ${generatedDoc.id}; skipping`);
      return;
    }

    try {
      const filesystem = await this.filesystemsRepo.findByJob(tenantId, rfq.jobId);
      if (!filesystem) {
        this.logger.log(
          `${logPrefix} - No project filesystem for job ${rfq.jobId}; skipping folder save`,
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
          `${logPrefix} - No suitable folder on filesystem ${filesystem.id} (preferredSlug=${preferredSlug ?? 'none'}); skipping folder save`,
        );
        return;
      }

      const pdfBuffer = await this.gcsStorage.downloadBuffer(pdfKey);
      const dateStamp = new Date().toISOString().slice(0, 10);
      const safeNumber = (rfq.rfqNumber ?? rfq.name ?? rfq.id).replace(/[^a-zA-Z0-9._-]+/g, '-');
      const fileName = `Request-for-Quotation-${safeNumber}-${dateStamp}.pdf`;

      await this.documentsService.createFromBuffer({
        fileName,
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
        categoryId: category.id,
        relatedRecordType: 'RFQ',
        relatedRecordId: rfq.id,
        userId,
        tenantId,
      });

      this.logger.log(
        `${logPrefix} - Saved PDF to category ${category.slug} (${category.id}) on job ${rfq.jobId}`,
      );
    } catch (err: unknown) {
      // Soft-fail: email dispatch must still proceed even if folder filing is incomplete.
      this.logger.warn(
        `${logPrefix} - Folder save skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private dispatchEmails(
    requestId: string,
    rfq: { rfqNumber: string | null; name: string | null; dueDate: Date | null; rfqFrom: unknown },
    generatedDoc: { s3KeyPdf: string | null; s3KeyDocx: string | null },
    emailSubject: string,
    emailBodyHtml: string,
    emailBodyText: string | undefined,
    replyTo: string | undefined,
  ): void {
    setImmediate(() => {
      void this.executeDispatch(
        requestId,
        rfq,
        generatedDoc,
        emailSubject,
        emailBodyHtml,
        emailBodyText,
        replyTo,
      ).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `api:RfqRequestsService.dispatchEmails - Background dispatch failed: ${msg}`,
        );
      });
    });
  }

  private async executeDispatch(
    requestId: string,
    rfq: { rfqNumber: string | null; name: string | null; dueDate: Date | null; rfqFrom: unknown },
    generatedDoc: { s3KeyPdf: string | null; s3KeyDocx: string | null },
    emailSubject: string,
    emailBodyHtml: string,
    emailBodyText: string | undefined,
    replyTo: string | undefined,
  ): Promise<void> {
    const logPrefix = 'api:RfqRequestsService.executeDispatch';

    let pdfBuffer: Buffer | null = null;
    const pdfKey = generatedDoc.s3KeyPdf;
    if (pdfKey) {
      try {
        pdfBuffer = await this.gcsStorage.downloadBuffer(pdfKey);
      } catch (err: unknown) {
        this.logger.error(
          `${logPrefix} - Failed to download PDF: ${err instanceof Error ? err.message : err}`,
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

    const rfqFromObj =
      rfq.rfqFrom && typeof rfq.rfqFrom === 'object'
        ? (rfq.rfqFrom as Record<string, unknown>)
        : {};
    const senderName = (rfqFromObj.name as string) ?? 'Team';
    const companyName =
      (rfqFromObj.companyName as string) ?? (rfqFromObj.name as string) ?? '';

    let sentCount = 0;
    let failCount = 0;

    for (const recipient of pendingRecipients) {
      const fields: Record<string, string | undefined> = {
        rfq_number: rfq.rfqNumber ?? rfq.name ?? '',
        rfq_name: rfq.name ?? '',
        recipient_name: recipient.recipientName,
        sender_name: senderName,
        company_name: companyName,
        due_date: rfq.dueDate
          ? new Date(rfq.dueDate).toLocaleDateString('en-AU')
          : 'Not specified',
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
          attachments: pdfBuffer
            ? [
                {
                  filename: `${rfq.rfqNumber ?? 'RFQ'}.pdf`,
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                },
              ]
            : undefined,
          tags: [
            { name: 'category', value: 'rfq-send' },
            ...(rfq.rfqNumber
              ? [
                  {
                    name: 'rfq-number',
                    value: String(rfq.rfqNumber).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50),
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
            errorMessage: result.error ?? 'Unknown error',
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

    let batchStatus = 'success';
    if (failCount > 0 && sentCount > 0) batchStatus = 'partial';
    else if (failCount > 0 && sentCount === 0) batchStatus = 'failed';

    await this.sendRequestsRepo.updateStatus({ id: requestId, status: batchStatus });
    this.logger.log(
      `${logPrefix} - Batch ${requestId} complete: ${sentCount} sent, ${failCount} failed`,
    );
  }
}
