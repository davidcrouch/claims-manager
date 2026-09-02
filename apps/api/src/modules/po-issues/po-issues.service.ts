import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';
import {
  PoSendRequestsRepository,
  GeneratedDocumentsRepository,
  PurchaseOrdersRepository,
  FilesystemsRepository,
} from '../../database/repositories';
import type { GeneratedDocumentRow, PurchaseOrderRow } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { EmailService } from '../communications/email/email.service';
import { EmailTemplateService } from '../communications/templates/email-template.service';
import { DocumentsService } from '../filesystem/documents.service';
import { FilesystemService } from '../filesystem/filesystem.service';
import type {
  CreatePoIssueRequestDto,
  RetryPoIssueRequestDto,
  PoIssueRequestListItem,
  PoIssueRequestDetail,
} from './po-issues.types';

@Injectable()
export class PoIssuesService {
  private readonly logger = new Logger('api:PoIssuesService');

  constructor(
    private readonly sendRequestsRepo: PoSendRequestsRepository,
    private readonly generatedDocsRepo: GeneratedDocumentsRepository,
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly filesystemsRepo: FilesystemsRepository,
    private readonly filesystemService: FilesystemService,
    private readonly gcsStorage: GcsStorageService,
    private readonly documentsService: DocumentsService,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly tenantContext: TenantContext,
  ) {}

