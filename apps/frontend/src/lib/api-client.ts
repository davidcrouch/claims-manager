/**
 * Centralized API client for server and client usage.
 * Base URL from getApiBaseUrl(); auth via Bearer token and x-tenant-id.
 */

import { getApiBaseUrl } from './env';
import type {
  Claim,
  Job,
  Quote,
  PurchaseOrder,
  Invoice,
  WorkOrder,
  Rfq,
  Proposal,
  Bill,
  Report,
  Task,
  Message,
  Vendor,
  Appointment,
  Attachment,
  DashboardStats,
  RecentActivity,
  PaginatedResponse,
  FinanceSummary,
  AgingBucket,
  CatalogItem,
  CatalogItemType,
  CatalogCategory,
  ProviderSummary,
  Provider,
  ProviderConnection,
  ConnectionSummary,
  ConnectionDetail,
  WebhookEvent,
  CreateConnectionPayload,
  UpdateConnectionPayload,
} from '@/types/api';

export interface ApiClientOptions {
  token?: string;
  tenantId?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function buildHeaders(options?: ApiClientOptions): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options?.tenantId) {
    headers['x-tenant-id'] = options.tenantId;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }

  if (res.status === 401) {
    console.warn('[api-client.handleResponse] 401 Unauthorized - redirect to login');
    if (typeof window !== 'undefined') {
      window.location.href = '/api/auth/login';
    }
    throw new ApiError('Unauthorized', 401, body);
  }

  if (res.status === 403) {
    throw new ApiError('Forbidden', 403, body);
  }

  if (res.status === 404) {
    throw new ApiError('Not found', 404, body);
  }

  if (res.status >= 500) {
    throw new ApiError(`Server error: ${res.status}`, res.status, body);
  }

  throw new ApiError(
    (body as { message?: string })?.message ?? `Request failed: ${res.status}`,
    res.status,
    body
  );
}

