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
  /** CW's canonical claim UUID (column `external_reference`; CW field `id`). */
  externalReference?: string | null;
  /** Insurer's own reference (column `external_claim_id`; CW field `externalReference`). */
  externalClaimId?: string | null;
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
  financialDetails?: Record<string, unknown>;
  vulnerabilityDetails?: Record<string, unknown>;
  contentionDetails?: Record<string, unknown>;
  /**
   * Catch-all JSONB bucket. Contains CW `customData` plus mapper-added keys
   * such as `cwUpdatedAtDate`, `maximumAccommodationDurationLimit`, and
   * `<field>Raw` fallbacks for string-form lookups. See
   * `docs/mapping/claims.md` §6.5.
   */
  customData?: Record<string, unknown>;
  lossTypeLookupId?: string | null;
  lossSubtypeLookupId?: string | null;
  dateOfLoss?: string | null;
  incidentDescription?: string | null;
  postalAddress?: string | null;
  abn?: string | null;
  vulnerableCustomer?: boolean | null;
  totalLoss?: boolean | null;
  contentiousClaim?: boolean | null;
  contentiousActivityFlag?: boolean | null;
  autoApprovalApplies?: boolean | null;
  contentsDamaged?: boolean | null;
  apiPayload?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  status?: LookupRef;
  account?: LookupRef;
  jobs?: Job[];
}

export interface VendorRef {
  id?: string;
  name?: string;
  externalReference?: string;
}

export interface Job {
  id: string;
  tenantId: string;
  claimId: string;
  parentClaimId?: string | null;
  parentJobId?: string | null;
  vendorId?: string | null;
  externalReference?: string | null;
  jobTypeLookupId: string;
  statusLookupId?: string | null;
  requestDate?: string | null;
  collectExcess?: boolean | null;
  excess?: string | null;
  makeSafeRequired?: boolean | null;
  address?: AddressPayload | Record<string, unknown>;
  addressSuburb?: string | null;
  addressPostcode?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  jobInstructions?: string | null;

  vendorSnapshot?: Record<string, unknown>;
  temporaryAccommodationDetails?: Record<string, unknown>;
  specialistDetails?: Record<string, unknown>;
  rectificationDetails?: Record<string, unknown>;
  auditDetails?: Record<string, unknown>;
  mobilityConsiderations?: Array<{ name?: string; externalReference?: string }>;

  apiPayload?: Record<string, unknown>;
  customData?: Record<string, unknown>;

  createdAt?: string;
  updatedAt?: string;

  status?: LookupRef;
  jobType?: LookupRef;
  claim?: Claim;
  vendor?: VendorRef;
}

export interface Attachment {
  id: string;
  tenantId?: string;
  relatedRecordType?: string;
  relatedRecordId?: string;
  title?: string | null;
  filename?: string | null;
  documentType?: string | null;
  fileUrl?: string | null;
  fileSize?: number | string | null;
  mimeType?: string | null;
  uploadedBy?: string | null;
  uploadedByName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Shape of the CW-style party bucket stored on `quotes.quote_to` /
 * `quote_for` / `quote_from`. Keys match `docs/mapping/quotes.md` §4.
 */
export interface QuotePartyPayload {
  name?: string;
  companyRegistrationNumber?: string;
  contactName?: string;
  clientReference?: string;
  phoneNumber?: string;
  email?: string;
  unitNumber?: string;
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  postCode?: string;
  state?: string;
  country?: string;
}

/** `quotes.schedule_info` bucket. See `docs/mapping/quotes.md` §6.2. */
export interface QuoteScheduleInfo {
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  reasonForVariation?: string;
}

/** `quotes.approval_info` bucket. See `docs/mapping/quotes.md` §6.3. */
export interface QuoteApprovalInfo {
  isAutoApproved?: boolean;
  statusType?: string;
  statusName?: string;
  quoteTypeName?: string;
  createdByName?: string;
  createdByExternalReference?: string;
  updatedByName?: string;
  updatedByExternalReference?: string;
}

export interface Quote {
  id: string;
  tenantId: string;
  jobId?: string | null;
  claimId?: string | null;
  /** CW quote UUID (column `external_reference`; CW field `id`). */
  externalReference?: string | null;
  quoteNumber?: string | null;
  name?: string | null;
  reference?: string | null;
  note?: string | null;
  statusLookupId?: string | null;
  quoteTypeLookupId?: string | null;
  quoteDate?: string | null;
  expiresInDays?: number | null;
  subTotal?: string | null;
  totalTax?: string | null;
  totalAmount?: string | null;
  quoteTo?: QuotePartyPayload | Record<string, unknown>;
  quoteFor?: QuotePartyPayload | Record<string, unknown>;
  quoteFrom?: QuotePartyPayload | Record<string, unknown>;
  scheduleInfo?: QuoteScheduleInfo | Record<string, unknown>;
  approvalInfo?: QuoteApprovalInfo | Record<string, unknown>;
  quoteToEmail?: string | null;
  quoteToName?: string | null;
  quoteForName?: string | null;
  estimatedStartDate?: string | null;
  estimatedCompletionDate?: string | null;
  isAutoApproved?: boolean | null;
  /**
   * Catch-all bucket. See `docs/mapping/quotes.md` §6.4 — contains CW
   * `customData` plus mapper-added keys such as `cwExternalReference`,
   * `cwCreatedAtDate`, `cwUpdatedAtDate`.
   */
  customData?: Record<string, unknown>;
  /** Full verbatim CW response. See `docs/mapping/quotes.md` §10. */
  apiPayload?: Record<string, unknown>;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  status?: LookupRef;
  quoteType?: LookupRef;
}

/**
 * Purchase Order — shape of the row returned by `GET /purchase-orders/:id`.
 *
 * Field-by-field mapping lives in `docs/mapping/purchase_orders.md`. The API
 * currently returns the raw `purchase_orders` row (no joins), so lookup names
 * for `status`, `purchaseOrderType`, and `vendor` must be read out of
 * `purchaseOrderPayload` until a join-aware DTO is added.
 */
export interface PurchaseOrder {
  id: string;
  tenantId: string;

