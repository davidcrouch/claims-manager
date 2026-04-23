# 09 — Jobs Module

## Objective

Implement the Jobs module — the core operational entity. Jobs are children of claims and have the richest sub-resource graph (quotes, POs, tasks, messages, reports, appointments). The module proxies to Crunchwork and persists locally.

**Authoritative field-by-field mapping:** [`docs/mapping/jobs.md`](../mapping/jobs.md). That doc is the spec this module's mapper/sync service must satisfy; if a CW §3.3.2 field isn't listed there it isn't normalised here either.

**CW contract reference:** `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.2 (Job) and §3.3.3 (slim Job inside a Claim response).

---

## Current State (stub)

As of this writing the module is a **thin shim**, not the full specification below:

| Area | Today | Target (below) |
|---|---|---|
| Controller (`jobs.controller.ts`) | `GET /jobs`, `GET /jobs/:id`, `POST /jobs`, `POST /jobs/:id` only | Adds `/status`, `/quotes`, `/purchase-orders`, `/tasks`, `/messages`, `/reports`, `/invoices` |
| Service (`jobs.service.ts`) | Pass-through to `CrunchworkService.createJob/updateJob` plus local `jobsRepo.findAll/findOne`; no sub-resource accessors; no DTO validation | Full DTO-validated service with sub-resource proxies |
| Sync / mapping | `CrunchworkJobMapper` in `apps/api/src/modules/external/mappers/crunchwork-job.mapper.ts` only populates `external_reference`, `claim_id`, `job_type_lookup_id`, `vendor_id`, `api_payload` (stub coverage — see `docs/mapping/jobs.md` §10) | Full mapper coverage per `docs/mapping/jobs.md` §§2–9, plus a dedicated `JobsSyncService` that wraps the mapper for outbound `POST /jobs` round-tripping |

Every field the stub mapper does not yet normalise still survives losslessly in `jobs.api_payload`, so this plan describes forward work rather than backfill.

---

## Master / Child Jobs (internal hierarchy)

Jobs can be organised into a **master → child** hierarchy **inside this application**, independently of Crunchwork. This is driven by the PRD2 requirement (§3) that a single CW job may need to be split into multiple internal work packages, or that multiple CW jobs may be grouped under one builder-managed master:

| Shape | Meaning |
|---|---|
| `parent_job_id IS NULL` | Top-level job (standalone, or the "master" of a group). |
| `parent_job_id = <master.id>` | Child / spin-off job — dependent on the master for operational ordering. |

**Key rules the service layer must enforce:**

1. **Internal-only field.** `parent_job_id` is never populated from a CW payload. `CrunchworkJobMapper` and `JobsSyncService.syncFromApi` must preserve any existing value and never clear it.
2. **Self-FK is nullable, no cascade.** Deleting a master does not cascade-delete children; the UI / service must either re-parent children or refuse the delete while children exist.
3. **One level by default.** The UI assumes one level of nesting (master → children). The schema permits deeper trees but deeper nesting is treated as an anti-pattern.
4. **Child rows without a CW twin.** When a child job exists purely as a local spin-off (no distinct CW job id), its `external_reference` is left `NULL` (permitted by the `UQ_jobs_tenant_extref` nullable unique index). Only the row that maps 1:1 to a CW job carries the CW UUID in `external_reference`.
5. **`claim_id` stays consistent.** A child job must belong to the **same claim** as its master. The service layer should reject attempts to re-parent across claims.

**Where this surfaces in the module:**

- **`CreateJobDto`** accepts an optional `parentJobId`. When present, `JobsService.create` validates it belongs to the same tenant and claim before insert.
- **`UpdateJobDto`** accepts `parentJobId` for re-parenting; `JobsService.update` runs the same claim-consistency check and guards against cycles (a job cannot become its own ancestor).
- **`JobResponseDto`** exposes `parentJobId` and, when resolved, a slim `parentJob` summary for the detail page (see `docs/implementation/32_UI_JOB_DETAIL_REVAMP.md`).
- **`JobQueryDto`** supports filtering on `parentJobId` (`'none'` → top-level only, `'<uuid>'` → children of that master, omitted → all).

See [`docs/mapping/jobs.md`](../mapping/jobs.md) §2.1–§2.2 for the full CW ↔ internal mapping treatment of the hierarchy columns, and `docs/discussion/001-prd2-gap-analysis.md` §2.2.1 for the original decision record.

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

Handle the complex Job entity with job-type-specific fields. For inbound webhook traffic this work is already triggered via `CrunchworkJobMapper` (see `apps/api/src/modules/external/mappers/crunchwork-job.mapper.ts`) inside the in-process projection pipeline — `JobsSyncService` is the module-facing wrapper used by `JobsService.create()` / `update()` after an outbound CW round-trip, so the persisted row stays in lockstep with the CW server's response.

```typescript
@Injectable()
export class JobsSyncService {
  async syncFromApi(params: {
    tenantId: string;
    apiJob: CrunchworkJobDto;
  }): Promise<Job> {
    // Delegates to CrunchworkJobMapper for the field work; the mapper is the
    // single source of truth for destinations (see docs/mapping/jobs.md).
    //
    // High-level steps:
    // 1. Upsert job row by (tenant_id, external_reference=CW job UUID)
    // 2. Resolve claim_id via NestedEntityExtractor.extractFromJobPayload
    //    (creates a shallow claim row when only a nested `claim` is present)
    // 3. Resolve lookups: jobType (required), status
    // 4. Resolve vendor_id (Vendor Tenancy only); snapshot to vendor_snapshot
    // 5. Write JSONB buckets: address, temporary_accommodation_details,
    //    specialist_details, rectification_details, audit_details,
    //    mobility_considerations, custom_data
    // 6. Extract promoted columns (address_postcode/suburb/state/country,
    //    request_date, collect_excess, excess, make_safe_required,
    //    job_instructions, parent_claim_id)
    // 7. Sync contacts[] → contacts table + job_contacts join
    // 8. Store full api_payload verbatim
  }
}
```

### 9.5 Job-Type Specific Fields

The API has conditional fields based on `jobType`. These are stored in the respective JSONB columns on the `jobs` entity — see `docs/mapping/jobs.md` §7 for per-key destinations.

| Job Type | CW fields | JSONB column |
|----------|-----------|--------------|
| Temporary Accommodation | `emergency`, `habitableProperty`, `estimatedStayStartDate`, `estimatedStayEndDate`, `numberOfAdults`, `numberOfChildren`, `numberOfBedrooms`, `numberOfCots`, `numberOfVehicles`, `petsInformation` | `temporary_accommodation_details` |
| Temporary Accommodation (mobility) | `mobilityConsiderations` (list of `{name, externalReference}`) | `mobility_considerations` (own array column) |
| Specialist | `isSpecificSpecialistRequired`, `specialistCategory`, `specialistReport`, `specialistBusinessName` (only when `isSpecificSpecialistRequired===true`), `locationOfDamage`, `typeOfDamage` | `specialist_details` |
| Rectification Assessment / Builder Rectification Work | `originalJobReference`, `originalJobType`, `paidJob` | `rectification_details` |
| Internal Audit | `auditType` | `audit_details` |

**Not on the Job contract** (commonly conflated): `accommodationBenefitLimit` and `maximumAccommodationDurationLimit` live on the **Claim** contract (§3.3.1), not the Job. They land on `claims` per `docs/mapping/claims.md` §6.2 / §6.5; the Job Detail UI surfaces them by joining to the parent claim.

### 9.6 Query DTO

```typescript
export class JobQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsArray() statusIds?: string[];
  @IsOptional() @IsArray() jobTypeIds?: string[];
  @IsOptional() @IsString() claimId?: string;
  @IsOptional() @IsString() vendorId?: string;
  // Hierarchy filter:
  //   'none'  → top-level jobs only (parent_job_id IS NULL)
  //   <uuid>  → children of the given master job
  //   omitted → all jobs regardless of hierarchy
  @IsOptional() @IsString() parentJobId?: 'none' | string;
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
  externalReference: string | null; // null for locally-created child jobs with no CW twin
  claimId: string;
  claimNumber: string;
  // Internal hierarchy — see "Master / Child Jobs" section above
  parentClaimId: string | null;
  parentJobId: string | null;
  parentJob: JobSummaryDto | null; // resolved slim summary when parentJobId is set
  childJobCount: number; // number of rows where jobs.parent_job_id = this.id
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
- [ ] Job-type-specific fields stored correctly in JSONB — matches `docs/mapping/jobs.md` §7
- [ ] Address, vendor, scheduling, instructions normalised per `docs/mapping/jobs.md` §§4–6
- [ ] Job contacts synced to shared contacts table via `job_contacts` with `sort_index` preserving array order
- [ ] `NEW_JOB` webhook handler fetches and syncs parent claim (Phase 3+)
- [ ] Vendor status update errors from Crunchwork returned with clear message
- [ ] `parent_job_id` is preserved across CW webhook updates — `CrunchworkJobMapper` and `JobsSyncService` never write or clear this column
- [ ] `POST /jobs` with `parentJobId` rejects cross-claim parents and self-parenting; `POST /jobs/:id` with `parentJobId` rejects ancestor cycles
- [ ] `GET /jobs?parentJobId=none` returns top-level jobs only; `GET /jobs?parentJobId=<uuid>` returns that master's children
