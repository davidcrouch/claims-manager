# 09 — Jobs Module

## Objective

Implement the Jobs module — the core operational entity. Jobs are children of claims and have the richest sub-resource graph (quotes, POs, tasks, messages, reports, appointments). The module proxies to Crunchwork and persists locally.

---

## Steps

### 9.1 Module Structure

```
src/modules/jobs/
├── jobs.module.ts
├── jobs.controller.ts
├── jobs.service.ts
├── jobs-sync.service.ts
├── dto/
│   ├── create-job.dto.ts
│   ├── update-job.dto.ts
│   ├── update-job-status.dto.ts
│   ├── job-query.dto.ts
│   └── job-response.dto.ts
├── mappers/
│   └── job.mapper.ts
└── interfaces/
    └── job.interface.ts
```

### 9.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/jobs` | Create job | Admin, Claims Manager, Insurance |
| `GET` | `/jobs` | List all jobs (local DB) | All authenticated |
| `GET` | `/jobs/:id` | Get job detail | All authenticated |
| `POST` | `/jobs/:id` | Update job | Admin, Claims Manager, Insurance, Vendor |
| `POST` | `/jobs/:id/status` | Update job status (Vendor) | Vendor |
| `GET` | `/jobs/:id/quotes` | List job quotes | All authenticated |
| `GET` | `/jobs/:id/purchase-orders` | List job POs | All authenticated |
| `GET` | `/jobs/:id/tasks` | List job tasks | All authenticated |
| `GET` | `/jobs/:id/messages` | List job messages | All authenticated |
| `GET` | `/jobs/:id/reports` | List job reports | All authenticated |
| `GET` | `/jobs/:id/invoices` | List job invoices | All authenticated |

### 9.3 Service Layer

```typescript
@Injectable()
export class JobsService {
  async create(params: { dto: CreateJobDto }): Promise<JobResponseDto>;
  async findAll(params: { query: JobQueryDto }): Promise<PaginatedResponse<JobResponseDto>>;
  async findOne(params: { id: string }): Promise<JobResponseDto>;
  async update(params: { id: string; dto: UpdateJobDto }): Promise<JobResponseDto>;
  async updateStatus(params: { id: string; dto: UpdateJobStatusDto }): Promise<JobResponseDto>;

  // Sub-resource accessors (proxy to Crunchwork, cache locally)
  async getQuotes(params: { jobId: string }): Promise<QuoteSummaryDto[]>;
  async getPurchaseOrders(params: { jobId: string }): Promise<PurchaseOrderSummaryDto[]>;
  async getTasks(params: { jobId: string }): Promise<TaskSummaryDto[]>;
  async getMessages(params: { jobId: string }): Promise<MessageSummaryDto[]>;
  async getReports(params: { jobId: string }): Promise<ReportSummaryDto[]>;
  async getInvoices(params: { jobId: string }): Promise<InvoiceSummaryDto[]>;
}
```

### 9.4 Sync Service

Handle the complex Job entity with job-type-specific fields:

```typescript
@Injectable()
export class JobsSyncService {
  async syncFromApi(params: {
    tenantId: string;
    apiJob: CrunchworkJobDto;
  }): Promise<Job> {
    // 1. Upsert job record (find by tenant_id + external_reference)
    // 2. Link to claim (via claimId / parentClaimId)
    // 3. Resolve lookups: jobType, status
    // 4. Resolve vendor (if allocated)
    // 5. Store JSONB fields:
    //    - address
    //    - vendor_snapshot
    //    - temporary_accommodation_details (if TA job type)
    //    - specialist_details (if specialist job type)
    //    - rectification_details (if rectification job type)
    //    - audit_details (if audit job type)
    //    - mobility_considerations
    // 6. Extract promoted columns (address_postcode, etc.)
    // 7. Sync contacts → contacts table + job_contacts join
    // 8. Store full api_payload
  }
}
```

### 9.5 Job-Type Specific Fields

The API has conditional fields based on `jobType`:

| Job Type | Additional Fields |
|----------|------------------|
| Temporary Accommodation | `emergency`, `habitableProperty`, `estimatedStayStartDate`, `estimatedStayEndDate`, `numberOfAdults`, `numberOfChildren`, `numberOfBedrooms`, `numberOfCots`, `numberOfVehicles`, `mobilityConsiderations`, `accommodationBenefitLimit`, `maximumAccommodationDurationLimit` |
| Specialist | `specialistCategory`, `specialistReport`, `specialistBusinessName`, `isSpecificSpecialistRequired`, `specificSpecialistName`, `locationOfDamage`, `typeOfDamage` |
| Rectification Assessment / Builder Rectification Work | `originalJobReference`, `originalJobType`, `paidJob` |
| Internal Audit | `auditType` |

