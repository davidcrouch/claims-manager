/**
 * Centralized API client for server and client usage.
 * Base URL from getApiBaseUrl(); auth via Bearer token and x-tenant-id.
 */

import { getApiBaseUrl } from './env';
import {
  fetchCloudRunIdToken,
  resolveApiAudience,
} from './cloud-run-id-token';
import {
  fetchWithTransientRetry,
  isTransientNetworkError,
} from './transient-network';

export { isTransientNetworkError };
import type {
  Claim,
  Job,
  JobRelatedCounts,
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
  Contact,
  ContactRelatedJob,
  DashboardStats,
  DashboardInbox,
  RecentActivity,
  PaginatedResponse,
  LineItemsPageQuery,
  LineItemsPageResponse,
  FinanceSummary,
  AgingBucket,
  Catalog,
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
  AddressPayload,
  Journal,
  JournalPage,
  Assessment,
  OrganisationProfile,
} from '@/types/api';

function lineItemsPageQueryString(query?: LineItemsPageQuery): string {
  const sp = new URLSearchParams();
  if (query?.search) sp.set('search', query.search);
  if (query?.groupIds?.length) sp.set('groupIds', query.groupIds.join(','));
  if (query?.all) sp.set('all', 'true');
  if (query?.page != null) sp.set('page', String(query.page));
  if (query?.limit != null) sp.set('limit', String(query.limit));
  const encoded = sp.toString();
  return encoded ? `?${encoded}` : '';
}

export interface PublishQuoteResult {
  quote: Quote | null;
  publishMode: 'internal' | 'external';
  provider?: {
    confirmed: boolean;
    providerReference?: string;
    sentGroups: number;
    sentItems: number;
    sentCombos: number;
    excludedItems?: number;
    excludedCombos?: number;
    warnings?: string[];
  };
}

export interface EntityActivity {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: 'user' | 'system' | 'provider';
  actorId?: string | null;
  actorName?: string | null;
  summary: string;
  detail: Record<string, unknown>;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  source?: string | null;
  sourceEventId?: string | null;
  createdAt: string;
}

export interface ApiClientOptions {
  token?: string;
  tenantId?: string;
}

export interface CapabilityPackCatalogEntry {
  packId: string;
  version: string;
  name: string;
  description: string;
  source: 'builtin' | 'upload';
  uploadId?: string;
  integrationRefs: string[];
  agentCount: number;
  skillCount: number;
  promptCount: number;
  installed?: {
    installId: string;
    version: string;
    status: string;
  } | null;
}

export interface CapabilityPackInstall {
  id: string;
  packId: string;
  packVersion: string;
  status: string;
  source?: string;
  displayName?: string | null;
  errorMessage?: string | null;
}

export interface CapabilityPackUploadSummary {
  id: string;
  packId: string;
  packVersion: string;
  displayName?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface CapabilityPackDriftItem {
  artefactType: 'agent' | 'skill' | 'prompt_template';
  artefactId: string;
  sourceKey: string | null;
  status: 'match' | 'modified' | 'missing' | 'orphan';
  expectedHash: string | null;
  actualHash: string | null;
}

export interface CapabilityPackPreview {
  packId: string;
  version: string;
  name: string;
  description: string;
  source: 'builtin' | 'upload';
  uploadId?: string;
  integrationRefs: string[];
  agents: Array<{
    slug: string;
    name: string;
    description?: string;
    enabledTools: string[];
    pinnedSkillSlugs: string[];
    integrationRefs: string[];
  }>;
  skills: Array<{
    slug: string;
    name: string;
    description?: string;
    category: string;
    triggerHints: string[];
    requiredTools: string[];
  }>;
  prompts: Array<{
    slug: string;
    name: string;
    description?: string;
    category: string;
  }>;
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
    const serverMsg = (body as { message?: string })?.message ?? `Server error: ${res.status}`;
    throw new ApiError(serverMsg, res.status, body);
  }

  throw new ApiError(
    (body as { message?: string })?.message ?? `Request failed: ${res.status}`,
    res.status,
    body
  );
}

type RawRole = {
  id?: string;
  key?: string;
  roleName?: string;
  name?: string;
  label?: string;
  scope: string;
  description?: string | null;
  sortOrder?: number;
  isSystem?: boolean;
};

function mapRole(raw: unknown): import('@/types/api').RoleDef {
  const rec = (raw ?? {}) as RawRole & { role?: RawRole };
  const r = rec.role ?? rec;
  return {
    id: r.id ?? '',
    key: r.key ?? r.roleName ?? '',
    name: r.name ?? r.label ?? '',
    scope: r.scope ?? '',
    description: r.description ?? null,
    sortOrder: r.sortOrder ?? 0,
    isSystem: Boolean(r.isSystem),
  };
}

function mapRoleList(res: unknown): import('@/types/api').RoleDef[] {
  const rows = Array.isArray(res)
    ? res
    : ((res as { roles?: RawRole[]; data?: RawRole[] }).roles ??
      (res as { data?: RawRole[] }).data ??
      []);
  return rows.map(mapRole);
}

function mapPermissionList(res: unknown): import('@/types/api').PermissionDef[] {
  const rows = Array.isArray(res)
    ? res
    : ((res as { permissions?: import('@/types/api').PermissionDef[]; data?: import('@/types/api').PermissionDef[] })
        .permissions ??
      (res as { data?: import('@/types/api').PermissionDef[] }).data ??
      []);
  return rows;
}

