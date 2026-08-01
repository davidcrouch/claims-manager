# 43 — Cross-Tenant RFQ / Job

## Objective

Implement the cross-tenant pattern for the RFQ (issuer) / Job (receiver) document pair, enabling:

- A buyer to issue an RFQ that creates a Job in each recipient vendor's tenant
- 1:N fan-out — one RFQ sent to multiple vendors, each receiving their own Job
- A vendor to manually capture an external RFQ from a non-subscribed buyer (ghost org)
- Custody transfer when a ghost buyer later subscribes
- Recursive sub-contracting where a vendor issues further RFQs downstream from their own Estimate

**Architecture reference:** [41_CROSS_TENANT_SUPPLY_CHAIN_ARCHITECTURE.md](./41_CROSS_TENANT_SUPPLY_CHAIN_ARCHITECTURE.md)

**PO/WO reference implementation:** [40_CROSS_TENANT_PO_WO.md](./40_CROSS_TENANT_PO_WO.md)

---

## Scope & Exclusions

### In scope

- Schema additions to `rfqs` (issuer-side org/custody fields)
- Schema additions to `jobs` (`source_rfq_id`, source tenant/org fields, version fields)
- New `RECIPIENT_TYPE_MAP` entry: `rfq → job`
- `DocumentIssuanceService.createJobFromRfq()` method
- 1:N issuance (one RFQ to multiple recipient tenants)
- Manual RFQ capture API (`POST /rfqs/capture`)
- Custody transfer support for RFQs
- Idempotency constraints
- Frontend capture form

### Out of scope (future phases)

- RFQ scope items copied into the Job's line-item structure (scope remains in `rfqPayload` snapshot on the Job)
- Automated RFQ expiry and deadline enforcement
- Pub/Sub event propagation
- Competitive bid comparison UI

---

## Current State

| Aspect | Status |
|--------|--------|
| `jobs.source_rfq_id` FK | Does not exist |
| `DocumentIssuanceService` mapping | `rfq → rfq` (incorrect — should be `rfq → job`) |
| Cross-tenant org fields on `rfqs` | Missing |
| Cross-tenant source fields on `jobs` | Missing |
| Version fields on `jobs` | Missing |
| RFQ line-item hierarchy | Exists (rfq_groups, rfq_combos, rfq_items) |
| Manual capture endpoint | Not implemented |
| RFQ `vendorId` field | Local vendor table reference (not cross-tenant) |

---

## Phase 1 — Schema Changes

### 1.1 `rfqs` table — issuer-side fields

```sql
ALTER TABLE rfqs ADD COLUMN issuer_organisation_id UUID
    REFERENCES organizations(id);

ALTER TABLE rfqs ADD COLUMN recipient_organisation_id UUID
    REFERENCES organizations(id);

ALTER TABLE rfqs ADD COLUMN custodian_tenant_id UUID
    REFERENCES organizations(id);

ALTER TABLE rfqs ADD COLUMN capture_method TEXT;

ALTER TABLE rfqs ADD COLUMN ownership_status TEXT NOT NULL DEFAULT 'owned';

CREATE INDEX idx_rfqs_issuer_org ON rfqs(issuer_organisation_id);
CREATE INDEX idx_rfqs_ownership ON rfqs(ownership_status);
```

Note: The existing `recipient_organisation_id` is for a single-recipient RFQ. For 1:N fan-out, the RFQ itself names one logical recipient per row (the existing `vendorId` pattern continues for within-tenant targeting). Cross-tenant issuance resolves the recipient tenant from the organisation.

### 1.2 `jobs` table — receiver-side fields

```sql
ALTER TABLE jobs ADD COLUMN source_rfq_id UUID
    REFERENCES rfqs(id);

ALTER TABLE jobs ADD COLUMN source_tenant_id UUID;

ALTER TABLE jobs ADD COLUMN source_organisation_id UUID
    REFERENCES organizations(id);

ALTER TABLE jobs ADD COLUMN source_version_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE jobs ADD COLUMN latest_available_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE jobs ADD COLUMN version_acknowledged BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX idx_jobs_source_rfq ON jobs(source_rfq_id);
CREATE INDEX idx_jobs_source_tenant ON jobs(source_tenant_id);
```