These are stored in the respective JSONB columns on the `jobs` entity.

### 9.6 Query DTO

```typescript
export class JobQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsArray() statusIds?: string[];
  @IsOptional() @IsArray() jobTypeIds?: string[];
  @IsOptional() @IsString() claimId?: string;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsString() sortBy?: 'requestDate' | 'status' | 'jobType' | 'updatedAt';
  @IsOptional() @IsEnum(['asc', 'desc']) sortOrder?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
}
```

### 9.7 Response DTO

```typescript
export class JobResponseDto {
  id: string;
  externalReference: string;
  claimId: string;
  claimNumber: string;
  jobType: LookupValueDto;
  status: LookupValueDto;
  address: AddressDto;
  vendor: VendorSummaryDto | null;
  requestDate: string;
  collectExcess: boolean;
  excess: number;
  makeSafeRequired: boolean;
  jobInstructions: string;
  contacts: ContactDto[];
  appointments: AppointmentSummaryDto[];
  // Job-type specific (returned when applicable)
  temporaryAccommodationDetails: Record<string, any> | null;
  specialistDetails: Record<string, any> | null;
  rectificationDetails: Record<string, any> | null;
  auditDetails: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}
```

---

### 9.8 Phase Dependencies

| Feature | Crunchwork Phase | Notes |
|---------|-----------------|-------|
| `POST /jobs` (create) | 1 | |
| `GET /jobs` (list) | 1 | List endpoint |
| `GET /jobs/{id}` (read) | 1 | |
| `POST /jobs/{id}` (update) | 1 | Vendor: status-only |
| `GET /jobs/{id}/quotes` | 1 | |
| `POST /jobs/{id}/status` | **2** | Vendor-specific status update |
| `GET /jobs/{id}/purchase-orders` | **2** | |
| `GET /jobs/{id}/tasks` | **2** | |
| `GET /jobs/{id}/messages` | **2** | |
| `GET /jobs/{id}/reports` | **2** | |
| `GET /jobs/{id}/invoices` | **2** | |

### 9.9 Webhook → Parent Claim Sync

When processing `NEW_JOB` or `UPDATE_JOB` webhooks, the job response contains `claimId` (and sometimes `parentClaimId`). The job webhook handler should:

1. Fetch and sync the job itself via `GET /jobs/{id}`
2. **Optionally fetch and sync the parent claim** via `GET /claims/{id}` (Phase 3+)
3. If `GET /claims/{id}` is not yet available (pre-Phase 3), store the `claimId` on the job record but skip claim sync — the claim will be synced later when Phase 3 endpoints become available or when the user navigates to the claim

```typescript
// In JobEventHandler.handle():
const apiJob = await this.crunchworkService.getJob({
  tenantId: params.tenantId,
  jobId: params.entityId,
});
await this.jobsSyncService.syncFromApi({ tenantId: params.tenantId, apiJob });

// Phase 3+: also sync the parent claim
if (apiJob.claimId) {
  try {
    const apiClaim = await this.crunchworkService.getClaim({
      tenantId: params.tenantId,
      claimId: apiJob.claimId,
    });
    await this.claimsSyncService.syncFromApi({ tenantId: params.tenantId, apiClaim });
  } catch (error) {
    // Phase 3 endpoint may not be available yet — log and continue
    this.logger.warn(
      `JobEventHandler.handle - could not fetch parent claim ${apiJob.claimId}: ${error.message}`
    );
  }
}
```

### 9.10 Vendor Job Status Validation

The API spec states vendors may only update job status to allowed statuses. While Crunchwork enforces this on their side (returning 400 for invalid transitions), consider:

- **Phase 1:** Rely on Crunchwork's validation — pass through the error with a clear message
- **Future:** Add local validation of allowed status transitions per job type/current status, configured via lookup data

---

## Acceptance Criteria

- [ ] `POST /jobs` creates job in Crunchwork and persists locally
- [ ] `GET /jobs` returns paginated, filtered list from local DB
- [ ] `GET /jobs/:id` returns full job detail including sub-resource counts
- [ ] `POST /jobs/:id/status` updates status (Vendor role only, Phase 2)
- [ ] All sub-resource list endpoints work (`/jobs/:id/quotes`, etc.)
- [ ] Job-type-specific fields stored correctly in JSONB
- [ ] Job contacts synced to shared contacts table
- [ ] `NEW_JOB` webhook handler fetches and syncs parent claim (Phase 3+)
- [ ] Vendor status update errors from Crunchwork returned with clear message