export function createApiClient(options?: ApiClientOptions) {
  const baseUrl = getApiBaseUrl();
  const headers = buildHeaders(options);

  async function fetchApi<T>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    // Browser calls without an explicit token go through the Next.js BFF
    // (`/api/v1/...`) so the httpOnly session cookie can be exchanged for a
    // Bearer token. Server-side / token-bearing clients hit Nest directly.
    const useBrowserBff = typeof window !== 'undefined' && !options?.token;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = useBrowserBff
      ? `/api/v1${normalizedPath}`
      : `${baseUrl}${normalizedPath}`;
    const mergedHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    // IAM-protected Cloud Run: keep user JWT on Authorization; platform
    // invoker token goes on X-Serverless-Authorization.
    if (typeof window === 'undefined') {
      const idToken = await fetchCloudRunIdToken(resolveApiAudience());
      if (idToken) {
        mergedHeaders['X-Serverless-Authorization'] = `Bearer ${idToken}`;
      }
    }
    const res = await fetchWithTransientRetry(
      url,
      {
        ...init,
        headers: mergedHeaders,
        // Prevent Next.js Data Cache from serving stale API responses in
        // server components and server actions.
        ...(typeof window === 'undefined' && !init?.cache
          ? { cache: 'no-store' as const }
          : {}),
      },
      { logLabel: 'frontend:api-client:fetchApi' },
    );
    return handleResponse<T>(res);
  }

  return {
    getClaims(params: {
      page?: number;
      limit?: number;
      search?: string;
      sort?: string;
      status?: string;
      account?: string;
    }): Promise<PaginatedResponse<Claim>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.search) sp.set('search', params.search);
      if (params.sort) sp.set('sort', params.sort);
      if (params.status) sp.set('status', params.status);
      if (params.account) sp.set('account', params.account);
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
      assignedToUserId?: string;
      assignedToUserIds?: string;
      refs?: string;
    }): Promise<PaginatedResponse<Job>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.search) sp.set('search', params.search ?? '');
      if (params.claimId) sp.set('claimId', params.claimId);
      if (params.sort) sp.set('sort', params.sort);
      if (params.status) sp.set('status', params.status ?? '');
      if (params.jobType) sp.set('jobType', params.jobType);
      if (params.assignedToUserId) sp.set('assignedToUserId', params.assignedToUserId);
      if (params.assignedToUserIds) sp.set('assignedToUserIds', params.assignedToUserIds);
      if (params.refs) sp.set('refs', params.refs);
      return fetchApi<PaginatedResponse<Job>>(`/jobs?${sp}`);
    },

    getJobFilterOptions(): Promise<{
      refs: string[];
      assignees: { id: string; name: string }[];
    }> {
      return fetchApi('/jobs/filter-options');
    },

    getJob(id: string): Promise<Job | null> {
      return fetchApi<Job | null>(`/jobs/${id}`);
    },

    getJobRelatedCounts(jobId: string): Promise<JobRelatedCounts> {
      return fetchApi<JobRelatedCounts>(`/jobs/${jobId}/related-counts`);
    },

    getJobQuotes(jobId: string): Promise<Quote[]> {
      return fetchApi<Quote[]>(`/quotes/job/${jobId}`);
    },

    getJobPurchaseOrders(jobId: string): Promise<PurchaseOrder[]> {
      return fetchApi<PurchaseOrder[]>(`/purchase-orders/job/${jobId}`);
    },

    getTasks(params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      priority?: string;
      sort?: string;
      order?: 'asc' | 'desc';
      assignedToUserId?: string;
      assignedToUserIds?: string;
      names?: string;
      taskTypes?: string;
      overdue?: boolean;
      jobId?: string;
      jobIds?: string[];
    }): Promise<PaginatedResponse<Task>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.search) sp.set('search', params.search);
      // Repeat status values so spaces in labels (e.g. "In Progress") never
      // depend on CSV parsing of a single query param.
      if (params?.status) {
        for (const value of params.status.split(',').map((s) => s.trim()).filter(Boolean)) {
          sp.append('status', value);
        }
      }
      if (params?.priority) sp.set('priority', params.priority);
      if (params?.sort) sp.set('sort', params.sort);
      if (params?.order) sp.set('order', params.order);
      if (params?.assignedToUserId) sp.set('assignedToUserId', params.assignedToUserId);
      if (params?.assignedToUserIds) sp.set('assignedToUserIds', params.assignedToUserIds);
      if (params?.names) sp.set('names', params.names);
      if (params?.taskTypes) sp.set('taskTypes', params.taskTypes);
      if (params?.overdue) sp.set('overdue', 'true');
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      return fetchApi<PaginatedResponse<Task>>(`/tasks?${sp}`);
    },

    getTaskFilterOptions(): Promise<{
      names: string[];
      taskTypes: string[];
      assignees: { id: string; name: string }[];
    }> {
      return fetchApi('/tasks/filter-options');
    },

    getJobTasks(jobId: string): Promise<Task[]> {
      return fetchApi<Task[]>(`/tasks/job/${jobId}`);
    },

    getTask(id: string): Promise<Task | null> {
      return fetchApi<Task | null>(`/tasks/${id}`);
    },

    getTaskTypes(): Promise<string[]> {
      return fetchApi<string[]>('/tasks/task-types');
    },

    getMessages(params?: {
      page?: number;
      limit?: number;
      jobId?: string;
      jobIds?: string[];
      claimId?: string;
      readStatus?: string;
      fromNames?: string;
      toNames?: string;
      search?: string;
      sort?: string;
    }): Promise<PaginatedResponse<Message>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      if (params?.claimId) sp.set('claimId', params.claimId);
      if (params?.readStatus) sp.set('readStatus', params.readStatus);
      if (params?.fromNames) sp.set('fromNames', params.fromNames);
      if (params?.toNames) sp.set('toNames', params.toNames);
      if (params?.search) sp.set('search', params.search);
      if (params?.sort) sp.set('sort', params.sort);
      const qs = sp.toString();
      return fetchApi<PaginatedResponse<Message>>(`/messages${qs ? `?${qs}` : ''}`);
    },

    getMessageFilterOptions(): Promise<{
      fromNames: string[];
      toNames: string[];
      statuses: ('Read' | 'Unread')[];
    }> {
      return fetchApi('/messages/filter-options');
    },

    getJobMessages(jobId: string): Promise<PaginatedResponse<Message>> {
      return fetchApi<PaginatedResponse<Message>>(`/messages?jobId=${jobId}&limit=100`);
    },

    getClaimMessages(claimId: string): Promise<PaginatedResponse<Message>> {
      return fetchApi<PaginatedResponse<Message>>(`/messages?claimId=${claimId}&limit=100`);
    },

    getJobReports(jobId: string): Promise<Report[]> {
      return fetchApi<Report[]>(`/reports/job/${jobId}`);
    },

    getAppointments(params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      location?: string;
      appointmentTypeLookupIds?: string;
      sort?: string;
      order?: 'asc' | 'desc';
      jobId?: string;
      jobIds?: string[];
    }): Promise<PaginatedResponse<Appointment>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.search) sp.set('search', params.search);
      if (params?.status) sp.set('status', params.status);
      if (params?.location) sp.set('location', params.location);
      if (params?.appointmentTypeLookupIds) {
        sp.set('appointmentTypeLookupIds', params.appointmentTypeLookupIds);
      }
      if (params?.sort) sp.set('sort', params.sort);
      if (params?.order) sp.set('order', params.order);
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      return fetchApi<PaginatedResponse<Appointment>>(`/appointments?${sp}`);
    },

    getAppointmentFilterLocations(): Promise<string[]> {
      return fetchApi<string[]>('/appointments/filter-locations');
    },

    getAppointmentFilterTypes(): Promise<{ id: string; name: string }[]> {
      return fetchApi('/appointments/filter-types');
    },

    getJobAppointments(jobId: string): Promise<Appointment[]> {
      return fetchApi<Appointment[]>(`/appointments/job/${jobId}`);
    },

    getAppointment(id: string): Promise<Appointment | null> {
      return fetchApi<Appointment | null>(`/appointments/${id}`);
    },

    getJobInvoices(jobId: string): Promise<Invoice[]> {
      return fetchApi<Invoice[]>(`/invoices/job/${jobId}`);
    },

    getAttachments(params?: {
      page?: number;
      limit?: number;
      search?: string;
      relatedRecordType?: string;
      sort?: string;
    }): Promise<PaginatedResponse<Attachment>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.search) sp.set('search', params.search);
      if (params?.relatedRecordType) sp.set('relatedRecordType', params.relatedRecordType);
      if (params?.sort) sp.set('sort', params.sort);
      return fetchApi<PaginatedResponse<Attachment>>(`/attachments?${sp}`);
    },

    getEntityAttachments(relatedRecordType: string, entityId: string): Promise<Attachment[]> {
      const sp = new URLSearchParams({ relatedRecordType, relatedRecordId: entityId });
      return fetchApi<Attachment[]>(`/attachments?${sp}`);
    },

    getJobAttachments(jobId: string): Promise<Attachment[]> {
      const sp = new URLSearchParams({
        relatedRecordType: 'Job',
        relatedRecordId: jobId,
      });
      return fetchApi<Attachment[]>(`/attachments?${sp}`);
    },

    getQuoteAttachments(quoteId: string): Promise<Attachment[]> {
      const sp = new URLSearchParams({
        relatedRecordType: 'Quote',
        relatedRecordId: quoteId,
      });
      return fetchApi<Attachment[]>(`/attachments?${sp}`);
    },

    getQuotes(params: {
      page?: number;
      limit?: number;
      jobId?: string;
      jobIds?: string[];
      status?: string;
      statusId?: string;
      quoteType?: string;
      assignedToUserIds?: string;
      search?: string;
      sort?: string;
    }): Promise<PaginatedResponse<Quote>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.jobId) sp.set('jobId', params.jobId);
      if (params.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      if (params.status) sp.set('status', params.status);
      if (params.statusId) sp.set('statusId', params.statusId);
      if (params.quoteType) sp.set('quoteType', params.quoteType);
      if (params.assignedToUserIds) sp.set('assignedToUserIds', params.assignedToUserIds);
      if (params.search) sp.set('search', params.search);
      if (params.sort) sp.set('sort', params.sort);
      return fetchApi<PaginatedResponse<Quote>>(`/quotes?${sp}`);
    },

    getQuoteFilterAssignees(): Promise<{ id: string; name: string }[]> {
      return fetchApi('/quotes/filter-assignees');
    },

    getQuoteFilterJobs(): Promise<{ id: string; label: string; jobType?: string | null }[]> {
      return fetchApi('/quotes/filter-jobs');
    },

    getQuote(id: string): Promise<Quote | null> {
      return fetchApi<Quote | null>(`/quotes/${id}`);
    },

    getPurchaseOrders(params: {
      page?: number;
      limit?: number;
      jobId?: string;
      jobIds?: string[];
      status?: string;
      vendorId?: string;
      search?: string;
      sort?: string;
    }): Promise<PaginatedResponse<PurchaseOrder>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.jobId) sp.set('jobId', params.jobId);
      if (params.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      if (params.status) sp.set('status', params.status);
      if (params.vendorId) sp.set('vendorId', params.vendorId);
      if (params.search) sp.set('search', params.search);
      if (params.sort) sp.set('sort', params.sort);
      return fetchApi<PaginatedResponse<PurchaseOrder>>(`/purchase-orders?${sp}`);
    },

    getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
      return fetchApi<PurchaseOrder | null>(`/purchase-orders/${id}`);
    },

    createPurchaseOrder(body: Record<string, unknown>): Promise<PurchaseOrder> {
      return fetchApi<PurchaseOrder>('/purchase-orders', { method: 'POST', body: JSON.stringify(body) });
    },

    capturePurchaseOrder(body: CapturePoRequest): Promise<CapturePoResponse> {
      return fetchApi<CapturePoResponse>('/purchase-orders/capture', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    getOrganisation(): Promise<OrganisationProfile> {
      return fetchApi<OrganisationProfile>('/organisations/me');
    },

    updateOrganisation(body: {
      name?: string;
      abn?: string;
      primaryEmail?: string;
      phone?: string;
      address?: string;
    }): Promise<OrganisationProfile> {
      return fetchApi<OrganisationProfile>('/organisations/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },

    getGhostOrganisations(): Promise<GhostOrganisation[]> {
      return fetchApi<GhostOrganisation[]>('/organisations/ghosts');
    },

    claimGhostOrganisation(ghostOrgId: string): Promise<unknown> {
      return fetchApi<unknown>(`/organisations/ghosts/${ghostOrgId}/claim`, { method: 'POST' });
    },

    getOrganisationClaims(): Promise<OrganisationClaim[]> {
      return fetchApi<OrganisationClaim[]>('/organisation-claims');
    },

    approveOrganisationClaim(claimId: string): Promise<unknown> {
      return fetchApi<unknown>(`/organisation-claims/${claimId}/approve`, { method: 'POST' });
    },

    rejectOrganisationClaim(claimId: string, notes?: string): Promise<unknown> {
      return fetchApi<unknown>(`/organisation-claims/${claimId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
    },

    getPurchaseOrderLineItems(
      poId: string,
      query?: LineItemsPageQuery,
    ): Promise<LineItemsPageResponse> {
      return fetchApi<LineItemsPageResponse>(
        `/purchase-orders/${poId}/line-items${lineItemsPageQueryString(query)}`,
      );
    },

    getWorkOrderLineItems(
      woId: string,
      query?: LineItemsPageQuery,
    ): Promise<LineItemsPageResponse> {
      return fetchApi<LineItemsPageResponse>(
        `/work-orders/${woId}/line-items${lineItemsPageQueryString(query)}`,
      );
    },

    getProposalLineItems(
      proposalId: string,
      query?: LineItemsPageQuery,
    ): Promise<LineItemsPageResponse> {
      return fetchApi<LineItemsPageResponse>(
        `/proposals/${proposalId}/line-items${lineItemsPageQueryString(query)}`,
      );
    },

    getInvoices(params: {
      page?: number;
      limit?: number;
      purchaseOrderId?: string;
      status?: string;
      sort?: string;
      search?: string;
      jobId?: string;
      jobIds?: string[];
    }): Promise<PaginatedResponse<Invoice>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.purchaseOrderId) sp.set('purchaseOrderId', params.purchaseOrderId);
      if (params.status) sp.set('status', params.status);
      if (params.sort) sp.set('sort', params.sort);
      if (params.search) sp.set('search', params.search);
      if (params.jobId) sp.set('jobId', params.jobId);
      if (params.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
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
      status?: string;
      reportTypeId?: string;
      search?: string;
      sort?: string;
    }): Promise<PaginatedResponse<Report>> {
      const sp = new URLSearchParams();
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.jobId) sp.set('jobId', params.jobId);
      if (params.claimId) sp.set('claimId', params.claimId);
      if (params.status) sp.set('status', params.status);
      if (params.reportTypeId) sp.set('reportTypeId', params.reportTypeId);
      if (params.search) sp.set('search', params.search);
      if (params.sort) sp.set('sort', params.sort);
      return fetchApi<PaginatedResponse<Report>>(`/reports?${sp}`);
    },

    getReport(id: string): Promise<Report | null> {
      return fetchApi<Report | null>(`/reports/${id}`);
    },

    getDashboardInbox(): Promise<DashboardInbox> {
      return fetchApi<DashboardInbox>('/dashboard/inbox');
    },

    getDashboardStats(): Promise<DashboardStats> {
      return fetchApi<DashboardStats>('/dashboard/stats');
    },

    getDashboardRecentActivity(limit?: number): Promise<RecentActivity[]> {
      const sp = limit != null ? `?limit=${limit}` : '';
      return fetchApi<RecentActivity[]>(`/dashboard/recent-activity${sp}`);
    },

    getVendors(params?: {
      page?: number;
      limit?: number;
      search?: string;
      linked?: boolean;
      sort?: string;
    }): Promise<PaginatedResponse<Vendor>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.search) sp.set('search', params.search);
      if (params?.linked === true) sp.set('linked', 'true');
      if (params?.linked === false) sp.set('linked', 'false');
      if (params?.sort) sp.set('sort', params.sort);
      const qs = sp.toString();
      return fetchApi<PaginatedResponse<Vendor>>(qs ? `/vendors?${qs}` : '/vendors');
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

    getLookupsByDomain(
      domain: string,
      options?: { providerCode?: string },
    ): Promise<{ id: string; name?: string; externalReference?: string; providerCode?: string | null }[]> {
      const sp = new URLSearchParams({ domain });
      if (options?.providerCode) sp.set('providerCode', options.providerCode);
      return fetchApi(`/lookups?${sp}`);
    },

    ensureLookup(body: { domain: string; name: string }): Promise<{ id: string; name: string; domain: string }> {
      return fetchApi('/lookups/ensure', { method: 'POST', body: JSON.stringify(body) });
    },

    createJob(body: Record<string, unknown>, options?: { provider?: string }): Promise<Job> {
      const qs = options?.provider ? `?provider=${encodeURIComponent(options.provider)}` : '';
      return fetchApi<Job>(`/jobs${qs}`, { method: 'POST', body: JSON.stringify(body) });
    },

    updateJob(id: string, body: Record<string, unknown>): Promise<Job> {
      return fetchApi<Job>(`/jobs/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    updateClaim(id: string, body: Record<string, unknown>): Promise<Claim> {
      return fetchApi<Claim>(`/claims/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    updateQuote(id: string, body: Record<string, unknown>): Promise<Quote> {
      return fetchApi<Quote>(`/quotes/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    updateInvoice(id: string, body: Record<string, unknown>): Promise<Invoice> {
      return fetchApi<Invoice>(`/invoices/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    updatePurchaseOrder(id: string, body: Record<string, unknown>): Promise<PurchaseOrder> {
      return fetchApi<PurchaseOrder>(`/purchase-orders/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    updateReport(id: string, body: Record<string, unknown>): Promise<Report> {
      return fetchApi<Report>(`/reports/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    addJobContacts(
      id: string,
      body: {
        contacts: Array<{
          contactId?: string;
          firstName?: string;
          lastName?: string;
          email?: string;
          mobilePhone?: string;
          homePhone?: string;
          workPhone?: string;
          notes?: string;
        }>;
      },
    ): Promise<Job> {
      return fetchApi<Job>(`/jobs/${id}/contacts`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    removeJobContact(jobId: string, contactId: string): Promise<Job> {
      return fetchApi<Job>(`/jobs/${jobId}/contacts/${contactId}`, {
        method: 'DELETE',
      });
    },

    createQuote(body: Record<string, unknown>): Promise<Quote> {
      return fetchApi<Quote>('/quotes', { method: 'POST', body: JSON.stringify(body) });
    },

    publishQuote(id: string): Promise<PublishQuoteResult> {
      return fetchApi<PublishQuoteResult>(`/quotes/${id}/publish`, { method: 'POST' });
    },

    approveQuote(id: string): Promise<{ quote: Quote; workOrderId: string }> {
      return fetchApi<{ quote: Quote; workOrderId: string }>(`/quotes/${id}/approve`, { method: 'POST' });
    },

    createInvoice(body: Record<string, unknown>): Promise<Invoice> {
      return fetchApi<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(body) });
    },

    publishInvoice(id: string): Promise<Invoice> {
      return fetchApi<Invoice>(`/invoices/${id}/publish`, { method: 'POST' });
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

    updateTask(id: string, body: Record<string, unknown>): Promise<Task> {
      return fetchApi<Task>(`/tasks/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    retrySyncStatus(entityType: string, entityId: string): Promise<{ success: boolean; syncStatus: string }> {
      return fetchApi<{ success: boolean; syncStatus: string }>(`/outbound-sync/${entityType}/${entityId}/retry`, { method: 'POST' });
    },

    listOrgUsersForSelect(): Promise<{ id: string; type: 'USER'; name: string; email?: string }[]> {
      return fetchApi(`/contacts/search-users?limit=100`);
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

    // Contacts
    getContacts(params?: {
      page?: number;
      limit?: number;
      search?: string;
      sort?: string;
      jobId?: string;
      jobIds?: string[];
      unlinkedOnly?: boolean;
      typeLookupIds?: string[];
      status?: string;
    }): Promise<PaginatedResponse<Contact>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.search) sp.set('search', params.search);
      if (params?.sort) sp.set('sort', params.sort);
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      if (params?.unlinkedOnly) sp.set('unlinkedOnly', '1');
      if (params?.typeLookupIds?.length) {
        sp.set('typeLookupIds', params.typeLookupIds.join(','));
      }
      if (params?.status) sp.set('status', params.status);
      return fetchApi<PaginatedResponse<Contact>>(`/contacts?${sp}`);
    },

    getContactFilterJobs(): Promise<{
      jobs: Array<{
        id: string;
        name?: string | null;
        externalReference?: string | null;
        externalJobId?: string | null;
        jobTypeName?: string | null;
      }>;
      hasUnlinked: boolean;
    }> {
      return fetchApi(`/contacts/filter-jobs`);
    },

    getContact(id: string): Promise<Contact> {
      return fetchApi<Contact>(`/contacts/${id}`);
    },

    getContactRelatedJobs(id: string): Promise<ContactRelatedJob[]> {
      return fetchApi<ContactRelatedJob[]>(`/contacts/${id}/jobs`);
    },

    getJobContacts(jobId: string): Promise<{ id: string; type: 'CONTACT'; name: string; email?: string }[]> {
      return fetchApi(`/contacts/job/${jobId}`);
    },

    createContact(body: Record<string, unknown>): Promise<Contact> {
      return fetchApi<Contact>('/contacts', { method: 'POST', body: JSON.stringify(body) });
    },

    updateContact(id: string, body: Record<string, unknown>): Promise<Contact> {
      return fetchApi<Contact>(`/contacts/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    ensureMeContact(): Promise<{
      id: string;
      type: 'CONTACT';
      name: string;
      email?: string;
    }> {
      return fetchApi('/contacts/ensure-me', { method: 'POST', body: '{}' });
    },

    getMeContact(): Promise<{
      id: string;
      type: 'CONTACT';
      name: string;
      email?: string;
    } | null> {
      return fetchApi('/contacts/me');
    },

    searchContacts(
      query: string,
      type?: 'USER' | 'CONTACT',
      options?: { typeLookupIds?: string[] },
    ): Promise<{ id: string; type: 'USER' | 'CONTACT'; name: string; email?: string; mobilePhone?: string }[]> {
      const sp = new URLSearchParams({ search: query, limit: '20' });
      if (type === 'USER') {
        return fetchApi(`/contacts/search-users?${sp}`);
      }
      if (options?.typeLookupIds?.length) {
        sp.set('typeLookupIds', options.typeLookupIds.join(','));
      }
      return fetchApi(`/contacts?${sp}`).then((res: any) => {
        const data: any[] = Array.isArray(res) ? res : res?.data ?? [];
        return data.map((c: any) => ({
          id: c.id,
          type: 'CONTACT' as const,
          name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unknown',
          email: c.email ?? undefined,
          mobilePhone: c.mobilePhone ?? undefined,
        }));
      });
    },

    // Work Orders
    getWorkOrders(params?: {
      page?: number;
      limit?: number;
      jobId?: string;
      jobIds?: string[];
      purchaseOrderId?: string;
      status?: string;
      workOrderType?: string;
      search?: string;
      sort?: string;
    }): Promise<PaginatedResponse<WorkOrder>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      if (params?.purchaseOrderId) sp.set('purchaseOrderId', params.purchaseOrderId);
      if (params?.status) sp.set('status', params.status);
      if (params?.workOrderType) sp.set('workOrderType', params.workOrderType);
      if (params?.search) sp.set('search', params.search);
      if (params?.sort) sp.set('sort', params.sort);
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
      jobIds?: string[];
      quoteId?: string;
      status?: string;
      vendorId?: string;
      search?: string;
      sort?: string;
    }): Promise<PaginatedResponse<Rfq>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      if (params?.quoteId) sp.set('quoteId', params.quoteId);
      if (params?.status) sp.set('status', params.status);
      if (params?.vendorId) sp.set('vendorId', params.vendorId);
      if (params?.search) sp.set('search', params.search);
      if (params?.sort) sp.set('sort', params.sort);
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

    getRfqsSentToContact(contactId: string, jobId?: string): Promise<Rfq[]> {
      const sp = new URLSearchParams();
      if (jobId) sp.set('jobId', jobId);
      const qs = sp.toString();
      return fetchApi<Rfq[]>(`/rfqs/contact/${contactId}${qs ? `?${qs}` : ''}`);
    },

    createRfq(body: Record<string, unknown>): Promise<Rfq> {
      return fetchApi<Rfq>('/rfqs', { method: 'POST', body: JSON.stringify(body) });
    },

    updateRfq(id: string, body: Record<string, unknown>): Promise<Rfq> {
      return fetchApi<Rfq>(`/rfqs/${id}`, { method: 'POST', body: JSON.stringify(body) });
    },

    getRfqLineItems(rfqId: string): Promise<Array<Record<string, unknown>>> {
      return fetchApi(`/rfqs/${rfqId}/line-items`);
    },

    replaceRfqLineItems(
      rfqId: string,
      body: { selectedItemIds: string[] },
    ): Promise<Array<Record<string, unknown>>> {
      return fetchApi(`/rfqs/${rfqId}/line-items`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    updateRfqLineNote(
      rfqId: string,
      body: {
        targetType: 'group' | 'combo' | 'item';
        targetId: string;
        note: string | null;
      },
    ): Promise<{ success: boolean; targetType: string; targetId: string; note: string | null }> {
      return fetchApi(`/rfqs/${rfqId}/line-notes`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },

    // Proposals
    getProposals(params?: {
      page?: number;
      limit?: number;
      jobId?: string;
      jobIds?: string[];
      rfqId?: string;
      status?: string;
      vendorId?: string;
      search?: string;
      sort?: string;
    }): Promise<PaginatedResponse<Proposal>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      if (params?.rfqId) sp.set('rfqId', params.rfqId);
      if (params?.status) sp.set('status', params.status);
      if (params?.vendorId) sp.set('vendorId', params.vendorId);
      if (params?.search) sp.set('search', params.search);
      if (params?.sort) sp.set('sort', params.sort);
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

    acceptProposal(id: string): Promise<Proposal> {
      return fetchApi<Proposal>(`/proposals/${id}/accept`, { method: 'POST' });
    },

    declineProposal(id: string, reason?: string): Promise<Proposal> {
      return fetchApi<Proposal>(`/proposals/${id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },

    captureEstimate(body: CaptureEstimateRequest): Promise<CaptureEstimateResponse> {
      return fetchApi<CaptureEstimateResponse>('/quotes/capture', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    // Bills
    getBills(params?: {
      page?: number;
      limit?: number;
      jobId?: string;
      jobIds?: string[];
      purchaseOrderId?: string;
      status?: string;
      vendorId?: string;
      invoiceId?: string;
      search?: string;
      sort?: string;
    }): Promise<PaginatedResponse<Bill>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      if (params?.purchaseOrderId) sp.set('purchaseOrderId', params.purchaseOrderId);
      if (params?.status) sp.set('status', params.status);
      if (params?.vendorId) sp.set('vendorId', params.vendorId);
      if (params?.invoiceId) sp.set('invoiceId', params.invoiceId);
      if (params?.search) sp.set('search', params.search);
      if (params?.sort) sp.set('sort', params.sort);
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

    getConnections(params?: {
      search?: string;
      isActive?: boolean;
      sort?: string;
    }): Promise<ConnectionSummary[]> {
      const sp = new URLSearchParams();
      if (params?.search) sp.set('search', params.search);
      if (params?.isActive === true) sp.set('isActive', 'true');
      if (params?.isActive === false) sp.set('isActive', 'false');
      if (params?.sort) sp.set('sort', params.sort);
      const qs = sp.toString();
      return fetchApi<ConnectionSummary[]>(qs ? `/connections?${qs}` : '/connections');
    },

    getConnection(id: string): Promise<ConnectionDetail> {
      return fetchApi<ConnectionDetail>(`/connections/${id}`);
    },

    getConnectionDocsUrl(id: string): Promise<{ docsUrl: string; accessToken: string }> {
      return fetchApi<{ docsUrl: string; accessToken: string }>(`/connections/${id}/docs-url`);
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
      eventType?: string;
      search?: string;
      sort?: string;
    }): Promise<PaginatedResponse<WebhookEvent>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.status) sp.set('status', params.status);
      if (params?.eventType) sp.set('eventType', params.eventType);
      if (params?.search) sp.set('search', params.search);
      if (params?.sort) sp.set('sort', params.sort);
      return fetchApi<PaginatedResponse<WebhookEvent>>(`/connections/${id}/webhook-events?${sp}`);
    },

    getConnectionWebhookEventFilterOptions(id: string): Promise<{ eventTypes: string[] }> {
      return fetchApi<{ eventTypes: string[] }>(
        `/connections/${id}/webhook-events/filter-options`,
      );
    },

    getCatalogs(params?: { type?: string }): Promise<Catalog[]> {
      const sp = new URLSearchParams();
      if (params?.type) sp.set('type', params.type);
      return fetchApi<Catalog[]>(`/catalogs?${sp}`);
    },

    getCatalog(id: string): Promise<Catalog> {
      return fetchApi<Catalog>(`/catalogs/${id}`);
    },

    getCatalogCategoryCounts(
      id: string,
      params?: { q?: string },
    ): Promise<Array<{ categoryId: string | null; count: number }>> {
      const sp = new URLSearchParams();
      if (params?.q) sp.set('q', params.q);
      return fetchApi(`/catalogs/${id}/category-counts?${sp}`);
    },

    createCatalog(body: { name: string; description?: string; type: string }): Promise<Catalog> {
      return fetchApi<Catalog>('/catalogs', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    updateCatalog(id: string, body: Record<string, unknown>): Promise<Catalog> {
      return fetchApi<Catalog>(`/catalogs/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    deleteCatalog(id: string): Promise<Catalog> {
      return fetchApi<Catalog>(`/catalogs/${id}`, { method: 'DELETE' });
    },

    copyCatalogItem(targetCatalogId: string, body: {
      catalogItemId: string;
      parentId?: string;
      nestUnderId?: string;
    }): Promise<CatalogItem> {
      return fetchApi<CatalogItem>(`/catalogs/${targetCatalogId}/copy-items`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    moveCatalogLineItem(catalogId: string, body: {
      itemId?: string;
      comboId?: string;
      targetGroupId: string;
      targetComboId?: string;
      insertAtIndex?: number;
    }): Promise<{ success: boolean }> {
      return fetchApi(`/catalogs/${catalogId}/move-line-item`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    reorderCatalogLineItems(catalogId: string, body: {
      groupId: string;
      parentComboId?: string;
      items?: Array<{ id: string; sortIndex: number }>;
      combos?: Array<{ id: string; sortIndex: number }>;
      scopes?: Array<{ id: string; sortIndex: number }>;
    }): Promise<{ success: boolean }> {
      return fetchApi(`/catalogs/${catalogId}/reorder-line-items`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    getCatalogTypes(): Promise<CatalogItemType[]> {
      return fetchApi<CatalogItemType[]>('/catalog/types');
    },

    getCatalogCategoriesTree(): Promise<CatalogCategory[]> {
      return fetchApi<CatalogCategory[]>('/catalog/categories/tree');
    },

    getCatalogCategory(id: string): Promise<CatalogCategory> {
      return fetchApi<CatalogCategory>(`/catalog/categories/${id}`);
    },

    getCatalogItems(params?: {
      catalogId?: string;
      kind?: 'primitive' | 'assembly' | 'scope';
      typeId?: string;
      categoryId?: string;
      categoryIds?: string[];
      q?: string;
      page?: number;
      limit?: number;
      sort?: string;
    }): Promise<PaginatedResponse<CatalogItem>> {
      const sp = new URLSearchParams();
      if (params?.catalogId) sp.set('catalogId', params.catalogId);
      if (params?.kind) sp.set('kind', params.kind);
      if (params?.typeId) sp.set('typeId', params.typeId);
      if (params?.categoryId) sp.set('categoryId', params.categoryId);
      if (params?.categoryIds?.length) sp.set('categoryIds', params.categoryIds.join(','));
      if (params?.q) sp.set('q', params.q);
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.sort) sp.set('sort', params.sort);
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

    getCatalogItemComponents(id: string): Promise<Array<{
      id: string;
      componentId: string;
      quantity: string;
      wasteFactor: string;
      component?: { id?: string; code?: string; name?: string; description?: string | null; unitCost?: string | null; kind?: string; categoryId?: string | null; typeId?: string; unitTypeLookupId?: string | null; markupType?: string | null; markupValue?: string | null; taxRate?: string | null };
      resolvedUnitCost?: string | null;
    }>> {
      return fetchApi(`/catalog/items/${id}/components`);
    },

    updateCatalogComponent(assemblyId: string, lineId: string, body: Record<string, unknown>): Promise<unknown> {
      return fetchApi(`/catalog/items/${assemblyId}/components/${lineId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
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

    updateCatalogCategory(id: string, body: Record<string, unknown>): Promise<CatalogCategory> {
      return fetchApi<CatalogCategory>(`/catalog/categories/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    deleteCatalogCategory(id: string): Promise<CatalogCategory> {
      return fetchApi<CatalogCategory>(`/catalog/categories/${id}`, {
        method: 'DELETE',
      });
    },

    getCatalogImportTemplate(catalogType?: string): Promise<{ csv: string; columns: string[]; catalogType: string }> {
      const sp = new URLSearchParams();
      if (catalogType) sp.set('catalogType', catalogType);
      return fetchApi<{ csv: string; columns: string[]; catalogType: string }>(`/catalog/import/template?${sp}`);
    },

    exportCatalogCsv(
      catalogId: string,
      format?: 'internal' | 'crunchwork',
    ): Promise<{ csv: string; filename: string; format: 'internal' | 'crunchwork'; itemCount: number }> {
      const sp = new URLSearchParams();
      sp.set('catalogId', catalogId);
      if (format) sp.set('format', format);
      return fetchApi<{ csv: string; filename: string; format: 'internal' | 'crunchwork'; itemCount: number }>(
        `/catalog/import/export?${sp}`,
      );
    },

    previewCatalogImport(csv: string, catalogId?: string): Promise<{
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
        body: JSON.stringify({ csv, catalogId }),
      });
    },

    importCatalogCsv(csv: string, catalogId?: string): Promise<{
      created: number;
      updated: number;
      skipped: number;
      errors: number;
      results: Array<{ row: number; code: string; status: string; message?: string }>;
    }> {
      return fetchApi('/catalog/import/csv', {
        method: 'POST',
        body: JSON.stringify({ csv, catalogId }),
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

    getQuoteLineItems(
      quoteId: string,
      query?: LineItemsPageQuery,
    ): Promise<LineItemsPageResponse> {
      return fetchApi(`/quotes/${quoteId}/line-items${lineItemsPageQueryString(query)}`);
    },

    ensureQuoteGroup(quoteId: string): Promise<{ id: string; description: string | null }> {
      return fetchApi(`/quotes/${quoteId}/groups`, { method: 'POST' });
    },

    createQuoteGroup(
      quoteId: string,
      body: { groupLabelLookupId?: string; description?: string },
    ): Promise<{ id: string; description: string | null }> {
      return fetchApi(`/quotes/${quoteId}/groups`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    updateQuoteGroup(
      quoteId: string,
      groupId: string,
      body: { groupLabelLookupId?: string; description?: string; dimensions?: Record<string, unknown> },
    ): Promise<{ id: string; description: string | null }> {
      return fetchApi(`/quotes/${quoteId}/groups/${groupId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },

    deleteQuote(quoteId: string): Promise<{ deleted: boolean; softDeleted: boolean }> {
      return fetchApi(`/quotes/${quoteId}`, { method: 'DELETE' });
    },

    deleteQuoteGroup(quoteId: string, groupId: string): Promise<{ deleted: boolean }> {
      return fetchApi(`/quotes/${quoteId}/groups/${groupId}`, { method: 'DELETE' });
    },

    deleteQuoteItem(quoteId: string, itemId: string, options?: { removeFromCatalogAssembly?: boolean }): Promise<{ deleted: boolean; removedFromCatalog?: boolean }> {
      const qs = options?.removeFromCatalogAssembly ? '?removeFromCatalogAssembly=true' : '';
      return fetchApi(`/quotes/${quoteId}/items/${itemId}${qs}`, { method: 'DELETE' });
    },

    deleteQuoteCombo(quoteId: string, comboId: string): Promise<{ deleted: boolean }> {
      return fetchApi(`/quotes/${quoteId}/combos/${comboId}`, { method: 'DELETE' });
    },

    reorderQuoteGroups(quoteId: string, groupIds: string[]): Promise<unknown> {
      return fetchApi(`/quotes/${quoteId}/groups/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ groupIds }),
      });
    },

    reorderQuoteLineItems(quoteId: string, payload: {
      items?: Array<{ id: string; sortIndex: number }>;
      combos?: Array<{ id: string; sortIndex: number }>;
    }): Promise<{ success: boolean }> {
      return fetchApi(`/quotes/${quoteId}/line-items/reorder`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },

    moveQuoteLineItem(quoteId: string, payload: {
      itemId?: string;
      comboId?: string;
      targetGroupId: string;
      targetComboId?: string;
      insertAtIndex?: number;
    }): Promise<{ success: boolean }> {
      return fetchApi(`/quotes/${quoteId}/line-items/move`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },

    duplicateQuoteLineItem(quoteId: string, payload: {
      itemId?: string;
      comboId?: string;
      targetGroupId: string;
      targetComboId?: string;
      insertAtIndex?: number;
    }): Promise<{ success: boolean; newId?: string }> {
      return fetchApi(`/quotes/${quoteId}/line-items/duplicate`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
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
      quoteComboId?: string;
    }): Promise<unknown> {
      return fetchApi(`/quotes/${params.quoteId}/groups/${params.groupId}/catalog-assemblies`, {
        method: 'POST',
        body: JSON.stringify({
          catalogAssemblyId: params.catalogAssemblyId,
          quantity: params.quantity,
          quoteComboId: params.quoteComboId,
        }),
      });
    },

    updateQuoteLineItems(
      quoteId: string,
      body: {
        items: Array<{ id: string; name?: string; component?: string; description?: string; quantity?: string; unitCost?: string; markupValue?: string; tax?: string; unitType?: string }>;
        combos: Array<{ id: string; name?: string; component?: string; description?: string; quantity?: string }>;
      },
    ): Promise<{ updated: number }> {
      return fetchApi(`/quotes/${quoteId}/line-items`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },

    // -- Journals --

    getJournals(params?: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      jobId?: string;
      jobIds?: string[];
    }): Promise<PaginatedResponse<Journal>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.status) sp.set('status', params.status);
      if (params?.search) sp.set('search', params.search);
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      return fetchApi<PaginatedResponse<Journal>>(`/journals?${sp}`);
    },

    getJournal(id: string): Promise<Journal> {
      return fetchApi<Journal>(`/journals/${id}`);
    },

    getJournalsByEntity(
      entityType: string,
      entityId: string,
      params?: { search?: string; status?: string },
    ): Promise<Journal[]> {
      const sp = new URLSearchParams();
      if (params?.search) sp.set('search', params.search);
      if (params?.status) sp.set('status', params.status);
      const qs = sp.toString();
      return fetchApi<Journal[]>(
        qs
          ? `/journals/entity/${entityType}/${entityId}?${qs}`
          : `/journals/entity/${entityType}/${entityId}`,
      );
    },

    createJournal(data: {
      name: string;
      description?: string;
      address?: AddressPayload;
      latitude?: number;
      longitude?: number;
      metadata?: Record<string, unknown>;
    }): Promise<Journal> {
      return fetchApi<Journal>('/journals', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateJournal(id: string, data: {
      name?: string;
      description?: string;
      status?: string;
      address?: Record<string, unknown>;
      latitude?: number;
      longitude?: number;
      metadata?: Record<string, unknown>;
    }): Promise<Journal> {
      return fetchApi<Journal>(`/journals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    deleteJournal(id: string): Promise<{ deleted: boolean }> {
      return fetchApi(`/journals/${id}`, { method: 'DELETE' });
    },

    linkJournalToEntity(journalId: string, entityType: string, entityId: string): Promise<unknown> {
      return fetchApi(`/journals/${journalId}/link`, {
        method: 'POST',
        body: JSON.stringify({ entityType, entityId }),
      });
    },

    unlinkJournalFromEntity(journalId: string, entityType: string, entityId: string): Promise<{ unlinked: boolean }> {
      return fetchApi(`/journals/${journalId}/link/${entityType}/${entityId}`, {
        method: 'DELETE',
      });
    },

    getJournalPages(journalId: string, params?: {
      limit?: number;
      offset?: number;
    }): Promise<{ data: JournalPage[]; total: number }> {
      const sp = new URLSearchParams();
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.offset != null) sp.set('offset', String(params.offset));
      return fetchApi(`/journals/${journalId}/pages?${sp}`);
    },

    getJournalPage(journalId: string, pageId: string): Promise<JournalPage> {
      return fetchApi<JournalPage>(`/journals/${journalId}/pages/${pageId}`);
    },

    createJournalPage(journalId: string, data: {
      name?: string;
      body?: string;
      bodyFormat?: string;
      latitude?: number;
      longitude?: number;
      locationAccuracy?: number;
      locationLabel?: string;
      capturedAt?: string;
      blocks?: Array<
        | { id: string; type: 'note'; text?: string }
        | { id: string; type: 'upload'; attachmentId?: string }
      >;
      metadata?: Record<string, unknown>;
    }): Promise<JournalPage> {
      return fetchApi<JournalPage>(`/journals/${journalId}/pages`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateJournalPage(journalId: string, pageId: string, data: {
      name?: string;
      body?: string;
      bodyFormat?: string;
      latitude?: number;
      longitude?: number;
      locationLabel?: string;
      blocks?: Array<
        | { id: string; type: 'note'; text?: string }
        | { id: string; type: 'upload'; attachmentId?: string }
      >;
      metadata?: Record<string, unknown>;
    }): Promise<JournalPage> {
      return fetchApi<JournalPage>(`/journals/${journalId}/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    deleteJournalPage(journalId: string, pageId: string): Promise<{ deleted: boolean }> {
      return fetchApi(`/journals/${journalId}/pages/${pageId}`, { method: 'DELETE' });
    },

    createJournalPageAttachment(journalId: string, pageId: string, data: {
      fileName: string;
      mimeType: string;
      fileSize?: number;
      storageKey: string;
      documentId?: string;
      thumbnailStorageKey?: string;
      fileUrl?: string;
      caption?: string;
      sortIndex?: number;
      width?: number;
      height?: number;
    }): Promise<unknown> {
      return fetchApi(`/journals/${journalId}/pages/${pageId}/attachments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    deleteJournalPageAttachment(
      journalId: string,
      pageId: string,
      attachmentId: string,
    ): Promise<{ deleted: boolean }> {
      return fetchApi(`/journals/${journalId}/pages/${pageId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
    },

    getJournalUploadUrl(
      journalId: string,
      pageId: string,
      fileName: string,
      mimeType: string,
    ): Promise<{ uploadUrl: string; storageKey: string; fileId: string }> {
      return fetchApi(`/journals/${journalId}/pages/${pageId}/upload-url`, {
        method: 'POST',
        body: JSON.stringify({ fileName, mimeType }),
      });
    },

    getJournalDownloadUrl(
      journalId: string,
      pageId: string,
      attachmentId: string,
    ): Promise<{ downloadUrl: string; fileName: string; mimeType: string }> {
      return fetchApi(`/journals/${journalId}/pages/${pageId}/attachments/${attachmentId}/download`);
    },

    // -- Assessments --

    getAssessments(params?: {
      page?: number;
      limit?: number;
      status?: string;
      jobId?: string;
      jobIds?: string[];
      search?: string;
    }): Promise<PaginatedResponse<Assessment>> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.status) sp.set('status', params.status);
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.jobIds?.length) sp.set('jobIds', params.jobIds.join(','));
      if (params?.search) sp.set('search', params.search);
      return fetchApi<PaginatedResponse<Assessment>>(`/assessments?${sp}`);
    },

    getAssessment(id: string): Promise<Assessment> {
      return fetchApi<Assessment>(`/assessments/${id}`);
    },

    createAssessment(data: Partial<Assessment> & { name: string }): Promise<Assessment> {
      return fetchApi<Assessment>('/assessments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateAssessment(id: string, data: Partial<Assessment>): Promise<Assessment> {
      return fetchApi<Assessment>(`/assessments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    validateAssessment(id: string): Promise<{
      valid: boolean;
      errors: string[];
      customData?: Record<string, unknown>;
    }> {
      return fetchApi(`/assessments/${id}/validate`, { method: 'POST' });
    },

    publishAssessment(id: string): Promise<Assessment> {
      return fetchApi<Assessment>(`/assessments/${id}/publish`, { method: 'POST' });
    },

    deleteAssessment(id: string): Promise<{ deleted: boolean }> {
      return fetchApi(`/assessments/${id}`, { method: 'DELETE' });
    },

    getScheduleEvents(params: {
      from: string;
      to: string;
      eventType?: string;
      jobId?: string;
      mine?: boolean;
      assignedToUserId?: string;
      limit?: number;
    }): Promise<{ data: import('@/types/api').ScheduleEvent[]; total: number }> {
      const sp = new URLSearchParams();
      sp.set('from', params.from);
      sp.set('to', params.to);
      if (params.eventType) sp.set('eventType', params.eventType);
      if (params.jobId) sp.set('jobId', params.jobId);
      if (params.mine) sp.set('mine', 'true');
      if (params.assignedToUserId) sp.set('assignedToUserId', params.assignedToUserId);
      if (params.limit != null) sp.set('limit', String(params.limit));
      return fetchApi(`/schedule/events?${sp}`);
    },

    // -- Notifications --

    getNotifications(params?: {
      entityType?: string;
      isRead?: boolean;
      page?: number;
      limit?: number;
    }): Promise<import('@/types/api').PaginatedResponse<import('@/types/api').AppNotification>> {
      const sp = new URLSearchParams();
      if (params?.entityType) sp.set('entityType', params.entityType);
      if (params?.isRead !== undefined) sp.set('isRead', String(params.isRead));
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      return fetchApi(`/notifications?${sp}`);
    },

    getUnreadNotificationCount(): Promise<{ count: number }> {
      return fetchApi('/notifications/unread-count');
    },

    getUnreadEntityIds(entityType: string): Promise<string[]> {
      return fetchApi(`/notifications/unread-entity-ids?entityType=${entityType}`);
    },

    markNotificationRead(id: string): Promise<{ ok: boolean }> {
      return fetchApi(`/notifications/${id}/read`, { method: 'PATCH' });
    },

    markEntityNotificationsRead(
      entityType: string,
      entityId: string,
    ): Promise<{ updated: number }> {
      return fetchApi(`/notifications/entity/${entityType}/${entityId}/read`, {
        method: 'PATCH',
      });
    },

    // -- Activities --

    getActivities(params: {
      entityType: string;
      entityId: string;
      page?: number;
      limit?: number;
    }): Promise<{ data: EntityActivity[]; total: number }> {
      const sp = new URLSearchParams();
      sp.set('entityType', params.entityType);
      sp.set('entityId', params.entityId);
      if (params.page != null) sp.set('page', String(params.page));
      if (params.limit != null) sp.set('limit', String(params.limit));
      return fetchApi(`/activities?${sp}`);
    },

    // -- Filesystem --

    /** @deprecated Prefer getCompanyFilesystem */
    getFilesystem(): Promise<FilesystemResponse | null> {
      return fetchApi<FilesystemResponse | null>('/filesystems');
    },

    getCompanyFilesystem(): Promise<FilesystemResponse | null> {
      return fetchApi<FilesystemResponse | null>('/filesystems/company');
    },

    getJobFilesystem(jobId: string): Promise<FilesystemResponse> {
      return fetchApi<FilesystemResponse>(`/filesystems/jobs/${jobId}`);
    },

    getFilesystemOverview(): Promise<FilesystemOverviewResponse> {
      return fetchApi<FilesystemOverviewResponse>('/filesystems/overview');
    },

    getFilesystemDefaults(): Promise<FilesystemDefaultsResponse> {
      return fetchApi<FilesystemDefaultsResponse>('/filesystems/defaults');
    },

    updateFilesystemDefaults(data: {
      defaultCompanyTemplateId?: string | null;
      defaultProjectTemplateId?: string | null;
    }): Promise<FilesystemDefaultsResponse> {
      return fetchApi<FilesystemDefaultsResponse>('/filesystems/defaults', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    setupJobFilesystem(
      jobId: string,
      templateId?: string,
    ): Promise<FilesystemResponse> {
      return fetchApi<FilesystemResponse>(`/filesystems/jobs/${jobId}/setup`, {
        method: 'POST',
        body: JSON.stringify(templateId ? { templateId } : {}),
      });
    },

    backfillProjectFilesystems(): Promise<{
      scanned: number;
      created: number;
      errors: Array<{ jobId: string; error: string }>;
    }> {
      return fetchApi('/filesystems/backfill-project-filesystems', {
        method: 'POST',
      });
    },

    setupFilesystem(templateId: string): Promise<FilesystemResponse> {
      return fetchApi<FilesystemResponse>('/filesystems/setup', {
        method: 'POST',
        body: JSON.stringify({ templateId }),
      });
    },

    setupFilesystemDefault(): Promise<FilesystemResponse> {
      return fetchApi<FilesystemResponse>('/filesystems/setup-default', {
        method: 'POST',
      });
    },

    getFilesystemTemplates(kind?: FilesystemTemplateKind): Promise<{ data: FilesystemTemplate[] }> {
      const q = kind ? `?kind=${kind}` : '';
      return fetchApi<{ data: FilesystemTemplate[] }>(`/filesystem-templates${q}`);
    },

    getFilesystemTemplate(id: string): Promise<FilesystemTemplate> {
      return fetchApi<FilesystemTemplate>(`/filesystem-templates/${id}`);
    },

    createFilesystemTemplate(data: {
      name: string;
      description?: string;
      kind?: FilesystemTemplateKind;
    }): Promise<FilesystemTemplate> {
      return fetchApi<FilesystemTemplate>('/filesystem-templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateFilesystemTemplate(
      id: string,
      data: { name?: string; description?: string },
    ): Promise<FilesystemTemplate> {
      return fetchApi<FilesystemTemplate>(`/filesystem-templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    archiveFilesystemTemplate(id: string): Promise<{ archived: boolean }> {
      return fetchApi<{ archived: boolean }>(`/filesystem-templates/${id}`, {
        method: 'DELETE',
      });
    },

    bulkUpsertTemplateCategories(
      templateId: string,
      categories: FlatCategoryUpsert[],
    ): Promise<FilesystemTemplateCategory[]> {
      return fetchApi<FilesystemTemplateCategory[]>(`/filesystem-templates/${templateId}/categories`, {
        method: 'PUT',
        body: JSON.stringify({ categories }),
      });
    },

    bulkUpsertFilesystemCategories(
      filesystemId: string,
      categories: FlatCategoryUpsert[],
    ): Promise<FilesystemCategory[]> {
      return fetchApi<FilesystemCategory[]>(`/filesystems/${filesystemId}/categories`, {
        method: 'PUT',
        body: JSON.stringify({ categories }),
      });
    },

    generateCategoryDescription(data: {
      categoryName: string;
      siblingCategories: Array<{ name: string; description?: string | null }>;
    }): Promise<{ description: string }> {
      return fetchApi<{ description: string }>('/filesystems/generate-category-description', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getArtifactExportSettings(
      scope: ArtifactExportScope = 'company',
    ): Promise<ArtifactExportSettings> {
      const qs = scope === 'company' ? '' : `?scope=${encodeURIComponent(scope)}`;
      return fetchApi<ArtifactExportSettings>(`/filesystems/artifact-export${qs}`);
    },

    updateArtifactExportSettings(
      data: ArtifactExportSettings & {
        scope?: ArtifactExportScope;
        templateId?: string;
      },
    ): Promise<ArtifactExportSettings> {
      return fetchApi<ArtifactExportSettings>('/filesystems/artifact-export', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // -- Document pipelines --

    listPipelines(filesystemId: string): Promise<PipelineResponse[]> {
      return fetchApi<PipelineResponse[]>(`/pipelines/filesystem/${filesystemId}`);
    },

    getPipeline(id: string): Promise<PipelineResponse & { steps: PipelineStepResponse[] }> {
      return fetchApi<PipelineResponse & { steps: PipelineStepResponse[] }>(`/pipelines/${id}`);
    },

    createPipeline(data: {
      filesystemId?: string | null;
      categoryId?: string | null;
      name: string;
      description?: string | null;
      isActive?: boolean;
      triggerOn?: string;
      sortOrder?: number;
    }): Promise<PipelineResponse> {
      return fetchApi<PipelineResponse>('/pipelines', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updatePipeline(
      id: string,
      data: {
        name?: string;
        description?: string | null;
        isActive?: boolean;
        triggerOn?: string;
        sortOrder?: number;
        categoryId?: string | null;
      },
    ): Promise<PipelineResponse> {
      return fetchApi<PipelineResponse>(`/pipelines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    deletePipeline(id: string): Promise<{ deleted: boolean }> {
      return fetchApi<{ deleted: boolean }>(`/pipelines/${id}`, { method: 'DELETE' });
    },

    savePipelineSteps(
      id: string,
      steps: PipelineStepInput[],
    ): Promise<PipelineStepResponse[]> {
      return fetchApi<PipelineStepResponse[]>(`/pipelines/${id}/steps`, {
        method: 'PUT',
        body: JSON.stringify({ steps }),
      });
    },

    listPipelineRuns(documentId: string): Promise<PipelineRunResponse[]> {
      return fetchApi<PipelineRunResponse[]>(`/pipelines/document/${documentId}/runs`);
    },

    updateCategory(
      filesystemId: string,
      categoryId: string,
      data: Partial<FilesystemCategory>,
    ): Promise<FilesystemCategory> {
      return fetchApi<FilesystemCategory>(`/filesystems/${filesystemId}/categories/${categoryId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    addCategory(
      filesystemId: string,
      data: { displayName: string; slug: string; parentCategoryId?: string; sortOrder?: number },
    ): Promise<FilesystemCategory> {
      return fetchApi<FilesystemCategory>(`/filesystems/${filesystemId}/categories`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    deleteCategory(filesystemId: string, categoryId: string): Promise<void> {
      return fetchApi<void>(`/filesystems/${filesystemId}/categories/${categoryId}`, {
        method: 'DELETE',
      });
    },

    // -- Documents --

    getDocuments(params?: DocumentListParams): Promise<{ data: FSDocument[]; total: number }> {
      const sp = new URLSearchParams();
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      if (params?.search) sp.set('search', params.search);
      if (params?.categoryId) sp.set('categoryId', params.categoryId);
      if (params?.uncategorised) sp.set('uncategorised', 'true');
      if (params?.relatedRecordType) sp.set('relatedRecordType', params.relatedRecordType);
      if (params?.relatedRecordId) sp.set('relatedRecordId', params.relatedRecordId);
      if (params?.filesystemId) sp.set('filesystemId', params.filesystemId);
      if (params?.jobId) sp.set('jobId', params.jobId);
      if (params?.uploadStatus) sp.set('uploadStatus', params.uploadStatus);
      if (params?.sort) sp.set('sort', params.sort);
      return fetchApi<{ data: FSDocument[]; total: number }>(`/documents?${sp}`);
    },

    getDocument(id: string): Promise<FSDocument> {
      return fetchApi<FSDocument>(`/documents/${id}`);
    },

    getDocumentUploadUrl(data: UploadUrlRequest): Promise<UploadUrlApiResponse> {
      return fetchApi<UploadUrlApiResponse>('/documents/upload-url', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getDocumentUploadUrls(data: { files: UploadUrlRequest[] }): Promise<{ uploads: UploadUrlApiResponse[] }> {
      return fetchApi<{ uploads: UploadUrlApiResponse[] }>('/documents/upload-urls', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    markUploadComplete(documentId: string): Promise<FSDocument> {
      return fetchApi<FSDocument>('/documents/upload-complete', {
        method: 'POST',
        body: JSON.stringify({ documentId }),
      });
    },

    assignDocumentCategory(documentId: string, categoryId: string | null): Promise<FSDocument> {
      return fetchApi<FSDocument>(`/documents/${documentId}/category`, {
        method: 'PATCH',
        body: JSON.stringify({ categoryId }),
      });
    },

    bulkAssignCategory(documentIds: string[], categoryId: string | null): Promise<void> {
      return fetchApi<void>('/documents/bulk-category', {
        method: 'POST',
        body: JSON.stringify({ documentIds, categoryId }),
      });
    },

    getDocumentDownloadUrl(documentId: string): Promise<{ downloadUrl: string }> {
      return fetchApi<{ downloadUrl: string }>(`/documents/${documentId}/download-url`);
    },

    archiveDocument(documentId: string): Promise<void> {
      return fetchApi<void>(`/documents/${documentId}/archive`, { method: 'POST' });
    },

    deleteDocument(documentId: string): Promise<void> {
      return fetchApi<void>(`/documents/${documentId}`, { method: 'DELETE' });
    },

    // -- Document generation --

    generateDocument(params: {
      documentType: string;
      entityId?: string;
      templateId?: string;
      filesystemDocumentId?: string;
      destinationCategoryId?: string;
    }): Promise<GeneratedDocument> {
      return fetchApi<GeneratedDocument>('/generated-documents/generate', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },

    getGeneratedDocument(id: string): Promise<GeneratedDocument> {
      return fetchApi<GeneratedDocument>(`/generated-documents/${id}`);
    },

    getGeneratedDocumentDownloadUrl(
      id: string,
      format?: 'pdf' | 'docx',
    ): Promise<{ url: string; format: string }> {
      const q = format ? `?format=${format}` : '';
      return fetchApi<{ url: string; format: string }>(
        `/generated-documents/${id}/download${q}`,
      );
    },

    // -- Document generation templates (scenario → filesystem .docx) --

    getDocumentTemplateSettings(): Promise<DocumentTemplateSetting[]> {
      return fetchApi<DocumentTemplateSetting[]>('/document-templates');
    },

    getDocumentTemplatesFolder(): Promise<DocumentTemplatesFolderSetting> {
      return fetchApi<DocumentTemplatesFolderSetting>('/document-templates/folder');
    },

    setDocumentTemplatesFolder(
      filesystemCategoryId: string | null,
    ): Promise<DocumentTemplatesFolderSetting> {
      return fetchApi<DocumentTemplatesFolderSetting>('/document-templates/folder', {
        method: 'PUT',
        body: JSON.stringify({ filesystemCategoryId }),
      });
    },

    assignDocumentTemplate(
      documentType: string,
      filesystemDocumentId: string,
    ): Promise<DocumentTemplateRow> {
      return fetchApi<DocumentTemplateRow>(`/document-templates/${documentType}`, {
        method: 'PUT',
        body: JSON.stringify({ filesystemDocumentId }),
      });
    },

    clearDocumentTemplate(documentType: string): Promise<{ cleared: boolean }> {
      return fetchApi<{ cleared: boolean }>(`/document-templates/${documentType}`, {
        method: 'DELETE',
      });
    },

    // ── MCP Integrations ──

    listMcpIntegrations(): Promise<import('@/types/api').McpIntegration[]> {
      return fetchApi('/mcp-integrations');
    },

    createMcpIntegration(body: Record<string, unknown>): Promise<import('@/types/api').McpIntegration> {
      return fetchApi('/mcp-integrations', { method: 'POST', body: JSON.stringify(body) });
    },

    getMcpIntegration(id: string): Promise<import('@/types/api').McpIntegration> {
      return fetchApi(`/mcp-integrations/${id}`);
    },

    updateMcpIntegration(id: string, body: Record<string, unknown>): Promise<import('@/types/api').McpIntegration> {
      return fetchApi(`/mcp-integrations/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },

    deleteMcpIntegration(id: string): Promise<{ ok: boolean }> {
      return fetchApi(`/mcp-integrations/${id}`, { method: 'DELETE' });
    },

    discoverMcpServer(body: { url: string }): Promise<Record<string, unknown>> {
      return fetchApi('/mcp-integrations/discover', { method: 'POST', body: JSON.stringify(body) });
    },

    testMcpConnectionStateless(body: Record<string, unknown>): Promise<{ ok: boolean; toolCount?: number; error?: string }> {
      return fetchApi('/mcp-integrations/test-connection', { method: 'POST', body: JSON.stringify(body) });
    },

    listMcpConnections(): Promise<import('@/types/api').McpConnection[]> {
      return fetchApi('/mcp-connections');
    },

    createMcpConnection(body: Record<string, unknown>): Promise<import('@/types/api').McpConnection> {
      return fetchApi('/mcp-connections', { method: 'POST', body: JSON.stringify(body) });
    },

    testMcpConnection(id: string): Promise<{ ok: boolean; toolCount?: number; error?: string }> {
      return fetchApi(`/mcp-connections/${id}/test`, { method: 'POST' });
    },

    disconnectMcpConnection(id: string): Promise<{ ok: boolean }> {
      return fetchApi(`/mcp-connections/${id}/disconnect`, { method: 'POST' });
    },

    initiateMcpOAuth(body: { integrationId: string; redirectUri: string }): Promise<{ authorizeUrl: string; stateId: string }> {
      return fetchApi('/mcp-connections/initiate-oauth', { method: 'POST', body: JSON.stringify(body) });
    },

    listMcpTools(): Promise<import('@/lib/ai/types').McpToolGroupResponse[]> {
      return fetchApi('/mcp-tools');
    },

    refreshMcpTools(body: { connectionId: string }): Promise<{ ok: boolean; toolCount?: number; error?: string }> {
      return fetchApi('/mcp-tools/refresh', { method: 'POST', body: JSON.stringify(body) });
    },

    getGuidesByRoute(route: string): Promise<
      Array<{
        slug: string;
        title: string;
        description: string | null;
        routes: string[];
        content?: string;
      }>
    > {
      const qs = new URLSearchParams({ route });
      return fetchApi(`/guides/by-route?${qs}`);
    },

    getGuideContent(slug: string): Promise<{
      slug?: string;
      title?: string;
      content: string | null;
    }> {
      return fetchApi(`/guides/${encodeURIComponent(slug)}/content`);
    },

    // ── AI Chat & Conversations ──

    listConversations(search?: string): Promise<import('@/types/api').ChatConversationSummary[]> {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      return fetchApi(`/conversations${qs}`);
    },

    getConversation(id: string): Promise<import('@/types/api').ChatConversationDetail> {
      return fetchApi(`/conversations/${id}`);
    },

    createConversation(body?: {
      title?: string;
      id?: string;
      agentId?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    }): Promise<{ id: string }> {
      return fetchApi('/conversations', { method: 'POST', body: JSON.stringify(body ?? {}) });
    },

    updateConversation(
      id: string,
      body: {
        title?: string;
        messages?: unknown[];
        pinned?: boolean;
        relatedEntityType?: string;
        relatedEntityId?: string;
      },
    ): Promise<import('@/types/api').ChatConversationDetail> {
      return fetchApi(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },

    deleteConversation(id: string): Promise<{ deleted: boolean }> {
      return fetchApi(`/conversations/${id}`, { method: 'DELETE' });
    },

    shareConversation(id: string, expiresInDays?: number): Promise<{ token: string; expiresAt: string | null }> {
      return fetchApi(`/conversations/${id}/share`, {
        method: 'POST',
        body: JSON.stringify({ expiresInDays }),
      });
    },

    getSharedConversation(token: string): Promise<import('@/types/api').ChatConversationDetail | null> {
      return fetchApi(`/conversations/shared/${token}`);
    },

    // ── AI Chat Feedback ──

    submitChatFeedback(body: {
      conversationId: string;
      messageId: string;
      rating: 'positive' | 'negative';
      categories?: string[];
      comment?: string;
    }): Promise<unknown> {
      return fetchApi('/ai-chat/feedback', { method: 'POST', body: JSON.stringify(body) });
    },

    listChatFeedback(conversationId: string): Promise<unknown[]> {
      return fetchApi(`/ai-chat/feedback/${conversationId}`);
    },

    // ── Canvas Artifacts ──

    createCanvasArtifact(body: {
      conversationId: string;
      title: string;
      contentType?: string;
      content: string;
      language?: string;
      componentName?: string;
      componentProps?: Record<string, unknown>;
    }): Promise<{ id: string }> {
      return fetchApi('/ai-chat/canvas', { method: 'POST', body: JSON.stringify(body) });
    },

    getCanvasArtifact(id: string): Promise<unknown> {
      return fetchApi(`/ai-chat/canvas/${id}`);
    },

    updateCanvasArtifact(id: string, content: string): Promise<unknown> {
      return fetchApi(`/ai-chat/canvas/${id}`, { method: 'PUT', body: JSON.stringify({ content }) });
    },

    deleteCanvasArtifact(id: string): Promise<{ deleted: boolean }> {
      return fetchApi(`/ai-chat/canvas/${id}`, { method: 'DELETE' });
    },

    listCanvasArtifacts(conversationId: string): Promise<unknown[]> {
      return fetchApi(`/ai-chat/canvas/conversation/${conversationId}`);
    },

    getAiChatModels(): Promise<Record<string, Array<{ id: string; label: string }>>> {
      return fetchApi('/ai-chat/models');
    },

    // ── Agents ──

    listAgents(params?: { type?: string; chatEnabled?: boolean }): Promise<import('@/lib/ai/types').Agent[]> {
      const sp = new URLSearchParams();
      if (params?.type) sp.set('type', params.type);
      if (params?.chatEnabled !== undefined) sp.set('chatEnabled', String(params.chatEnabled));
      const qs = sp.toString();
      return fetchApi(`/agents${qs ? `?${qs}` : ''}`);
    },

    getAgent(id: string): Promise<import('@/lib/ai/types').Agent> {
      return fetchApi(`/agents/${id}`);
    },

    createAgent(body: import('@/types/api').CreateAgentPayload): Promise<import('@/lib/ai/types').Agent> {
      return fetchApi('/agents', { method: 'POST', body: JSON.stringify(body) });
    },

    updateAgent(id: string, body: Record<string, unknown>): Promise<import('@/lib/ai/types').Agent> {
      return fetchApi(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    },

    deleteAgent(id: string): Promise<{ ok: boolean }> {
      return fetchApi(`/agents/${id}`, { method: 'DELETE' });
    },

    // ── Skills ──

    listSkills(): Promise<import('@/lib/ai/types').Skill[]> {
      return fetchApi('/skills');
    },

    getSkill(id: string): Promise<import('@/lib/ai/types').Skill> {
      return fetchApi(`/skills/${id}`);
    },

    createSkill(body: import('@/types/api').CreateSkillPayload): Promise<import('@/lib/ai/types').Skill> {
      return fetchApi('/skills', { method: 'POST', body: JSON.stringify(body) });
    },

    updateSkill(id: string, body: Record<string, unknown>): Promise<import('@/lib/ai/types').Skill> {
      return fetchApi(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    },

    deleteSkill(id: string): Promise<{ success: boolean }> {
      return fetchApi(`/skills/${id}`, { method: 'DELETE' });
    },

    testSkillMatch(body: { message: string; agentId?: string; topK?: number }): Promise<{
      matches: Array<{ skill: import('@/lib/ai/types').Skill; similarity: number; source: string }>;
      embeddingTimeMs: number;
      searchTimeMs: number;
    }> {
      return fetchApi('/skills/test-match', { method: 'POST', body: JSON.stringify(body) });
    },

    // ── Capability packs ──

    listCapabilityPacks(): Promise<CapabilityPackCatalogEntry[]> {
      return fetchApi('/capability-packs');
    },

    listInstalledCapabilityPacks(): Promise<CapabilityPackInstall[]> {
      return fetchApi('/capability-packs/installed');
    },

    listCapabilityPackUploads(): Promise<CapabilityPackUploadSummary[]> {
      return fetchApi('/capability-packs/uploads');
    },

    installCapabilityPack(body: {
      packId?: string;
      version?: string;
      uploadId?: string;
    }): Promise<{ installId: string }> {
      return fetchApi('/capability-packs/install', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    upgradeCapabilityPack(installId: string): Promise<{ installId: string }> {
      return fetchApi(`/capability-packs/upgrade/${installId}`, { method: 'POST' });
    },

    uninstallCapabilityPack(
      installId: string,
      opts?: { force?: boolean },
    ): Promise<{ ok: boolean }> {
      const qs = opts?.force ? '?force=true' : '';
      return fetchApi(`/capability-packs/${installId}${qs}`, { method: 'DELETE' });
    },

    getCapabilityPackDrift(installId: string): Promise<CapabilityPackDriftItem[]> {
      return fetchApi(`/capability-packs/drift/${installId}`);
    },

    previewCapabilityPack(params: {
      packId?: string;
      version?: string;
      uploadId?: string;
    }): Promise<CapabilityPackPreview> {
      const sp = new URLSearchParams();
      if (params.packId) sp.set('packId', params.packId);
      if (params.version) sp.set('version', params.version);
      if (params.uploadId) sp.set('uploadId', params.uploadId);
      return fetchApi(`/capability-packs/preview?${sp.toString()}`);
    },

    async uploadCapabilityPack(file: File): Promise<{
      uploadId: string;
      packId: string;
      version: string;
    }> {
      const form = new FormData();
      form.append('file', file);
      const headers: Record<string, string> = {};
      if (options?.token) headers.Authorization = `Bearer ${options.token}`;
      if (options?.tenantId) headers['x-tenant-id'] = options.tenantId;
      const base = getApiBaseUrl().replace(/\/$/, '');
      const res = await fetchWithTransientRetry(
        `${base}/capability-packs/upload`,
        {
          method: 'POST',
          headers,
          body: form,
          ...(typeof window === 'undefined' ? { cache: 'no-store' as const } : {}),
        },
        { logLabel: 'frontend:api-client:uploadCapabilityPack' },
      );
      return handleResponse(res);
    },

    // ── AI Audit ──

    getAiAuditLog(params?: {
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
      model?: string;
      status?: string;
      page?: number;
      limit?: number;
    }): Promise<{ rows: import('@/lib/ai/types').AiAuditRecord[]; total: number }> {
      const sp = new URLSearchParams();
      if (params?.userId) sp.set('userId', params.userId);
      if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
      if (params?.dateTo) sp.set('dateTo', params.dateTo);
      if (params?.model) sp.set('model', params.model);
      if (params?.status) sp.set('status', params.status);
      if (params?.page != null) sp.set('page', String(params.page));
      if (params?.limit != null) sp.set('limit', String(params.limit));
      return fetchApi(`/ai-chat/audit?${sp}`);
    },

    getAiAuditDetail(id: string): Promise<import('@/lib/ai/types').AiAuditRecord> {
      return fetchApi(`/ai-chat/audit/${id}`);
    },

    getConversationAudit(conversationId: string): Promise<import('@/lib/ai/types').AiAuditRecord[]> {
      return fetchApi(`/ai-chat/audit/conversation/${conversationId}`);
    },

    // ── Admin users ──

    listOrgUsers(): Promise<import('@/types/api').OrgMember[]> {
      return fetchApi('/admin/users');
    },

    listOrgRoles(): Promise<import('@/types/api').AvailableRole[]> {
      return fetchApi('/admin/users/roles');
    },

    inviteOrgUser(
      body: import('@/types/api').InviteUserPayload,
    ): Promise<import('@/types/api').OrgMember> {
      return fetchApi('/admin/users/invite', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    updateOrgUserRoles(
      userId: string,
      roles: string[],
    ): Promise<import('@/types/api').OrgMember> {
      return fetchApi(`/admin/users/${userId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles }),
      });
    },

    updateOrgUserStatus(
      userId: string,
      status: 'Active' | 'Disabled',
    ): Promise<import('@/types/api').OrgMember> {
      return fetchApi(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    removeOrgUser(userId: string): Promise<{ ok: boolean }> {
      return fetchApi(`/admin/users/${userId}`, { method: 'DELETE' });
    },

    listRoles(scope?: string): Promise<import('@/types/api').RoleDef[]> {
      const qs = scope ? `?scope=${encodeURIComponent(scope)}` : '';
      return fetchApi(`/admin/roles${qs}`).then(mapRoleList);
    },

    createRole(input: {
      roleName: string;
      scope: string;
      label: string;
      description?: string;
      sortOrder?: number;
    }): Promise<import('@/types/api').RoleDef> {
      return fetchApi('/admin/roles', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then(mapRole);
    },

    deleteRole(roleId: string): Promise<{ ok: boolean }> {
      return fetchApi(`/admin/roles/${encodeURIComponent(roleId)}`, {
        method: 'DELETE',
      });
    },

    listPermissions(opts?: {
      category?: string;
      scope?: string;
    }): Promise<import('@/types/api').PermissionDef[]> {
      const params = new URLSearchParams();
      if (opts?.category) params.set('category', opts.category);
      if (opts?.scope) params.set('scope', opts.scope);
      const qs = params.toString() ? `?${params}` : '';
      return fetchApi(`/admin/permissions${qs}`).then(mapPermissionList);
    },

    getRolePermissions(
      roleId: string,
    ): Promise<import('@/types/api').PermissionDef[]> {
      return fetchApi(
        `/admin/roles/${encodeURIComponent(roleId)}/permissions`,
      ).then(mapPermissionList);
    },

    setRolePermissions(
      roleId: string,
      permissionIds: string[],
    ): Promise<unknown> {
      return fetchApi(
        `/admin/roles/${encodeURIComponent(roleId)}/permissions`,
        {
          method: 'PUT',
          body: JSON.stringify({ permissionIds }),
        },
      );
    },

    // -- RFQ Send Requests --

    listRfqSendRequests(rfqId: string): Promise<RfqSendRequestListItem[]> {
      return fetchApi<RfqSendRequestListItem[]>(`/rfqs/${rfqId}/send-requests`);
    },

    getRfqSendRequest(rfqId: string, requestId: string): Promise<RfqSendRequestDetail> {
      return fetchApi<RfqSendRequestDetail>(`/rfqs/${rfqId}/send-requests/${requestId}`);
    },

    createRfqSendRequest(
      rfqId: string,
      body: {
        recipients: Array<{ contactId?: string; name: string; email: string }>;
        generatedDocumentId: string;
        emailSubject?: string;
        emailBodyHtml?: string;
        emailBodyText?: string;
      },
    ): Promise<RfqSendRequestDetail> {
      return fetchApi<RfqSendRequestDetail>(`/rfqs/${rfqId}/send-requests`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    retryRfqSendRequest(
      rfqId: string,
      requestId: string,
      body: { recipients: Array<{ recipientId: string; email?: string }> },
    ): Promise<RfqSendRequestDetail> {
      return fetchApi<RfqSendRequestDetail>(`/rfqs/${rfqId}/send-requests/${requestId}/retry`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  };
}

// -- Filesystem types --

/** Per-category display/behaviour settings stored in the `config` jsonb column. */
export interface CategoryConfig {
  color?: string | null;
  retentionDays?: number | null;
  /** Opt-in: also run filesystem-root upload pipelines for files already in this folder. */
  runFilesystemPipelinesOnUpload?: boolean;
  [key: string]: unknown;
}

export interface FilesystemCategory {
  id: string;
  filesystemId: string;
  parentCategoryId: string | null;
  displayName: string;
  description: string | null;
  slug: string;
  config: CategoryConfig;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FilesystemResponse {
  id: string;
  tenantId: string;
  name: string;
  kind?: FilesystemTemplateKind;
  jobId?: string | null;
  sourceTemplateId: string | null;
  categories: FilesystemCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface FilesystemOverviewProject {
  jobId: string;
  jobLabel: string;
  /** Present when a project FS already exists; null until folders are lazy-loaded/created. */
  filesystem: FilesystemResponse | null;
}

export interface FilesystemOverviewResponse {
  company: FilesystemResponse | null;
  projects: FilesystemOverviewProject[];
}

export interface FilesystemDefaultsResponse {
  defaultCompanyTemplateId: string | null;
  defaultProjectTemplateId: string | null;
}

export type FilesystemTemplateKind = 'company' | 'project';

export interface FilesystemTemplate {
  id: string;
  tenantId?: string | null;
  name: string;
  description: string | null;
  /** company = org filesystem; project = per-job filesystem */
  kind?: FilesystemTemplateKind;
  isDefault: boolean;
  categories?: FilesystemTemplateCategory[];
  pipelines?: FilesystemTemplatePipeline[];
  createdAt: string;
}

export interface FilesystemTemplateCategory {
  id: string;
  templateId: string;
  parentCategoryId: string | null;
  displayName: string;
  description: string | null;
  slug: string;
  config: CategoryConfig;
  sortOrder: number;
}

export interface FilesystemTemplatePipelineStep {
  id: string;
  pipelineId: string;
  agentId: string;
  stepOrder: number;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface FilesystemTemplatePipeline {
  id: string;
  templateId: string;
  templateCategoryId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerOn: string;
  sortOrder: number;
  steps?: FilesystemTemplatePipelineStep[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Client-side nested representation of a category tree, built from the flat
 * `FilesystemCategory[]` / `FilesystemTemplateCategory[]` arrays returned by the API.
 * Used by CategoryTreeEditor / FilesystemEditorPanel for editing, then flattened
 * back to a flat list before saving via bulkUpsert*Categories.
 */
export interface FilesystemCategoryNode {
  id?: string;
  parentCategoryId?: string | null;
  displayName: string;
  description?: string | null;
  slug: string;
  config?: CategoryConfig;
  sortOrder: number;
  children?: FilesystemCategoryNode[];
}

/** Flat category payload sent to the bulk-upsert (PUT .../categories) endpoints. */
export interface FlatCategoryUpsert {
  id?: string;
  parentCategoryId?: string | null;
  displayName: string;
  description?: string | null;
  slug: string;
  config?: CategoryConfig;
  sortOrder: number;
}

// -- Artifact export defaults --

export type ArtifactContentType = 'markdown' | 'code' | 'json' | 'html' | 'image';

export type ArtifactExportScope = 'company' | 'project';

/**
 * Company: category UUIDs. Project: category slugs in the same fields.
 */
export interface ArtifactExportSettings {
  defaultCategoryId?: string | null;
  categoryByContentType?: Partial<Record<ArtifactContentType, string>>;
  fileNameTemplate?: string;
}

// -- Document pipelines --

export interface PipelineStepInput {
  agentId: string;
  stepOrder: number;
  config?: Record<string, unknown>;
}

export interface PipelineStepResponse extends PipelineStepInput {
  id: string;
  pipelineId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineResponse {
  id: string;
  tenantId: string;
  filesystemId: string | null;
  categoryId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerOn: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRunStepResponse {
  id: string;
  runId: string;
  stepId: string | null;
  agentId: string;
  stepOrder: number;
  status: string;
  error: string | null;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PipelineRunResponse {
  id: string;
  pipelineId: string;
  documentId: string;
  tenantId: string;
  status: string;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  steps?: PipelineRunStepResponse[];
}

export interface FSDocument {
  id: string;
  tenantId: string;
  filesystemCategoryId: string | null;
  relatedRecordType: string | null;
  relatedRecordId: string | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number | null;
  gcsBucket: string;
  gcsObjectPath: string;
  uri: string | null;
  thumbnailUri: string | null;
  uploadStatus: string;
  pipelineStatus?: string | null;
  pipelineError?: string | null;
  sourceSystem: string;
  uploadedByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplateRow {
  id: string;
  tenantId: string;
  documentType: string;
  name: string;
  s3Key: string | null;
  filesystemDocumentId: string | null;
  version: number;
  isDefault: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplateSetting {
  documentType: string;
  label: string;
  description: string;
  template: DocumentTemplateRow | null;
  filesystemDocument: {
    id: string;
    fileName: string;
    mimeType: string;
    uploadStatus: string;
  } | null;
}

export interface DocumentTemplatesFolderInfo {
  id: string;
  displayName: string;
  slug: string;
  path: string;
}

export interface DocumentTemplatesFolderSetting {
  filesystemCategoryId: string | null;
  folder: DocumentTemplatesFolderInfo | null;
}

export interface GeneratedDocument {
  id: string;
  tenantId: string;
  documentType: string;
  entityId: string;
  entityType: string;
  templateId: string | null;
  s3KeyPdf: string;
  s3KeyDocx: string | null;
  generatedBy: string | null;
  trigger: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  createdAt: string;
}

export interface DocumentListParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  uncategorised?: boolean;
  relatedRecordType?: string;
  relatedRecordId?: string;
  filesystemId?: string;
  jobId?: string;
  uploadStatus?: string;
  sort?: string;
}

export interface UploadUrlRequest {
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  relatedRecordType?: string;
  relatedRecordId?: string;
  categoryId?: string;
  filesystemId?: string;
  jobId?: string;
}

export interface UploadUrlApiResponse {
  documentId: string;
  uploadUrl: string;
  storageKey: string;
}

// -- Cross-tenant PO/WO types --

export interface CapturePoIssuer {
  abn?: string;
  legalName?: string;
  tradingName?: string;
  email?: string;
  phone?: string;
  organisationId?: string;
}

export interface CapturePoRequest {
  issuer: CapturePoIssuer;
  purchaseOrderNumber: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
  scopeOfWork?: string;
  totalAmount?: number;
  jobId?: string;
  claimId?: string;
  sourceDocumentId?: string;
}

export interface CapturePoResponse {
  purchaseOrderId: string;
  workOrderId: string;
  issuerOrganisationId: string;
  issuerCreated: boolean;
}

export interface CaptureEstimateRequest {
  issuer: CapturePoIssuer;
  quoteNumber?: string;
  name: string;
  reference?: string;
  note?: string;
  quoteDate?: string;
  expiresInDays?: number;
  subTotal?: number;
  totalTax?: number;
  totalAmount?: number;
  jobId?: string;
  claimId?: string;
  rfqId?: string;
  sourceDocumentId?: string;
}

export interface CaptureEstimateResponse {
  quoteId: string;
  proposalId: string;
  issuerOrganisationId: string;
  issuerCreated: boolean;
}

export interface GhostOrganisation {
  id: string;
  name: string;
  slug: string;
  abn?: string | null;
  legalName?: string | null;
  tradingName?: string | null;
  primaryEmail?: string | null;
  emailDomain?: string | null;
  phone?: string | null;
  subscriptionStatus: string;
}

export interface OrganisationClaim {
  id: string;
  ghostOrganisationId: string;
  claimingTenantId: string;
  status: string;
  verificationMethod?: string | null;
  evidence: Record<string, unknown>;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApiClient = ReturnType<typeof createApiClient>;

// -- RFQ Send Request types --

export interface RfqSendRequestRecipientSummary {
  id: string;
  recipientName: string;
  recipientEmail: string;
  status: string;
}

export interface RfqSendRequestListItem {
  id: string;
  rfqId: string;
  status: string;
  initiatedBy: string | null;
  emailSubject: string;
  replyTo: string | null;
  recipientCount: number;
  recipients: RfqSendRequestRecipientSummary[];
  createdAt: string;
}

export interface RfqSendRequestRecipientDetail {
  id: string;
  contactId: string | null;
  recipientName: string;
  recipientEmail: string;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  retryCount: number;
}

export interface RfqSendRequestDetail {
  id: string;
  rfqId: string;
  status: string;
  initiatedBy: string | null;
  generatedDocId: string | null;
  emailSubject: string;
  emailBodyHtml: string;
  replyTo: string | null;
  recipients: RfqSendRequestRecipientDetail[];
  createdAt: string;
  updatedAt: string;
}
