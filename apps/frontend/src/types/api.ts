/**
 * API response types aligned with NestJS DTOs and database schema.
 * Use unknown where shape is uncertain.
 */

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface LookupRef {
  id: string;
  name?: string;
  externalReference?: string;
}

export interface AddressPayload {
  unitNumber?: string;
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
  country?: string;
}

export interface Claim {
  id: string;
  tenantId: string;
  claimNumber?: string | null;
  externalReference?: string | null;
  statusLookupId?: string | null;
  accountLookupId?: string | null;
  lodgementDate?: string | null;
  address?: AddressPayload | Record<string, unknown>;
  addressSuburb?: string | null;
  addressPostcode?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  policyNumber?: string | null;
  policyName?: string | null;
  policyDetails?: Record<string, unknown>;
  lossTypeLookupId?: string | null;
  lossSubtypeLookupId?: string | null;
  dateOfLoss?: string | null;
  incidentDescription?: string | null;
  apiPayload?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  status?: LookupRef;
  account?: LookupRef;
  jobs?: Job[];
}

export interface Job {
  id: string;
  tenantId: string;
  claimId: string;
  externalReference?: string | null;
  jobTypeLookupId: string;
  statusLookupId?: string | null;
  requestDate?: string | null;
  address?: AddressPayload | Record<string, unknown>;
  addressSuburb?: string | null;
  addressPostcode?: string | null;
  jobInstructions?: string | null;
  makeSafeRequired?: boolean | null;
  collectExcess?: boolean | null;
  excess?: string | null;
  apiPayload?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  status?: LookupRef;
  jobType?: LookupRef;
  claim?: Claim;
}

export interface Quote {
  id: string;
  tenantId: string;
  jobId?: string | null;
  claimId?: string | null;
  quoteNumber?: string | null;
  externalReference?: string | null;
  statusLookupId?: string | null;
  totalAmount?: string | null;
  quoteDate?: string | null;
  status?: LookupRef;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  jobId?: string | null;
  claimId?: string | null;
  purchaseOrderNumber?: string | null;
  externalId?: string | null;
  statusLookupId?: string | null;
  totalAmount?: string | null;
  vendorId?: string | null;
  status?: LookupRef;
  vendor?: LookupRef;
}

export interface Invoice {
  id: string;
  tenantId: string;
  purchaseOrderId: string;
  invoiceNumber?: string | null;
  statusLookupId?: string | null;
  totalAmount?: string | null;
  status?: LookupRef;
}

export interface Report {
  id: string;
  tenantId: string;
  jobId?: string | null;
  claimId?: string | null;
  reportTypeLookupId?: string | null;
  title?: string | null;
  reference?: string | null;
  status?: LookupRef;
  reportData?: Record<string, unknown>;
}

export interface Task {
  id: string;
  tenantId: string;
  jobId?: string | null;
  claimId?: string | null;
  name: string;
  description?: string | null;
  status?: string;
  assignedToUserId?: string | null;
}

export interface Message {
  id: string;
  tenantId: string;
  fromJobId?: string | null;
  toJobId?: string | null;
  subject?: string | null;
  body?: string | null;
  acknowledgedAt?: string | null;
  createdAt?: string;
}

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  externalReference?: string | null;
}

export interface Appointment {
  id: string;
  tenantId: string;
  jobId: string;
  name: string;
  location: string;
  startDate?: string;
  endDate?: string;
  status?: string | null;
}

/**
 * Provider identifier is the stable slug (e.g. 'crunchwork'), not a UUID.
 * Providers are hardcoded in `apps/api/src/modules/providers/provider-registry.ts`;
 * the `id` field mirrors `code` for historical URL compatibility.
 */
export interface ProviderSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  connectionCount: number;
  totalWebhookEvents: number;
  recentErrorCount: number;
  lastEventAt: string | null;
}

export interface Provider {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  connections: ProviderConnection[];
}

export interface ProviderConnection {
  id: string;
  tenantId: string;
  providerCode: string;
  name: string;
  environment: string;
  authType: string;
  baseUrl: string;
  baseApi: string | null;
  authUrl: string | null;
  clientIdentifier: string | null;
  providerTenantId: string | null;
  credentials: Record<string, unknown>;
  webhookSecret: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Connection summary returned by `GET /connections` — excludes sensitive fields
 * (credentials, webhookSecret, config) which are only returned by the detail
 * endpoint.
 */
export interface ConnectionSummary {
  id: string;
  tenantId: string;
  providerCode: string;
  providerName: string;
  providerIsActive: boolean;
  name: string;
  environment: string;
  isActive: boolean;
  clientIdentifier: string | null;
  providerTenantId: string | null;
  baseUrl: string;
  baseApi: string | null;
  authUrl: string | null;
  authType: string;
  createdAt: string;
  updatedAt: string;
  totalWebhookEvents: number;
  recentErrorCount: number;
  lastEventAt: string | null;
}

export interface ConnectionDetail extends ConnectionSummary {
  credentials: Record<string, unknown>;
  webhookSecret: string | null;
  config: Record<string, unknown>;
  lastSyncAt: string | null;
}

export interface WebhookEvent {
  id: string;
  externalEventId: string;
  tenantId: string | null;
  eventType: string;
  eventTimestamp: string;
  payloadEntityId: string | null;
  payloadTeamIds: unknown[];
  payloadTenantId: string | null;
  payloadClient: string | null;
  signatureHeader: string | null;
  hmacVerified: boolean | null;
  rawBodyJson: unknown;
  processingStatus: string;
  processingError: string | null;
  processedAt: string | null;
  connectionId: string | null;
  providerCode: string | null;
  providerEntityType: string | null;
  retryCount: number;
  createdAt: string;
}

export interface CreateConnectionPayload {
  name: string;
  environment: string;
  baseUrl: string;
  baseApi?: string;
  authUrl?: string;
  authType?: string;
  clientIdentifier?: string;
  providerTenantId?: string;
  credentials?: Record<string, unknown>;
  webhookSecret?: string;
  config?: Record<string, unknown>;
}

export interface UpdateConnectionPayload {
  name?: string;
  environment?: string;
  baseUrl?: string;
  baseApi?: string;
  authUrl?: string;
  authType?: string;
  clientIdentifier?: string;
  providerTenantId?: string;
  credentials?: Record<string, unknown>;
  webhookSecret?: string;
  config?: Record<string, unknown>;
}

export interface DashboardStats {
  totalClaims: number;
  totalJobs: number;
  jobsByStatus: { status: string; count: string }[];
  pendingApprovals: number;
  openInvoices: number;
  openTasks: number;
  recentJobCount: number;
}

export interface RecentActivity {
  id: string;
  type: string;
  entityId: string;
  timestamp: string;
  description: string;
}