export function createApiClient(options?: ApiClientOptions) {
  const baseUrl = getApiBaseUrl();
  const headers = buildHeaders(options);

  async function fetchApi<T>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
      ...init,
      headers: { ...headers, ...(init?.headers ?? {}) },
    });
    return handleResponse<T>(res);
  }

  return {
    getClaims(params: {
      page?: number;
      limit?: number;
      search?: string;
      sort?: string;
      status?: string;
    }): Promise<PaginatedResponse<Claim>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.search) sp.set('search', params.search);
      if (params.sort) sp.set('sort', params.sort);
      if (params.status) sp.set('status', params.status);
      return fetchApi<PaginatedResponse<Claim>>(`/claims?${sp}`);
    },

    getClaim(id: string): Promise<Claim | null> {
      return fetchApi<Claim | null>(`/claims/${id}`);
    },

    getJobs(params: {
      page?: number;
      limit?: number;
      search?: string;
      claimId?: string;
      sort?: string;
      status?: string;
      jobType?: string;
    }): Promise<PaginatedResponse<Job>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.search) sp.set('search', params.search ?? '');
      if (params.claimId) sp.set('claimId', params.claimId);
      if (params.sort) sp.set('sort', params.sort);
      if (params.status) sp.set('status', params.status ?? '');
      if (params.jobType) sp.set('jobType', params.jobType);
      return fetchApi<PaginatedResponse<Job>>(`/jobs?${sp}`);
    },

    getJob(id: string): Promise<Job | null> {
      return fetchApi<Job | null>(`/jobs/${id}`);
    },

    getJobQuotes(jobId: string): Promise<Quote[]> {
      return fetchApi<Quote[]>(`/quotes/job/${jobId}`);
    },

    getJobPurchaseOrders(jobId: string): Promise<PurchaseOrder[]> {
      return fetchApi<PurchaseOrder[]>(`/purchase-orders/job/${jobId}`);
    },

    getJobTasks(jobId: string): Promise<Task[]> {
      return fetchApi<Task[]>(`/tasks/job/${jobId}`);
    },

    getJobMessages(jobId: string): Promise<PaginatedResponse<Message>> {
      return fetchApi<PaginatedResponse<Message>>(`/messages?jobId=${jobId}&limit=100`);
    },

    getJobReports(jobId: string): Promise<Report[]> {
      return fetchApi<Report[]>(`/reports/job/${jobId}`);
    },

    getJobAppointments(jobId: string): Promise<Appointment[]> {
      return fetchApi<Appointment[]>(`/appointments/job/${jobId}`);
    },

    getJobInvoices(jobId: string): Promise<Invoice[]> {
      return fetchApi<Invoice[]>(`/invoices/job/${jobId}`);
    },

    getJobAttachments(jobId: string): Promise<Attachment[]> {
      const sp = new URLSearchParams({
        relatedRecordType: 'Job',
        relatedRecordId: jobId,
      });
      return fetchApi<Attachment[]>(`/attachments?${sp}`);
    },

    getQuotes(params: {
      page?: number;
      limit?: number;
      jobId?: string;
      statusId?: string;
    }): Promise<PaginatedResponse<Quote>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.jobId) sp.set('jobId', params.jobId);
      if (params.statusId) sp.set('statusId', params.statusId);
      return fetchApi<PaginatedResponse<Quote>>(`/quotes?${sp}`);
    },

    getQuote(id: string): Promise<Quote | null> {
      return fetchApi<Quote | null>(`/quotes/${id}`);
    },

    getPurchaseOrders(params: {
      page?: number;
      limit?: number;
      jobId?: string;
      vendorId?: string;
    }): Promise<PaginatedResponse<PurchaseOrder>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.jobId) sp.set('jobId', params.jobId);
      if (params.vendorId) sp.set('vendorId', params.vendorId);
      return fetchApi<PaginatedResponse<PurchaseOrder>>(`/purchase-orders?${sp}`);
    },

    getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
      return fetchApi<PurchaseOrder | null>(`/purchase-orders/${id}`);
    },

    getInvoices(params: {
      page?: number;
      limit?: number;
      purchaseOrderId?: string;
    }): Promise<PaginatedResponse<Invoice>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.purchaseOrderId) sp.set('purchaseOrderId', params.purchaseOrderId);
      return fetchApi<PaginatedResponse<Invoice>>(`/invoices?${sp}`);
    },

    getInvoice(id: string): Promise<Invoice | null> {
      return fetchApi<Invoice | null>(`/invoices/${id}`);
    },

    getReports(params: {
      page?: number;
      limit?: number;
      jobId?: string;
      claimId?: string;
    }): Promise<PaginatedResponse<Report>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.jobId) sp.set('jobId', params.jobId);
      if (params.claimId) sp.set('claimId', params.claimId);
      return fetchApi<PaginatedResponse<Report>>(`/reports?${sp}`);
    },

    getReport(id: string): Promise<Report | null> {
      return fetchApi<Report | null>(`/reports/${id}`);
    },

    getDashboardStats(): Promise<DashboardStats> {
      return fetchApi<DashboardStats>('/dashboard/stats');
    },

    getDashboardRecentActivity(limit?: number): Promise<RecentActivity[]> {
      const sp = limit != null ? `?limit=${limit}` : '';
      return fetchApi<RecentActivity[]>(`/dashboard/recent-activity${sp}`);
    },

    getVendors(): Promise<PaginatedResponse<Vendor>> {
      return fetchApi<PaginatedResponse<Vendor>>('/vendors');
    },

    getVendor(id: string): Promise<Vendor | null> {
      return fetchApi<Vendor | null>(`/vendors/${id}`);
    },

    getVendorsAllocation(): Promise<unknown> {
      return fetchApi<unknown>('/vendors/allocation');
    },

    getLookups(): Promise<unknown> {
      return fetchApi<unknown>('/lookups');
    },

    getLookupsByDomain(domain: string): Promise<{ id: string; name?: string }[]> {
      return fetchApi<{ id: string; name?: string }[]>(`/lookups?domain=${encodeURIComponent(domain)}`);
    },

    createJob(body: Record<string, unknown>): Promise<Job> {
      return fetchApi<Job>('/jobs', { method: 'POST', body: JSON.stringify(body) });
    },

    createQuote(body: Record<string, unknown>): Promise<Quote> {
      return fetchApi<Quote>('/quotes', { method: 'POST', body: JSON.stringify(body) });
    },

    createInvoice(body: Record<string, unknown>): Promise<Invoice> {
      return fetchApi<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(body) });
    },

    createMessage(body: Record<string, unknown>): Promise<Message> {
      return fetchApi<Message>('/messages', { method: 'POST', body: JSON.stringify(body) });
    },

    acknowledgeMessage(id: string): Promise<unknown> {
      return fetchApi<unknown>(`/messages/${id}/acknowledge`, { method: 'POST' });
    },

    createReport(body: Record<string, unknown>): Promise<Report> {
      return fetchApi<Report>('/reports', { method: 'POST', body: JSON.stringify(body) });
    },

    createTask(body: Record<string, unknown>): Promise<Task> {
      return fetchApi<Task>('/tasks', { method: 'POST', body: JSON.stringify(body) });
    },

    createAppointment(body: Record<string, unknown>): Promise<unknown> {
      return fetchApi<unknown>('/appointments', { method: 'POST', body: JSON.stringify(body) });
    },

    updateAppointment(id: string, body: Record<string, unknown>): Promise<unknown> {
      return fetchApi<unknown>(`/appointments/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    cancelAppointment(id: string, body?: { reason?: string }): Promise<unknown> {
      return fetchApi<unknown>(`/appointments/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
    },

    // Work Orders
    getWorkOrders(params?: {
      page?: number;
      limit?: number;
      jobId?: string;
      purchaseOrderId?: string;
    }): Promise<PaginatedResponse<WorkOrder>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.purchaseOrderId) sp.set('purchaseOrderId', params.purchaseOrderId);
      return fetchApi<PaginatedResponse<WorkOrder>>(`/work-orders?${sp}`);
    },

    getWorkOrder(id: string): Promise<WorkOrder | null> {
      return fetchApi<WorkOrder | null>(`/work-orders/${id}`);
    },

    getJobWorkOrders(jobId: string): Promise<WorkOrder[]> {
      return fetchApi<WorkOrder[]>(`/work-orders/job/${jobId}`);
    },

    createWorkOrder(body: Record<string, unknown>): Promise<WorkOrder> {
      return fetchApi<WorkOrder>('/work-orders', { method: 'POST', body: JSON.stringify(body) });
    },

    updateWorkOrder(id: string, body: Record<string, unknown>): Promise<WorkOrder> {
      return fetchApi<WorkOrder>(`/work-orders/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    // RFQs
    getRfqs(params?: {
      page?: number;
      limit?: number;
      jobId?: string;
      quoteId?: string;
      vendorId?: string;
    }): Promise<PaginatedResponse<Rfq>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.quoteId) sp.set('quoteId', params.quoteId);
      if (params?.vendorId) sp.set('vendorId', params.vendorId);
      return fetchApi<PaginatedResponse<Rfq>>(`/rfqs?${sp}`);
    },

    getRfq(id: string): Promise<Rfq | null> {
      return fetchApi<Rfq | null>(`/rfqs/${id}`);
    },

    getJobRfqs(jobId: string): Promise<Rfq[]> {
      return fetchApi<Rfq[]>(`/rfqs/job/${jobId}`);
    },

    getQuoteRfqs(quoteId: string): Promise<Rfq[]> {
      return fetchApi<Rfq[]>(`/rfqs/quote/${quoteId}`);
    },

    createRfq(body: Record<string, unknown>): Promise<Rfq> {
      return fetchApi<Rfq>('/rfqs', { method: 'POST', body: JSON.stringify(body) });
    },

    updateRfq(id: string, body: Record<string, unknown>): Promise<Rfq> {
      return fetchApi<Rfq>(`/rfqs/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    // Proposals
    getProposals(params?: {
      page?: number;
      limit?: number;
      jobId?: string;
      rfqId?: string;
      vendorId?: string;
    }): Promise<PaginatedResponse<Proposal>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.rfqId) sp.set('rfqId', params.rfqId);
      if (params?.vendorId) sp.set('vendorId', params.vendorId);
      return fetchApi<PaginatedResponse<Proposal>>(`/proposals?${sp}`);
    },

    getProposal(id: string): Promise<Proposal | null> {
      return fetchApi<Proposal | null>(`/proposals/${id}`);
    },

    getJobProposals(jobId: string): Promise<Proposal[]> {
      return fetchApi<Proposal[]>(`/proposals/job/${jobId}`);
    },

    getRfqProposals(rfqId: string): Promise<Proposal[]> {
      return fetchApi<Proposal[]>(`/proposals/rfq/${rfqId}`);
    },

    createProposal(body: Record<string, unknown>): Promise<Proposal> {
      return fetchApi<Proposal>('/proposals', { method: 'POST', body: JSON.stringify(body) });
    },

    updateProposal(id: string, body: Record<string, unknown>): Promise<Proposal> {
      return fetchApi<Proposal>(`/proposals/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    // Bills
    getBills(params?: {
      page?: number;
      limit?: number;
      jobId?: string;
      purchaseOrderId?: string;
      vendorId?: string;
      invoiceId?: string;
    }): Promise<PaginatedResponse<Bill>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.purchaseOrderId) sp.set('purchaseOrderId', params.purchaseOrderId);
      if (params?.vendorId) sp.set('vendorId', params.vendorId);
      if (params?.invoiceId) sp.set('invoiceId', params.invoiceId);
      return fetchApi<PaginatedResponse<Bill>>(`/bills?${sp}`);
    },

    getBill(id: string): Promise<Bill | null> {
      return fetchApi<Bill | null>(`/bills/${id}`);
    },

    getJobBills(jobId: string): Promise<Bill[]> {
      return fetchApi<Bill[]>(`/bills/job/${jobId}`);
    },

    getPurchaseOrderBills(poId: string): Promise<Bill[]> {
      return fetchApi<Bill[]>(`/bills/purchase-order/${poId}`);
    },

    createBill(body: Record<string, unknown>): Promise<Bill> {
      return fetchApi<Bill>('/bills', { method: 'POST', body: JSON.stringify(body) });
    },

    updateBill(id: string, body: Record<string, unknown>): Promise<Bill> {
      return fetchApi<Bill>(`/bills/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    // Finance
    getFinanceAr(): Promise<{ buckets: AgingBucket[]; totalOutstanding: number; totalOverdue: number; totalPaid: number }> {
      return fetchApi('/finance/ar');
    },

    getFinanceAp(): Promise<{ buckets: AgingBucket[]; totalOutstanding: number; totalOverdue: number; totalPaid: number }> {
      return fetchApi('/finance/ap');
    },

    getFinanceSummary(): Promise<FinanceSummary> {
      return fetchApi<FinanceSummary>('/finance/summary');
    },

    getProviders(): Promise<ProviderSummary[]> {
      return fetchApi<ProviderSummary[]>('/providers');
    },

    getProvider(code: string): Promise<Provider> {
      return fetchApi<Provider>(`/providers/${code}`);
    },

    getProviderConnections(code: string): Promise<ProviderConnection[]> {
      return fetchApi<ProviderConnection[]>(`/providers/${code}/connections`);
    },

    createProviderConnection(code: string, body: CreateConnectionPayload): Promise<ProviderConnection> {
      return fetchApi<ProviderConnection>(`/providers/${code}/connections`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    updateProviderConnection(code: string, connId: string, body: UpdateConnectionPayload): Promise<ProviderConnection> {
      return fetchApi<ProviderConnection>(`/providers/${code}/connections/${connId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },

    getProviderWebhookEvents(code: string, params?: {
      page?: number;
      limit?: number;
      status?: string;
    }): Promise<PaginatedResponse<WebhookEvent>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.status) sp.set('status', params.status);
      return fetchApi<PaginatedResponse<WebhookEvent>>(`/providers/${code}/webhook-events?${sp}`);
    },

    getConnections(): Promise<ConnectionSummary[]> {
      return fetchApi<ConnectionSummary[]>('/connections');
    },

    getConnection(id: string): Promise<ConnectionDetail> {
      return fetchApi<ConnectionDetail>(`/connections/${id}`);
    },

    updateConnection(id: string, body: UpdateConnectionPayload): Promise<ProviderConnection> {
      return fetchApi<ProviderConnection>(`/connections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },

    getConnectionWebhookEvents(id: string, params?: {
      page?: number;
      limit?: number;
      status?: string;
    }): Promise<PaginatedResponse<WebhookEvent>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.status) sp.set('status', params.status);
      return fetchApi<PaginatedResponse<WebhookEvent>>(`/connections/${id}/webhook-events?${sp}`);
    },

    getCatalogTypes(): Promise<CatalogItemType[]> {
      return fetchApi<CatalogItemType[]>('/catalog/types');
    },

    getCatalogCategoriesTree(): Promise<CatalogCategory[]> {
      return fetchApi<CatalogCategory[]>('/catalog/categories/tree');
    },

    getCatalogItems(params?: {
      kind?: 'primitive' | 'assembly';
      typeId?: string;
      categoryId?: string;
      q?: string;
      page?: number;
      limit?: number;
    }): Promise<PaginatedResponse<CatalogItem>> {
      const sp = new URLSearchParams();
      if (params?.kind) sp.set('kind', params.kind);
      if (params?.typeId) sp.set('typeId', params.typeId);
      if (params?.categoryId) sp.set('categoryId', params.categoryId);
      if (params?.q) sp.set('q', params.q);
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      return fetchApi<PaginatedResponse<CatalogItem>>(`/catalog/items?${sp}`);
    },

    getCatalogItem(id: string): Promise<CatalogItem> {
      return fetchApi<CatalogItem>(`/catalog/items/${id}`);
    },

    createCatalogItem(body: Record<string, unknown>): Promise<CatalogItem> {
      return fetchApi<CatalogItem>('/catalog/items', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    updateCatalogItem(id: string, body: Record<string, unknown>): Promise<CatalogItem> {
      return fetchApi<CatalogItem>(`/catalog/items/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    deleteCatalogItem(id: string): Promise<void> {
      return fetchApi<void>(`/catalog/items/${id}`, { method: 'DELETE' });
    },

    replaceCatalogBom(id: string, lines: Record<string, unknown>[]): Promise<unknown> {
      return fetchApi(`/catalog/items/${id}/components`, {
        method: 'PUT',
        body: JSON.stringify({ lines }),
      });
    },

    createCatalogCategory(body: Record<string, unknown>): Promise<CatalogCategory> {
      return fetchApi<CatalogCategory>('/catalog/categories', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    getCatalogImportTemplate(): Promise<{ csv: string; columns: string[] }> {
      return fetchApi<{ csv: string; columns: string[] }>('/catalog/import/template');
    },

    previewCatalogImport(csv: string): Promise<{
      totalRows: number;
      validRows: number;
      warningRows: number;
      errorRows: number;
      skippedRows: number;
      willCreate: number;
      willUpdate: number;
      categoriesToCreate: string[];
      rows: Array<{
        row: number;
        code: string;
        displayName: string;
        lineItemDescription: string | null;
        kind: string;
        typeCode: string;
        categoryCode: string | null;
        unitTypeRef: string | null;
        status: 'ok' | 'warning' | 'error' | 'skipped';
        action: 'create' | 'update' | 'skip';
        message?: string;
      }>;
    }> {
      return fetchApi('/catalog/import/preview', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
    },

    importCatalogCsv(csv: string): Promise<{
      created: number;
      updated: number;
      skipped: number;
      errors: number;
      results: Array<{ row: number; code: string; status: string; message?: string }>;
    }> {
      return fetchApi('/catalog/import/csv', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
    },

    getCatalogUnresolvedReferences(): Promise<unknown[]> {
      return fetchApi<unknown[]>('/catalog/unresolved-references');
    },

    getQuoteCatalogMismatches(quoteId: string): Promise<{
      mismatches: Array<{
        quoteItemId: string;
        catalogCode: string | null;
        property: string;
        snapshotValue: string;
        catalogValue: string;
      }>;
      updatedCount: number;
    }> {
      return fetchApi(`/quotes/${quoteId}/catalog-mismatches`);
    },

    scanQuoteCatalogMismatches(quoteId: string): Promise<{
      mismatches: unknown[];
      updatedCount: number;
    }> {
      return fetchApi(`/quotes/${quoteId}/catalog-mismatches/scan`, { method: 'POST' });
    },

    getQuoteGroups(quoteId: string): Promise<Array<{ id: string; description: string | null }>> {
      return fetchApi(`/quotes/${quoteId}/groups`);
    },

    getQuoteLineItems(quoteId: string): Promise<Array<Record<string, unknown>>> {
      return fetchApi(`/quotes/${quoteId}/line-items`);
    },

    ensureQuoteGroup(quoteId: string): Promise<{ id: string; description: string | null }> {
      return fetchApi(`/quotes/${quoteId}/groups`, { method: 'POST' });
    },

    addCatalogItemToQuote(params: {
      quoteId: string;
      groupId: string;
      catalogItemId: string;
      quantity: string;
      quoteComboId?: string;
    }): Promise<unknown> {
      return fetchApi(`/quotes/${params.quoteId}/groups/${params.groupId}/catalog-items`, {
        method: 'POST',
        body: JSON.stringify({
          catalogItemId: params.catalogItemId,
          quantity: params.quantity,
          quoteComboId: params.quoteComboId,
        }),
      });
    },

    addCatalogAssemblyToQuote(params: {
      quoteId: string;
      groupId: string;
      catalogAssemblyId: string;
      quantity: string;
    }): Promise<unknown> {
      return fetchApi(`/quotes/${params.quoteId}/groups/${params.groupId}/catalog-assemblies`, {
        method: 'POST',
        body: JSON.stringify({
          catalogAssemblyId: params.catalogAssemblyId,
          quantity: params.quantity,
        }),
      });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
