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
  Report,
  Task,
  Message,
  Vendor,
  Appointment,
  DashboardStats,
  RecentActivity,
  PaginatedResponse,
} from '@/types/api';

export interface ApiClientOptions {
  token?: string;
  tenantId?: string;
}

class ApiError extends Error {
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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