  async listByPurchaseOrder(purchaseOrderId: string): Promise<PoIssueRequestListItem[]> {
    const tenantId = this.tenantContext.getTenantId();
    const requests = await this.sendRequestsRepo.findAllByPurchaseOrder({
      tenantId,
      purchaseOrderId,
    });

    const results: PoIssueRequestListItem[] = [];
    for (const req of requests) {
      const recipients = await this.sendRequestsRepo.findRecipientsByRequestId({
        sendRequestId: req.id,
      });
      results.push({
        id: req.id,
        purchaseOrderId: req.purchaseOrderId,
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

  async getDetail(purchaseOrderId: string, requestId: string): Promise<PoIssueRequestDetail> {
    const tenantId = this.tenantContext.getTenantId();
    const request = await this.sendRequestsRepo.findById({ tenantId, id: requestId });
    if (!request || request.purchaseOrderId !== purchaseOrderId) {
      throw new NotFoundException('Issue request not found');
    }

    const recipients = await this.sendRequestsRepo.findRecipientsByRequestId({
      sendRequestId: request.id,
    });

    return {
      id: request.id,
      purchaseOrderId: request.purchaseOrderId,
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
    purchaseOrderId: string,
    dto: CreatePoIssueRequestDto,
    userId?: string,
    userEmail?: string,
  ): Promise<PoIssueRequestDetail> {
    const tenantId = this.tenantContext.getTenantId();
    const logPrefix = 'api:PoIssuesService.create';

    const po = await this.purchaseOrdersRepo.findOne({ id: purchaseOrderId, tenantId });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
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
      templateType: 'po_send',
    });

    const replyTo = userEmail ?? po.poToEmail ?? undefined;
    const emailSubject = dto.emailSubject ?? template.subject;
    const emailBodyHtml = dto.emailBodyHtml ?? template.bodyHtml;
    const emailBodyText = dto.emailBodyText ?? template.bodyText;

    await this.trySavePdfToJobFolder({
      tenantId,
      po,
      generatedDoc,
      userId,
    });

    const request = await this.sendRequestsRepo.create({
      data: {
        tenantId,
        purchaseOrderId,
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
      po,
      generatedDoc,
      emailSubject,
      emailBodyHtml,
      emailBodyText,
      replyTo,
    );

    return {
      id: request.id,
      purchaseOrderId: request.purchaseOrderId,
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
    purchaseOrderId: string,
    requestId: string,
    dto: RetryPoIssueRequestDto,
  ): Promise<PoIssueRequestDetail> {
    const tenantId = this.tenantContext.getTenantId();
    const request = await this.sendRequestsRepo.findById({ tenantId, id: requestId });
    if (!request || request.purchaseOrderId !== purchaseOrderId) {
      throw new NotFoundException('Issue request not found');
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

    const po = await this.purchaseOrdersRepo.findOne({ id: purchaseOrderId, tenantId });
    const generatedDoc = request.generatedDocId
      ? await this.generatedDocsRepo.findById({ id: request.generatedDocId, tenantId })
      : null;

    if (po && generatedDoc) {
      this.dispatchEmails(
        requestId,
        po,
        generatedDoc,
        request.emailSubject,
        request.emailBodyHtml,
        request.emailBodyText ?? undefined,
        request.replyTo ?? undefined,
      );
    }

    return this.getDetail(purchaseOrderId, requestId);
  }

  private async trySavePdfToJobFolder(params: {
    tenantId: string;
    po: PurchaseOrderRow;
    generatedDoc: GeneratedDocumentRow;
    userId?: string;
  }): Promise<void> {
    const logPrefix = 'api:PoIssuesService.trySavePdfToJobFolder';
    const { tenantId, po, generatedDoc, userId } = params;

    if (!po.jobId) {
      this.logger.log(`${logPrefix} - PO has no jobId; skipping folder save`);
      return;
    }

    const pdfKey = generatedDoc.s3KeyPdf?.trim();
    if (!pdfKey) {
      this.logger.warn(`${logPrefix} - No PDF key on generated doc ${generatedDoc.id}; skipping`);
      return;
    }

    try {
      const filesystem = await this.filesystemsRepo.findByJob(tenantId, po.jobId);
      if (!filesystem) {
        this.logger.log(
          `${logPrefix} - No project filesystem for job ${po.jobId}; skipping folder save`,
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

      const pdfBuffer = await this.gcsStorage.downloadBuffer(pdfKey);
      const dateStamp = new Date().toISOString().slice(0, 10);
      const safeNumber = (
        po.purchaseOrderNumber ??
        po.internalNumber ??
        po.name ??
        po.id
      ).replace(/[^a-zA-Z0-9._-]+/g, '-');
      const fileName = `Purchase-Order-${safeNumber}-${dateStamp}.pdf`;

      await this.documentsService.createFromBuffer({
        fileName,
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
        categoryId: category.id,
        relatedRecordType: 'PURCHASE_ORDER',
        relatedRecordId: po.id,
        userId,
        tenantId,
      });

      this.logger.log(
        `${logPrefix} - Saved PDF to category ${category.slug} (${category.id}) on job ${po.jobId}`,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `${logPrefix} - Folder save skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private dispatchEmails(
    requestId: string,
    po: PurchaseOrderRow,
    generatedDoc: { s3KeyPdf: string | null; s3KeyDocx: string | null },
    emailSubject: string,
    emailBodyHtml: string,
    emailBodyText: string | undefined,
    replyTo: string | undefined,
  ): void {
    setImmediate(() => {
      void this.executeDispatch(
        requestId,
        po,
        generatedDoc,
        emailSubject,
        emailBodyHtml,
        emailBodyText,
        replyTo,
      ).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `api:PoIssuesService.dispatchEmails - Background dispatch failed: ${msg}`,
        );
      });
    });
  }

  private async executeDispatch(
    requestId: string,
    po: PurchaseOrderRow,
    generatedDoc: { s3KeyPdf: string | null; s3KeyDocx: string | null },
    emailSubject: string,
    emailBodyHtml: string,
    emailBodyText: string | undefined,
    replyTo: string | undefined,
  ): Promise<void> {
    const logPrefix = 'api:PoIssuesService.executeDispatch';

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

    const poFromObj =
      po.poFrom && typeof po.poFrom === 'object'
        ? (po.poFrom as Record<string, unknown>)
        : {};
    const senderName = (poFromObj.name as string) ?? 'Team';
    const companyName =
      (poFromObj.companyName as string) ?? (poFromObj.name as string) ?? '';
    const poNumber = po.purchaseOrderNumber ?? po.internalNumber ?? po.name ?? '';

    let sentCount = 0;
    let failCount = 0;

    for (const recipient of pendingRecipients) {
      const fields: Record<string, string | undefined> = {
        po_number: poNumber,
        po_name: po.name ?? '',
        recipient_name: recipient.recipientName,
        sender_name: senderName,
        company_name: companyName,
        due_date: po.endDate
          ? new Date(po.endDate).toLocaleDateString('en-AU')
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
                  filename: `${poNumber || 'Purchase-Order'}.pdf`,
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                },
              ]
            : undefined,
          tags: [
            { name: 'category', value: 'po-send' },
            ...(poNumber
              ? [
                  {
                    name: 'po-number',
                    value: String(poNumber).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50),
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
