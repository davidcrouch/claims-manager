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
