import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Dispatches domain events to external capability servers (more0-ensure).
 *
 * When More0 is production-ready, this service can be removed — More0
 * will receive events directly via its own webhook infrastructure.
 */
@Injectable()
export class OutboundEventsService {
  private readonly logger = new Logger('OutboundEvents');
  private readonly webhookUrl: string | null;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.webhookUrl = config.get<string>('CAPABILITY_WEBHOOK_URL', '');
    this.enabled = !!this.webhookUrl;

    if (this.enabled) {
      this.logger.log(
        `OutboundEvents — dispatching to ${this.webhookUrl}`,
      );
    } else {
      this.logger.log(
        'OutboundEvents — disabled (CAPABILITY_WEBHOOK_URL not set)',
      );
    }
  }

  /**
   * Fire an event to the capability webhook endpoint.
   * Non-blocking — errors are logged but do not propagate.
   */
  async emit(event: {
    eventType: string;
    entityType: string;
    entityId: string;
    tenantId: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.enabled || !this.webhookUrl) return;

    const body = {
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
      payload: event.payload ?? {},
    };

    const url = `${this.webhookUrl}/claims-manager`;

    this.logger.debug(
      `OutboundEvents.emit — ${event.eventType} ${event.entityType}:${event.entityId}`,
    );

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        this.logger.warn(
          `OutboundEvents.emit — HTTP ${response.status} for ${event.eventType}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `OutboundEvents.emit — failed to dispatch ${event.eventType}: ${(err as Error).message}`,
      );
    }
  }

  // ── Convenience methods for common events ──────────────────────

  async emitTaskCompleted(params: {
    taskId: string;
    taskName: string;
    jobId: string;
    entityType: string;
    entityId: string;
    tenantId: string;
    completedAt?: string;
  }): Promise<void> {
    await this.emit({
      eventType: 'task.completed',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        taskId: params.taskId,
        taskName: params.taskName,
        jobId: params.jobId,
        completedAt: params.completedAt ?? new Date().toISOString(),
      },
    });
  }

  async emitTaskFailed(params: {
    taskId: string;
    taskName: string;
    jobId: string;
    tenantId: string;
  }): Promise<void> {
    await this.emit({
      eventType: 'task.failed',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        taskId: params.taskId,
        taskName: params.taskName,
        jobId: params.jobId,
      },
    });
  }

  async emitAppointmentScheduled(params: {
    appointmentId: string;
    jobId: string;
    tenantId: string;
    scheduledAt: string;
    appointmentDate: string;
  }): Promise<void> {
    await this.emit({
      eventType: 'appointment.scheduled',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        appointmentId: params.appointmentId,
        jobId: params.jobId,
        scheduledAt: params.scheduledAt,
        appointmentDate: params.appointmentDate,
      },
    });
  }

  async emitQuotePublished(params: {
    quoteId: string;
    jobId: string;
    tenantId: string;
    publishedAt: string;
    quoteType?: string;
    claimRecommendation?: string;
    autoApprovalApplies?: boolean;
    claimDecision?: string;
    withinDelegateAuthority?: boolean;
  }): Promise<void> {
    await this.emit({
      eventType: 'quote.published',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        quoteId: params.quoteId,
        jobId: params.jobId,
        publishedAt: params.publishedAt,
        quoteType: params.quoteType,
        claimRecommendation: params.claimRecommendation,
        autoApprovalApplies: params.autoApprovalApplies,
        claimDecision: params.claimDecision,
        withinDelegateAuthority: params.withinDelegateAuthority,
      },
    });
  }

  async emitQuoteStatusChanged(params: {
    quoteId: string;
    jobId: string;
    tenantId: string;
    newStatus: string;
    previousStatus?: string;
  }): Promise<void> {
    await this.emit({
      eventType: 'quote.status_changed',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        quoteId: params.quoteId,
        jobId: params.jobId,
        newStatus: params.newStatus,
        previousStatus: params.previousStatus,
      },
    });
  }

  async emitFieldUpdated(params: {
    entityType: string;
    entityId: string;
    tenantId: string;
    field: string;
    value: unknown;
    previousValue?: unknown;
  }): Promise<void> {
    await this.emit({
      eventType: 'field.updated',
      entityType: params.entityType,
      entityId: params.entityId,
      tenantId: params.tenantId,
      payload: {
        field: params.field,
        value: params.value,
        previousValue: params.previousValue,
      },
    });
  }

  async emitPurchaseOrderCompleted(params: {
    purchaseOrderId: string;
    jobId: string;
    tenantId: string;
  }): Promise<void> {
    await this.emit({
      eventType: 'purchase_order.completed',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        purchaseOrderId: params.purchaseOrderId,
        jobId: params.jobId,
      },
    });
  }

  async emitDocumentUploaded(params: {
    documentId: string;
    jobId: string;
    tenantId: string;
    documentType: string;
    uploadedAt: string;
  }): Promise<void> {
    await this.emit({
      eventType: 'document.uploaded',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        documentId: params.documentId,
        jobId: params.jobId,
        documentType: params.documentType,
        uploadedAt: params.uploadedAt,
      },
    });
  }

  async emitJobCreated(params: {
    jobId: string;
    tenantId: string;
    jobType: string;
    claimId?: string;
    parentJobId?: string;
  }): Promise<void> {
    await this.emit({
      eventType: 'job.created',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        jobId: params.jobId,
        jobType: params.jobType,
        claimId: params.claimId,
        parentJobId: params.parentJobId,
      },
    });
  }
}