### 1.3 Idempotency constraints

```sql
-- Prevent duplicate RFQs from the same issuer
CREATE UNIQUE INDEX UQ_rfqs_issuer_org_number
    ON rfqs(issuer_organisation_id, rfq_number)
    WHERE issuer_organisation_id IS NOT NULL
      AND rfq_number IS NOT NULL
      AND deleted_at IS NULL;

-- One job per source RFQ per receiving tenant
CREATE UNIQUE INDEX UQ_jobs_tenant_source_rfq
    ON jobs(tenant_id, source_rfq_id)
    WHERE source_rfq_id IS NOT NULL
      AND deleted_at IS NULL;
```

### 1.4 Migration

Generate a Drizzle migration. The migration must:

- Add all new columns as nullable or with safe defaults
- Backfill existing RFQs: set `ownership_status = 'owned'` and `issuer_organisation_id = tenant_id`
- Existing jobs have no source RFQ — no backfill needed for `source_rfq_id`

---

## Phase 2 — Service Changes

### 2.1 Update `RECIPIENT_TYPE_MAP`

Change the RFQ mapping in `DocumentIssuanceService`:

```typescript
// Before:
rfq → rfq

// After:
rfq → job
```

### 2.2 Implement `createJobFromRfq()`

New method in `DocumentIssuanceService`:

```typescript
private async createJobFromRfq(params: {
  sourceDocumentId: string;
  sourceEntity: Record<string, unknown>;
  sourceTenantId: string;
  recipientTenantId: string;
  versionNumber: number;
  tx: DrizzleDbOrTx;
}): Promise<string> {
  const src = params.sourceEntity;

  const jobData: Partial<JobInsert> = {
    tenantId: params.recipientTenantId,
    sourceRfqId: params.sourceDocumentId,
    sourceTenantId: params.sourceTenantId,
    sourceOrganisationId: params.sourceTenantId, // issuer org
    name: src.name as string | undefined,
    jobTypeLookupId: /* resolve 'RFQ Response' type or default */,
    statusLookupId: /* resolve 'Pending' status */,
    address: src.rfqTo as Record<string, unknown> ?? {},  // perspective swap
    apiPayload: {
      rfqPayload: src.rfqPayload,
      rfqNumber: src.rfqNumber,
      dueDate: src.dueDate,
      includePricing: src.includePricing,
      includeQuantities: src.includeQuantities,
    },
    sourceVersionNumber: params.versionNumber,
    latestAvailableVersion: params.versionNumber,
    versionAcknowledged: false,
  };

  const created = await this.jobsRepo.create({ data: jobData as JobInsert, tx: params.tx });
  return created.id;
}
```

### 2.3 1:N Fan-Out

When issuing an RFQ to multiple recipients, `DocumentIssuanceService.execute()` is called once per recipient tenant. The caller (controller or workflow hook) iterates over the list of recipient organisations:

```typescript
for (const recipientOrgId of dto.recipientOrganisationIds) {
  const recipientTenantId = await this.resolveOrganisationTenant(recipientOrgId);
  if (recipientTenantId) {
    await this.documentIssuanceService.execute({
      sourceDocumentType: 'rfq',
      sourceDocumentId: rfq.id,
      sourceTenantId: tenantId,
      recipientTenantId,
      // ...
    });
  }
}
```

Each recipient gets their own independent Job. The unique constraint `(tenant_id, source_rfq_id)` prevents duplicates.

### 2.4 Extend `RfqsService` for org field population

When a subscribed buyer creates an RFQ through the standard flow:

```typescript
issuer_organisation_id = buyer tenant org
recipient_organisation_id = target vendor org (from vendorId resolution)
ownership_status = 'owned'
```

---

## Phase 3 — Manual RFQ Capture

### 3.1 Endpoint

```text
POST /rfqs/capture
```

### 3.2 Request Shape

```typescript
interface CaptureRfqDto {
  // Issuer identification (at least one required)
  issuer: {
    abn?: string;
    legalName?: string;
    tradingName?: string;
    email?: string;
    phone?: string;
    organisationId?: string;
  };

  // RFQ header
  rfqNumber?: string;
  name: string;
  note?: string;
  dueDate?: string;
  sentDate?: string;
  includePricing?: boolean;
  includeQuantities?: boolean;

  // Associations (at least one required)
  jobId?: string;
  claimId?: string;

  // Source document
  sourceDocumentId?: string;
}
```