  // §3 — parent / related entity resolution
  jobId?: string | null;
  claimId?: string | null;
  vendorId?: string | null;
  quoteId?: string | null;

  // §2 — identity
  externalId?: string | null;
  purchaseOrderNumber?: string | null;
  name?: string | null;

  // §4 — lookup FKs
  statusLookupId?: string | null;
  purchaseOrderTypeLookupId?: string | null;

  // §5 — service window (promoted columns)
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;

  // §7 — promoted scalars
  note?: string | null;
  totalAmount?: string | null;
  adjustedTotal?: string | null;
  adjustedTotalAdjustmentAmount?: string | null;

  // §6 — party buckets + promoted scalars
  poTo?: Record<string, unknown> | null;
  poFor?: Record<string, unknown> | null;
  poFrom?: Record<string, unknown> | null;
  poToEmail?: string | null;
  poForName?: string | null;

  // §5 / §8 — service window / allocation JSONB buckets
  serviceWindow?: Record<string, unknown> | null;
  adjustmentInfo?: Record<string, unknown> | null;
  allocationContext?: Record<string, unknown> | null;

  // §10 — verbatim CW payload (lossless fallback)
  purchaseOrderPayload?: Record<string, unknown> | null;

  // §2 — user references
  createdByUserId?: string | null;
  updatedByUserId?: string | null;

  // audit
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;

  // Optional joins (populated once the API adds them; currently undefined).
  status?: LookupRef;
  purchaseOrderType?: LookupRef;
  vendor?: LookupRef;
}

export interface Invoice {
  id: string;
  tenantId: string;
  purchaseOrderId: string;
  jobId?: string | null;
  invoiceNumber?: string | null;
  statusLookupId?: string | null;
  issueDate?: string | null;
  subTotal?: string | null;
  tax?: string | null;
  totalAmount?: string | null;
  excessAmount?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
  status?: LookupRef;
  reportType?: LookupRef;
  reportData?: Record<string, unknown>;
}

export interface Task {
  id: string;
  tenantId: string;
  jobId?: string | null;
  claimId?: string | null;
  name: string;
  description?: string | null;
  status?: string | LookupRef | null;
  taskType?: string | LookupRef | null;
  priority?: string | LookupRef | null;
  dueDate?: string | null;
  assignedToUserId?: string | null;
  assigneeName?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface AppointmentAttendee {
  id?: string;
  appointmentId?: string;
  attendeeType?: 'CONTACT' | 'USER' | string;
  contactId?: string | null;
  userId?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface Appointment {
  id: string;
  tenantId: string;
  jobId: string;
  name: string;
  location: string;
  appointmentType?: string | LookupRef | null;
  startDate?: string;
  endDate?: string;
  status?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  attendees?: AppointmentAttendee[];
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
