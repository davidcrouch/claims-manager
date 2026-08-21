import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { CredentialsCipher } from '../../common/credentials-cipher';

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

/**
 * Dispatches domain events to the more0-ensure capability server.
 *
 * Resolves a `more0-ensure` integration connection for the tenant, obtains an
 * OAuth2 access token via client_credentials, and POSTs the event to the
 * webhook URL stored on the connection.
 */
@Injectable()
export class OutboundEventsService {
  private readonly logger = new Logger('OutboundEvents');
  private readonly tokenCache = new Map<string, TokenCacheEntry>();
  private readonly audience: string;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly cipher?: CredentialsCipher,
  ) {
    this.audience = this.config.get<string>('AUTH_AUDIENCE', 'http://more0.ai');
  }

  /**
   * Fire an event to the more0-ensure webhook endpoint for the given tenant.
   * Non-blocking — errors are logged but do not propagate.
   */
  async emit(event: {
    eventType: string;
    entityType: string;
    entityId: string;
    tenantId: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const resolved = await this.resolveEndpoint(event.tenantId);
    if (!resolved) return;

    const body = {
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
      payload: event.payload ?? {},
    };

    const url = `${resolved.webhookUrl}/claims-manager`;

    this.logger.debug(
      `OutboundEvents.emit — ${event.eventType} ${event.entityType}:${event.entityId}`,
    );

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (resolved.accessToken) {
        headers['Authorization'] = `Bearer ${resolved.accessToken}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
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

  // ── Workflow invocation ─────────────────────────────────────────

  /**
   * Invoke a workflow on the more0-ensure server for the given tenant.
   * Uses the same connection resolution as event dispatch, but POSTs to
   * the /api/v1/invoke endpoint instead of the webhook endpoint.
   */
  async invokeWorkflow(params: {
    cap: string;
    method?: string;
    tenantId: string;
    workflowParams: Record<string, unknown>;
  }): Promise<void> {
    const resolved = await this.resolveEndpoint(params.tenantId);
    if (!resolved) return;

    const invokeUrl = resolved.webhookUrl.replace(/\/webhooks$/, '/invoke');

    const body = {
      cap: params.cap,
      method: params.method ?? 'start',
      params: {
        ...params.workflowParams,
        tenantId: params.tenantId,
      },
    };

    this.logger.log(
      `OutboundEvents.invokeWorkflow — cap=${params.cap} entity=${params.workflowParams.entityId ?? params.workflowParams.jobId}`,
    );

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (resolved.accessToken) {
        headers['Authorization'] = `Bearer ${resolved.accessToken}`;
      }

      const response = await fetch(invokeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        this.logger.warn(
          `OutboundEvents.invokeWorkflow — HTTP ${response.status} for cap=${params.cap}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `OutboundEvents.invokeWorkflow — failed: ${(err as Error).message}`,
      );
    }
  }

  // ── Connection resolution + token acquisition ─────────────────

  private async resolveEndpoint(
    tenantId: string,
  ): Promise<{ webhookUrl: string; accessToken: string | null } | null> {
    if (!this.connectionResolver) {
      this.logger.debug('OutboundEvents.resolveEndpoint — no connectionResolver');
      return null;
    }

    const connection = await this.connectionResolver.resolveForTenant({
      tenantId,
      providerCode: 'more0-ensure',
    });

    if (!connection || !connection.isActive) {
      return null;
    }

    const config = (connection.config ?? {}) as Record<string, unknown>;
    const webhookUrl = (config.webhookUrl as string) ?? `${connection.baseUrl}/api/v1/webhooks`;

    let accessToken: string | null = null;
    try {
      const rawCredentials = connection.credentials as Record<string, unknown> | string;
      const decrypted =
        typeof rawCredentials === 'string' && this.cipher
          ? this.cipher.decryptJson(rawCredentials)
          : (rawCredentials as Record<string, unknown>);

      const clientId = decrypted?.clientId as string | undefined;
      const clientSecret = decrypted?.clientSecret as string | undefined;
      const authUrl = connection.authUrl;

      if (clientId && clientSecret && authUrl) {
        accessToken = await this.acquireOidcToken({
          connectionId: connection.id,
          clientId,
          clientSecret,
          authUrl,
        });
      }
    } catch (err) {
      this.logger.warn(
        `OutboundEvents.resolveEndpoint — token acquisition failed: ${(err as Error).message}`,
      );
    }

    return { webhookUrl, accessToken };
  }

  private async acquireOidcToken(params: {
    connectionId: string;
    clientId: string;
    clientSecret: string;
    authUrl: string;
  }): Promise<string> {
    const cached = this.tokenCache.get(params.connectionId);
    if (cached && Date.now() < cached.expiresAt - 60_000) {
      return cached.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      resource: this.audience,
    });

    const response = await fetch(params.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`OIDC token exchange failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    const entry: TokenCacheEntry = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    this.tokenCache.set(params.connectionId, entry);

    this.logger.debug(
      `OutboundEvents.acquireOidcToken — token acquired for connection=${params.connectionId}`,
    );

    return entry.accessToken;
  }

  // ── Convenience methods for common events ──────────────────────

  async emitTaskCreated(params: {
    taskId: string;
    taskName: string;
    jobId: string;
    tenantId: string;
    originType?: string;
  }): Promise<void> {
    await this.emit({
      eventType: 'task.created',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        taskId: params.taskId,
        taskName: params.taskName,
        jobId: params.jobId,
        originType: params.originType,
      },
    });
  }

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

  async emitInvoiceApproved(params: {
    invoiceId: string;
    jobId: string;
    tenantId: string;
    purchaseOrderId?: string;
    approvedAt?: string;
  }): Promise<void> {
    await this.emit({
      eventType: 'invoice.approved',
      entityType: 'job',
      entityId: params.jobId,
      tenantId: params.tenantId,
      payload: {
        invoiceId: params.invoiceId,
        jobId: params.jobId,
        purchaseOrderId: params.purchaseOrderId,
        approvedAt: params.approvedAt ?? new Date().toISOString(),
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