### 3.3 Response Shape

```typescript
interface CaptureRfqResponse {
  rfqId: string;
  jobId: string;
  issuerOrganisationId: string;
  issuerCreated: boolean;
}
```

### 3.4 Transaction Logic

```text
BEGIN

1. Validate user, tenant, and permissions.
2. Resolve or create the ghost issuer organisation.
   - If resolved org is an active subscribed tenant, reject with error.
3. Create the custodial RFQ:
   - tenant_id = receiving tenant (custodian)
   - issuer_organisation_id = ghost org
   - recipient_organisation_id = receiving tenant org
   - custodian_tenant_id = receiving tenant
   - capture_method = 'manual'
   - ownership_status = 'externally_captured'
   - Header fields from dto
4. Create the Job:
   - tenant_id = receiving tenant
   - source_rfq_id = RFQ from step 3
   - source_tenant_id = null (ghost)
   - source_organisation_id = ghost org
   - job_type_lookup_id = resolve appropriate type
   - status_lookup_id = resolve 'Pending'
   - name from dto
   - api_payload = { rfqPayload snapshot }
   - version_acknowledged = true (no version gap on manual capture)
5. Return both IDs.

COMMIT
```

### 3.5 Idempotency

Check the unique constraint before inserting. If an RFQ already exists for the same issuer org + RFQ number, return the existing RFQ and its linked Job.

---

## Phase 4 — Recursive Sub-Contracting

This phase describes how the recursive supply chain works at the RFQ/Job level. No new service is needed — it uses existing infrastructure.

### Pattern

1. Vendor receives a Job (via RFQ from upstream buyer)
2. Vendor creates an Estimate (Quote) against that Job
3. Vendor identifies items needing downstream pricing
4. Vendor creates sub-RFQs from the Estimate:
   - Uses existing `rfqs.quote_id` to link the sub-RFQ to the parent Estimate
   - Sub-RFQ items trace back to Estimate items via `source_quote_item_id` on rfq_items
5. Sub-RFQ is issued downstream to other vendors (creates Jobs in their tenants)
6. Downstream vendors respond with Estimates → Proposals flow back
7. Vendor selects winning Proposals and incorporates prices into their own Estimate
8. Vendor issues completed Estimate upstream → Proposal created for the original buyer

### Lineage tracking

```text
Original RFQ (Buyer A)
    → Job (Vendor A) via source_rfq_id
        → Quote/Estimate (Vendor A) via jobs.id → quotes.job_id
            → Sub-RFQ (Vendor A issues) via rfqs.quote_id
                → Sub-RFQ items trace via source_quote_item_id
                    → Job (Vendor B) via source_rfq_id
```

No special "recursion depth" tracking is needed. Each level is simply another standard issuance.

---

## Phase 5 — Custody Transfer

Extend `CustodyTransferService` to include RFQs in the transfer query:

```text
Find all rfqs WHERE
  issuer_organisation_id = :ghostOrganisationId
  AND ownership_status = 'externally_captured'
```

For each RFQ:
1. Update `tenant_id` = new issuer tenant (buyer)
2. Update `custodian_tenant_id` = null
3. Update `ownership_status` = 'transferred'
4. Log transfer
5. Update linked jobs: `source_tenant_id` = new issuer tenant

The job's `tenant_id` remains unchanged — it still belongs to the vendor.

---

## Phase 6 — Frontend

### 6.1 Manual RFQ Capture Form

Add a "Capture External RFQ" action accessible from:
- The Jobs list page toolbar
- The Job detail page (if creating a new job from an external RFQ)

The form collects:
- Issuer identity fields (business name, ABN, email, phone)
- RFQ number (optional)
- Name (required)
- Due date
- Job/claim association
- Scope notes

On submit, calls `POST /rfqs/capture`. On success, navigates to the newly created Job detail page.

### 6.2 RFQ Issuance UI

Add an "Issue to Vendors" action on the RFQ detail page:
- Select one or more recipient organisations
- Each recipient gets a Job created in their tenant
- Show delivery status per recipient

