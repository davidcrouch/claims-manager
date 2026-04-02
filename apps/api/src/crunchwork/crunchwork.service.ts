import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CrunchworkAuthService } from './crunchwork-auth.service';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export interface CrunchworkRequestParams {
  connectionId: string;
}

export interface GetClaimParams extends CrunchworkRequestParams {
  claimId: string;
}

export interface CreateClaimParams extends CrunchworkRequestParams {
  body: Record<string, unknown>;
}

export interface UpdateClaimParams extends CrunchworkRequestParams {
  claimId: string;
  body: Record<string, unknown>;
}

export interface ListJobsParams extends CrunchworkRequestParams {
  params?: Record<string, string>;
}

export interface GetJobParams extends CrunchworkRequestParams {
  jobId: string;
}

export interface CreateJobParams extends CrunchworkRequestParams {
  body: Record<string, unknown>;
}

export interface UpdateJobParams extends CrunchworkRequestParams {
  jobId: string;
  body: Record<string, unknown>;
}

@Injectable()
export class CrunchworkService {
  private readonly logger = new Logger('CrunchworkService');
  private readonly maxRetries = 3;
  private connectionResolver: { getCredentials(p: { connectionId: string }): Promise<{ clientId: string; clientSecret: string; authUrl: string; baseUrl: string; activeTenantId: string }> } | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: CrunchworkAuthService,
  ) {}

  setConnectionResolver(resolver: { getCredentials(p: { connectionId: string }): Promise<{ clientId: string; clientSecret: string; authUrl: string; baseUrl: string; activeTenantId: string }> }): void {
    this.connectionResolver = resolver;
  }

  private async request<T>(options: {
    method: 'GET' | 'POST';
    path: string;
    connectionId: string;
    body?: unknown;
    params?: Record<string, string>;
  }): Promise<T> {
    if (!this.connectionResolver) {
      throw new Error(
        'CrunchworkService.request — connectionResolver not set. Call setConnectionResolver() during module init.',
      );
    }

    const creds = await this.connectionResolver.getCredentials({
      connectionId: options.connectionId,
    });
    const token = await this.authService.getAccessToken({
      connectionId: options.connectionId,
      credentials: {
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        authUrl: creds.authUrl,
      },
    });

    const url = `${creds.baseUrl}${options.path}`;
    this.logger.debug(`CrunchworkService.request — ${options.method} ${url}`);

    const response = await firstValueFrom(
      this.httpService.request({
        method: options.method,
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'active-tenant-id': creds.activeTenantId,
          'Content-Type': 'application/json',
        },
        data: options.body,
        params: options.params,
      }),
    );

    return response.data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async requestWithRetry<T>(options: {
    method: 'GET' | 'POST';
    path: string;
    connectionId: string;
    body?: unknown;
    params?: Record<string, string>;
  }): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.request<T>(options);
      } catch (error: unknown) {
        lastError = error as Error;
        const status = (error as { response?: { status?: number } })?.response?.status;
        const headers = (error as { response?: { headers?: Record<string, string> } })?.response?.headers;

        if (status === 401 && attempt === 0) {
          this.authService.invalidateToken({ connectionId: options.connectionId });
          continue;
        }
        if (status === 429) {
          const retryAfter = parseInt(headers?.['retry-after'] || '5', 10);
          this.logger.warn(
            `CrunchworkService.requestWithRetry — 429 rate limited, retrying after ${retryAfter}s`,
          );
          await this.sleep(retryAfter * 1000);
          continue;
        }
        if (status && status >= 500) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `CrunchworkService.requestWithRetry — ${status}, retrying in ${delay}ms`,
          );
          await this.sleep(delay);
          continue;
        }

        if (status === 400) {
          throw new BadRequestException(
            (error as { response?: { data?: unknown } })?.response?.data,
          );
        }
        if (status === 401) {
          throw new UnauthorizedException('Crunchwork API authentication failed');
        }
        if (status === 404) {
          throw new NotFoundException('Resource not found');
        }
        throw error;
      }
    }
    throw lastError || new InternalServerErrorException();
  }

  private static readonly ENTITY_FETCH_MAP: Record<string, { method: string; idParam: string }> = {
    job: { method: 'getJob', idParam: 'jobId' },
    claim: { method: 'getClaim', idParam: 'claimId' },
    purchase_order: { method: 'getPurchaseOrder', idParam: 'purchaseOrderId' },
    invoice: { method: 'getInvoice', idParam: 'invoiceId' },
    task: { method: 'getTask', idParam: 'taskId' },
    message: { method: 'getMessage', idParam: 'messageId' },
    attachment: { method: 'getAttachment', idParam: 'attachmentId' },
    report: { method: 'getReport', idParam: 'reportId' },
    quote: { method: 'getQuote', idParam: 'quoteId' },
    appointment: { method: 'getAppointment', idParam: 'appointmentId' },
  };

  private static readonly ATTACHMENT_SCOPE_PREFIXES = [
    'Job', 'Claim', 'PurchaseOrder', 'Quote', 'Report',
    'Invoice', 'Tender', 'Contact', 'Vendor',
  ];

  async fetchEntityByType(params: {
    connectionId: string;
    entityType: string;
    entityId: string;
  }): Promise<Record<string, unknown>> {
    const entry = CrunchworkService.ENTITY_FETCH_MAP[params.entityType];
    if (!entry) {
      throw new BadRequestException(
        `CrunchworkService.fetchEntityByType — unknown entity type: ${params.entityType}`,
      );
    }

    if (params.entityType === 'attachment') {
      return this.fetchAttachmentWithScopedId({
        connectionId: params.connectionId,
        attachmentId: params.entityId,
      });
    }

    return (this as unknown as Record<string, Function>)[entry.method]({
      connectionId: params.connectionId,
      [entry.idParam]: params.entityId,
    }) as Promise<Record<string, unknown>>;
  }

  private async fetchAttachmentWithScopedId(params: {
    connectionId: string;
    attachmentId: string;
  }): Promise<Record<string, unknown>> {
    const errors: string[] = [];

    for (const prefix of CrunchworkService.ATTACHMENT_SCOPE_PREFIXES) {
      const scopedId = `${prefix}-${params.attachmentId}`;
      try {
        this.logger.debug(
          `CrunchworkService.fetchAttachmentWithScopedId — trying scopedId=${scopedId}`,
        );
        return await this.getAttachment({
          connectionId: params.connectionId,
          attachmentId: scopedId,
        });
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 404 || status === 400) {
          errors.push(`${prefix}: ${status}`);
          continue;
        }
        throw error;
      }
    }

    throw new NotFoundException(
      `CrunchworkService.fetchAttachmentWithScopedId — attachment ${params.attachmentId} not found with any relatedRecordType prefix (tried: ${errors.join(', ')})`,
    );
  }

  async createClaim(params: CreateClaimParams): Promise<Record<string, unknown>> {
    return this.requestWithRetry({
      method: 'POST',
      path: '/claims',
      connectionId: params.connectionId,
      body: params.body,
    });
  }

  async updateClaim(params: UpdateClaimParams): Promise<Record<string, unknown>> {
    return this.requestWithRetry({
      method: 'POST',
      path: `/claims/${params.claimId}`,
      connectionId: params.connectionId,
      body: params.body,
    });
  }

  async getClaim(params: GetClaimParams): Promise<Record<string, unknown>> {
    return this.requestWithRetry({
      method: 'GET',
      path: `/claims/${params.claimId}`,
      connectionId: params.connectionId,
    });
  }

  async queryClaimByNumber(params: {
    connectionId: string;
    claimNumber: string;
  }): Promise<Record<string, unknown>[]> {
    const result = await this.requestWithRetry<Record<string, unknown>[]>({
      method: 'GET',
      path: '/claims',
      connectionId: params.connectionId,
      params: { claimNumber: params.claimNumber },
    });
    return Array.isArray(result) ? result : [result];
  }

  async queryClaimByExtRef(params: {
    connectionId: string;
    externalReference: string;
  }): Promise<Record<string, unknown>[]> {
    const result = await this.requestWithRetry<Record<string, unknown>[]>({
      method: 'GET',
      path: '/claims',
      connectionId: params.connectionId,
      params: { externalReference: params.externalReference },
    });
    return Array.isArray(result) ? result : [result];
  }

  async listJobs(params: ListJobsParams): Promise<Record<string, unknown>[]> {
    const result = await this.requestWithRetry<Record<string, unknown>[]>({
      method: 'GET',
      path: '/jobs',
      connectionId: params.connectionId,
      params: params.params,
    });
    return Array.isArray(result) ? result : [result];
  }

  async createJob(params: CreateJobParams): Promise<Record<string, unknown>> {
    return this.requestWithRetry({
      method: 'POST',
      path: '/jobs',
      connectionId: params.connectionId,
      body: params.body,
    });
  }

  async getJob(params: GetJobParams): Promise<Record<string, unknown>> {
    return this.requestWithRetry({
      method: 'GET',
      path: `/jobs/${params.jobId}`,
      connectionId: params.connectionId,
    });
  }

  async updateJob(params: UpdateJobParams): Promise<Record<string, unknown>> {
    return this.requestWithRetry({
      method: 'POST',
      path: `/jobs/${params.jobId}`,
      connectionId: params.connectionId,
      body: params.body,
    });
  }

  async createQuote(params: { connectionId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: '/quotes', connectionId: params.connectionId, body: params.body });
  }

  async updateQuote(params: { connectionId: string; quoteId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: `/quotes/${params.quoteId}`, connectionId: params.connectionId, body: params.body });
  }

  async getQuote(params: { connectionId: string; quoteId: string }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'GET', path: `/quotes/${params.quoteId}`, connectionId: params.connectionId });
  }

  async getJobQuotes(params: { connectionId: string; jobId: string }): Promise<Record<string, unknown>[]> {
    const result = await this.requestWithRetry<Record<string, unknown>[]>({ method: 'GET', path: `/jobs/${params.jobId}/quotes`, connectionId: params.connectionId });
    return Array.isArray(result) ? result : [result];
  }

  async getPurchaseOrder(params: { connectionId: string; purchaseOrderId: string }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'GET', path: `/purchase-orders/${params.purchaseOrderId}`, connectionId: params.connectionId });
  }

  async updatePurchaseOrder(params: { connectionId: string; purchaseOrderId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: `/purchase-orders/${params.purchaseOrderId}`, connectionId: params.connectionId, body: params.body });
  }

  async getJobPurchaseOrders(params: { connectionId: string; jobId: string }): Promise<Record<string, unknown>[]> {
    const result = await this.requestWithRetry<Record<string, unknown>[]>({ method: 'GET', path: `/jobs/${params.jobId}/purchase-orders`, connectionId: params.connectionId });
    return Array.isArray(result) ? result : [result];
  }

  async createInvoice(params: { connectionId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: '/invoices', connectionId: params.connectionId, body: params.body });
  }

  async getInvoice(params: { connectionId: string; invoiceId: string }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'GET', path: `/invoices/${params.invoiceId}`, connectionId: params.connectionId });
  }

  async updateInvoice(params: { connectionId: string; invoiceId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: `/invoices/${params.invoiceId}`, connectionId: params.connectionId, body: params.body });
  }

  async getJobInvoices(params: { connectionId: string; jobId: string }): Promise<Record<string, unknown>[]> {
    const result = await this.requestWithRetry<Record<string, unknown>[]>({ method: 'GET', path: `/jobs/${params.jobId}/invoices`, connectionId: params.connectionId });
    return Array.isArray(result) ? result : [result];
  }

  async createMessage(params: { connectionId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: '/messages', connectionId: params.connectionId, body: params.body });
  }

  async getMessage(params: { connectionId: string; messageId: string }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'GET', path: `/messages/${params.messageId}`, connectionId: params.connectionId });
  }

  async acknowledgeMessage(params: { connectionId: string; messageId: string }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: `/messages/${params.messageId}/acknowledge`, connectionId: params.connectionId });
  }

  async createTask(params: { connectionId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: '/tasks', connectionId: params.connectionId, body: params.body });
  }

  async getTask(params: { connectionId: string; taskId: string }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'GET', path: `/tasks/${params.taskId}`, connectionId: params.connectionId });
  }

  async updateTask(params: { connectionId: string; taskId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: `/tasks/${params.taskId}`, connectionId: params.connectionId, body: params.body });
  }

  async getJobTasks(params: { connectionId: string; jobId: string }): Promise<Record<string, unknown>[]> {
    const result = await this.requestWithRetry<Record<string, unknown>[]>({ method: 'GET', path: `/jobs/${params.jobId}/tasks`, connectionId: params.connectionId });
    return Array.isArray(result) ? result : [result];
  }

  async createAppointment(params: { connectionId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: '/appointments', connectionId: params.connectionId, body: params.body });
  }

  async getAppointment(params: { connectionId: string; appointmentId: string }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'GET', path: `/appointments/${params.appointmentId}`, connectionId: params.connectionId });
  }

  async updateAppointment(params: { connectionId: string; appointmentId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: `/appointments/${params.appointmentId}`, connectionId: params.connectionId, body: params.body });
  }

  async cancelAppointment(params: { connectionId: string; appointmentId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: `/appointments/${params.appointmentId}/cancel`, connectionId: params.connectionId, body: params.body });
  }

  async createReport(params: { connectionId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: '/reports', connectionId: params.connectionId, body: params.body });
  }

  async getReport(params: { connectionId: string; reportId: string }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'GET', path: `/reports/${params.reportId}`, connectionId: params.connectionId });
  }

  async updateReport(params: { connectionId: string; reportId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: `/reports/${params.reportId}`, connectionId: params.connectionId, body: params.body });
  }

  async createAttachment(params: { connectionId: string; body: Record<string, unknown>; formData?: FormData }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: '/attachments', connectionId: params.connectionId, body: params.body });
  }

  async getAttachment(params: { connectionId: string; attachmentId: string }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'GET', path: `/attachments/${params.attachmentId}`, connectionId: params.connectionId });
  }

  async updateAttachment(params: { connectionId: string; attachmentId: string; body: Record<string, unknown> }): Promise<Record<string, unknown>> {
    return this.requestWithRetry({ method: 'POST', path: `/attachments/${params.attachmentId}`, connectionId: params.connectionId, body: params.body });
  }

  async getVendorAllocation(params: {
    connectionId: string;
    jobType: string;
    account: string;
    postcode: string;
    lossType?: string;
    totalLoss?: boolean;
  }): Promise<Record<string, unknown>[]> {
    const paramsObj: Record<string, string> = {
      jobType: params.jobType,
      account: params.account,
      postcode: params.postcode,
    };
    if (params.lossType) paramsObj.lossType = params.lossType;
    if (params.totalLoss !== undefined) paramsObj.totalLoss = String(params.totalLoss);

    const result = await this.requestWithRetry<Record<string, unknown>[]>({
      method: 'GET',
      path: '/vendors/allocation',
      connectionId: params.connectionId,
      params: paramsObj,
    });
    return Array.isArray(result) ? result : [result];
  }
}