### 6.3 Ghost Issuer Display

When viewing a custodial RFQ or a Job sourced from a ghost org:
- Badge indicating the issuer is an external (non-subscribed) organisation
- Issuer's known identity fields
- Capture method and date

---

## Lifecycle States

### RFQ (issuer-side)

| Status | Meaning |
|--------|---------|
| Draft | RFQ created, scope being assembled |
| Sent | RFQ issued to vendor(s) |
| Responded | At least one vendor has submitted an Estimate |
| Expired | Due date passed without full response |
| Cancelled | RFQ withdrawn |
| Closed | RFQ completed (vendor selected) |

### Job (receiver-side, when sourced from RFQ)

Standard job lifecycle applies. The job's `source_rfq_id` links it back to the originating RFQ for traceability, but the job follows the same Pending → In Progress → Completed workflow as any other job.

---

## Sequence Diagrams

### Scenario 1: Subscribed Buyer Issues RFQ to Multiple Vendors

```text
Buyer Tenant               Claims Manager               Vendor A         Vendor B
     │                         │                           │                │
     │  Create RFQ             │                           │                │
     │────────────────────────>│                           │                │
     │                         │ Save RFQ                  │                │
     │                         │                           │                │
     │  Issue RFQ              │                           │                │
     │  (recipients: A, B)     │                           │                │
     │────────────────────────>│                           │                │
     │                         │ For each recipient:       │                │
     │                         │   createJobFromRfq()      │                │
     │                         │──────────────────────────>│                │
     │                         │   Job A created           │                │
     │                         │────────────────────────────────────────────>│
     │                         │   Job B created           │                │
     │                         │                           │                │
     │                         │              Job visible  │   Job visible  │
```

### Scenario 2: Vendor Captures External RFQ

```text
External Buyer             Vendor Tenant               Claims Manager
     │                         │                              │
     │  Sends RFQ (email)      │                              │
     │────────────────────────>│                              │
     │                         │ POST /rfqs/capture           │
     │                         │─────────────────────────────>│
     │                         │              BEGIN TRANSACTION│
     │                         │              1. Resolve ghost │
     │                         │              2. Create RFQ    │
     │                         │                 custody=vendor│
     │                         │              3. Create Job    │
     │                         │                 tenant=vendor │
     │                         │              COMMIT           │
     │                         │<─────────────────────────────│
     │                         │ Job visible immediately      │
```

### Scenario 3: Recursive Sub-Contracting

```text
Buyer A                    Vendor A                    Vendor B
     │                         │                           │
     │  Issues RFQ             │                           │
     │────────────────────────>│ Job created               │
     │                         │                           │
     │                         │ Creates Estimate          │
     │                         │ Identifies sub-scope      │
     │                         │                           │
     │                         │ Issues sub-RFQ            │
     │                         │──────────────────────────>│ Job created
     │                         │                           │
     │                         │                           │ Creates Estimate
     │                         │                           │ Issues Estimate
     │                         │ Receives Proposal ◄───────│
     │                         │                           │
     │                         │ Incorporates pricing      │
     │                         │ Issues Estimate           │
     │ Receives Proposal ◄─────│                           │
```

---

## Implementation Order

| Step | Description | Depends On |
|------|-------------|-----------|
| 1 | Drizzle schema changes (`rfqs` + `jobs` columns) | — |
| 2 | Generate and review migration | Step 1 |
| 3 | Fix `RECIPIENT_TYPE_MAP`: `rfq → job` | Step 2 |
| 4 | Implement `createJobFromRfq()` | Step 3 |
| 5 | 1:N issuance logic (iterate recipients) | Step 4 |
| 6 | Auto-populate org fields on standard RFQ create | Step 2 |
| 7 | Manual capture service and endpoint | Step 2 |
| 8 | Frontend: capture form | Step 7 |
| 9 | Frontend: issue-to-vendors UI | Step 5 |
| 10 | Extend custody transfer to include RFQs | Step 2 |
| 11 | Backfill migration for existing data | Step 2 |

---

*Previous: [42 — Cross-Tenant Invoice/Bill](./42_CROSS_TENANT_INVOICE_BILL.md)*
