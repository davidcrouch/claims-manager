# 40 — Cross-Tenant Purchase Orders, Work Orders & Ghost Organisations

## Objective

Implement the full lifecycle for cross-tenant PO/WO issuance including:

- Ghost organisations representing non-subscribed commercial counterparties
- Manual PO capture by a receiving tenant on behalf of a ghost issuer
- Automated PO-to-WO creation for on-platform tenants (existing, extended)
- Organisation resolution and deduplication
- Custody transfer when a ghost organisation later subscribes
- Audit, security, and idempotency guarantees

**Design reference:** [`docs/discussion/async comms.md`](../discussion/async%20comms.md)

---

## Scope & Exclusions

### In scope

- Ghost organisation entity and lifecycle (create, match, claim, verify, link)
- Schema additions to `organizations`, `purchase_orders`, `work_orders`
- Manual PO capture API (single transaction: ghost org + custodial PO + WO)
- Organisation resolution service
- Custody transfer service
- Work order workflow definition
- Frontend for manual PO capture and ghost org display
- Audit fields and provenance tracking

### Out of scope (future phases)

- Google Cloud Pub/Sub infrastructure and outbox pattern
- Automated inbox receipt (inbound PO via messaging)
- More0 workflow orchestration
- SLA monitoring and notification rules
- Cross-tenant document amendment propagation via Pub/Sub

---

## Domain Model

### Terminology

| Term | Meaning |
|---|---|
| **Tenant** | A subscribed organisation with an active `organizations` record, users, and a security boundary |
| **Ghost organisation** | An `organizations` record representing a real commercial entity that does not have an active Claims Manager subscription. Marked with `status = 'ghost'`. Has no users, no login, no config. |
| **Purchase Order (PO)** | The issuer-side representation of a commercial instruction |
| **Work Order (WO)** | The receiver-side representation of the same commercial instruction |
| **Custodial PO** | A PO record held by the receiving tenant on behalf of a non-subscribed ghost issuer |
| **Issuer** | The organisation that commercially issued the PO (may be a ghost or a subscribed tenant) |
| **Receiver** | The organisation that receives the PO and operates on the resulting WO |

### Entity Relationships

```
organizations (tenant or ghost)
    │
    ├── purchase_orders.tenant_id             (record owner — always an active tenant)
    ├── purchase_orders.issuer_organisation_id (commercial issuer — may be ghost)
    ├── purchase_orders.recipient_organisation_id (commercial recipient)
    │
    ├── work_orders.tenant_id                 (record owner — always the receiving tenant)
    ├── work_orders.purchase_order_id          (FK to the linked PO)
    ├── work_orders.source_tenant_id           (issuing tenant, if subscribed)
    │
    └── organisation_claims                    (claim + verification log)
```

### PO-WO Linking

The link between PO and WO is a direct foreign key: `work_orders.purchase_order_id → purchase_orders.id`. No intermediate `commercial_order` entity.

For cross-tenant issuance where both parties are subscribed, the PO lives in the issuer's tenant and the WO lives in the receiver's tenant. The FK crosses tenant boundaries intentionally — it is a system-level link, not subject to tenant-scoped queries.

For manual capture where the issuer is a ghost, both the custodial PO and the WO live in the receiving tenant. `work_orders.purchase_order_id` references the PO in the same tenant.

---

## Phase 1 — Schema Changes

### 1.1 `organizations` table — identity fields for ghost resolution

Add columns to support ghost organisation identification and matching:

```sql
ALTER TABLE organizations ADD COLUMN abn TEXT;
ALTER TABLE organizations ADD COLUMN legal_name TEXT;
ALTER TABLE organizations ADD COLUMN trading_name TEXT;
ALTER TABLE organizations ADD COLUMN primary_email TEXT;
ALTER TABLE organizations ADD COLUMN email_domain TEXT;
ALTER TABLE organizations ADD COLUMN phone TEXT;
ALTER TABLE organizations ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'active';

CREATE UNIQUE INDEX UQ_organizations_abn ON organizations(abn) WHERE abn IS NOT NULL;
```

`subscription_status` values:

| Value | Meaning |
|---|---|
| `active` | Subscribed tenant with users, config, and login access |
| `ghost` | Represents a real commercial entity; no tenant subscription; no users |
| `claimed` | A ghost that has been claimed by a registering tenant; pending verification |
| `verified` | A ghost that has been verified and linked to a real tenant |
| `deactivated` | A previously active tenant that has been suspended or cancelled |

The existing `status` field remains unchanged (it is managed by the auth layer). `subscription_status` is the domain-level status for this design.

Ghost organisations:
- Have `subscription_status = 'ghost'`
- Have no rows in `organization_users`
- Have no `config`
- May have `abn`, `legal_name`, `trading_name`, `primary_email`, `email_domain`, `phone`
- Are created during manual PO capture or administrative import

### 1.2 `purchase_orders` table — ownership and custody fields

Add columns to track commercial issuer identity and custodial ownership:

```sql
ALTER TABLE purchase_orders ADD COLUMN issuer_organisation_id UUID
    REFERENCES organizations(id);

ALTER TABLE purchase_orders ADD COLUMN recipient_organisation_id UUID
    REFERENCES organizations(id);

ALTER TABLE purchase_orders ADD COLUMN custodian_tenant_id UUID
    REFERENCES organizations(id);

ALTER TABLE purchase_orders ADD COLUMN capture_method TEXT;
ALTER TABLE purchase_orders ADD COLUMN ownership_status TEXT NOT NULL DEFAULT 'owned';

CREATE INDEX idx_po_issuer_org ON purchase_orders(issuer_organisation_id);
CREATE INDEX idx_po_ownership ON purchase_orders(ownership_status);
```

`capture_method` values:

| Value | Meaning |
|---|---|
| `null` | Standard PO created by the issuing tenant (no capture) |
| `manual` | Manually entered by the receiving tenant on behalf of a ghost issuer |
| `email` | Captured from an inbound email (future) |
| `automated` | Created by an automated integration or inbox (future) |

`ownership_status` values:

| Value | Meaning |
|---|---|
| `owned` | PO is owned by the issuing tenant (standard case) |
| `externally_captured` | PO is held in custody by the receiving tenant on behalf of a ghost issuer |
| `claimed` | Ghost issuer has claimed the PO; pending transfer |
| `transferred` | PO has been transferred from custodian to the issuer tenant |

Field semantics for each scenario:

**Standard PO (subscribed issuer creates PO):**

```
tenant_id = issuer tenant
issuer_organisation_id = issuer tenant org
recipient_organisation_id = receiver tenant org
custodian_tenant_id = null
capture_method = null
ownership_status = 'owned'
```

**Custodial PO (receiver manually captures external PO):**

```
tenant_id = receiving tenant (custodian)
issuer_organisation_id = ghost organisation
recipient_organisation_id = receiving tenant org
custodian_tenant_id = receiving tenant
capture_method = 'manual'
ownership_status = 'externally_captured'
```

**After custody transfer (ghost becomes subscribed):**

```
tenant_id = issuer tenant (transferred)
issuer_organisation_id = issuer tenant org (same org, no longer ghost)
recipient_organisation_id = receiving tenant org
custodian_tenant_id = null (cleared)
capture_method = 'manual' (preserved — audit)
ownership_status = 'transferred'
```

### 1.3 `work_orders` table — source organisation tracking

The existing `source_tenant_id` field is sufficient for on-platform issuance. Add a field for the source organisation when the issuer may be a ghost:

```sql
ALTER TABLE work_orders ADD COLUMN source_organisation_id UUID
    REFERENCES organizations(id);
```

For manual capture: `source_organisation_id = ghost org`, `source_tenant_id = null`.

For on-platform issuance: `source_organisation_id = issuer org`, `source_tenant_id = issuer tenant`.

### 1.4 `organisation_claims` table — claim and verification log

New table to track the lifecycle of a ghost organisation being claimed by a subscribing tenant:

```sql
CREATE TABLE organisation_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ghost_organisation_id UUID NOT NULL REFERENCES organizations(id),
    claiming_tenant_id UUID NOT NULL REFERENCES organizations(id),
    status TEXT NOT NULL DEFAULT 'pending',
    verification_method TEXT,
    evidence JSONB NOT NULL DEFAULT '{}',
    reviewed_by_user_id TEXT,
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (ghost_organisation_id, claiming_tenant_id)
);

CREATE INDEX idx_org_claims_ghost ON organisation_claims(ghost_organisation_id);
CREATE INDEX idx_org_claims_tenant ON organisation_claims(claiming_tenant_id);
```

`status` values: `pending`, `under_review`, `approved`, `rejected`, `withdrawn`.

`verification_method` values: `abn_match`, `email_domain_verified`, `admin_approval`, `invitation_token`, `manual_review`.

### 1.5 `po_custody_transfers` table — transfer audit log

New table recording each custody transfer event:

```sql
CREATE TABLE po_custody_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    from_tenant_id UUID NOT NULL REFERENCES organizations(id),
    to_tenant_id UUID NOT NULL REFERENCES organizations(id),
    organisation_claim_id UUID REFERENCES organisation_claims(id),
    transferred_by_user_id TEXT,
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_custody_transfer_po ON po_custody_transfers(purchase_order_id);
```

### 1.6 Migration

Generate a Drizzle migration under `apps/api/src/database/migrations-drizzle/`. The migration must:

- Add all new columns as nullable or with safe defaults so existing data is unaffected
- Backfill existing PO rows: set `ownership_status = 'owned'` and `issuer_organisation_id = tenant_id` for all current POs (they were all created by the issuing tenant)
- Create the new tables (`organisation_claims`, `po_custody_transfers`)
- Create indexes

---

## Phase 2 — Ghost Organisation Service

### 2.1 Service Location

```
apps/api/src/modules/domain/services/
└── ghost-organisation.service.ts
```

### 2.2 Responsibilities

```typescript
@Injectable()
export class GhostOrganisationService {
  /**
   * Resolve an existing ghost org or create a new one.
   * Matching priority:
   *   1. ABN exact match
   *   2. Primary email exact match
   *   3. Legal name + email domain match
   *   4. No match → create new ghost
   */
  async resolveOrCreate(params: {
    abn?: string;
    legalName?: string;
    tradingName?: string;
    primaryEmail?: string;
    emailDomain?: string;
    phone?: string;
    tx: DrizzleDbOrTx;
  }): Promise<{ organisationId: string; created: boolean }>;

  /**
   * Find candidate ghost orgs matching the given identifiers.
   * Returns ranked results: exact → probable → ambiguous.
   */
  async findCandidates(params: {
    abn?: string;
    legalName?: string;
    primaryEmail?: string;
    emailDomain?: string;
  }): Promise<GhostCandidate[]>;

  /**
   * Get all ghost organisations visible to the given tenant
   * (i.e. ghost orgs referenced by that tenant's custodial POs).
   */
  async findGhostsByTenant(params: {
    tenantId: string;
  }): Promise<GhostOrganisation[]>;
}
```

### 2.3 Organisation Resolution Algorithm

When a manual PO capture provides issuer identity fields:

```
1. If ABN is provided:
   a. Query organizations WHERE abn = :abn AND subscription_status IN ('ghost', 'active', 'verified')
   b. If exactly one match → return it
   c. If multiple matches → log warning, return first ghost match (prefer ghost over active to avoid false association)

2. If no ABN match, and primary_email is provided:
   a. Query organizations WHERE primary_email = :email AND subscription_status = 'ghost'
   b. If exactly one match → return it

3. If no match, and legal_name + email_domain are provided:
   a. Query organizations WHERE legal_name ILIKE :name AND email_domain = :domain AND subscription_status = 'ghost'
   b. If exactly one match → return it

4. No match → create new ghost organisation:
   a. Generate a slug from the legal or trading name
   b. Insert into organizations with subscription_status = 'ghost'
   c. Set identity fields (abn, legal_name, trading_name, primary_email, email_domain, phone)
   d. Return the new record
```

A match against an `active` organisation (already subscribed) is a special case: it means both parties are on-platform. The manual capture flow should surface this to the user and suggest using the standard issuance flow instead. Do not silently create a custodial PO if the issuer is actually a subscribed tenant.

---

## Phase 3 — Manual PO Capture

### 3.1 Endpoint

```
POST /purchase-orders/capture
```

This is a new endpoint, distinct from the existing `POST /purchase-orders/:id` (update) and the standard PO creation flow. It represents a receiving tenant capturing an externally received PO.

### 3.2 Request Shape

```typescript
interface CapturePurchaseOrderDto {
  // Issuer identification (at least one required)
  issuer: {
    abn?: string;
    legalName?: string;
    tradingName?: string;
    email?: string;
    phone?: string;
    organisationId?: string;  // pre-selected ghost org
  };

  // PO header
  purchaseOrderNumber: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
  scopeOfWork?: string;
  totalAmount?: number;

  // Job association (required — the chk_po_parent constraint requires a job or claim)
  jobId?: string;
  claimId?: string;

  // Attached document reference (optional)
  sourceDocumentId?: string;
}
```

### 3.3 Response Shape

```typescript
interface CapturePurchaseOrderResponse {
  purchaseOrderId: string;
  workOrderId: string;
  issuerOrganisationId: string;
  issuerCreated: boolean;
}
```

### 3.4 Service — `ManualCaptureService`

```
apps/api/src/modules/domain/services/
└── manual-capture.service.ts
```

```typescript
@Injectable()
export class ManualCaptureService {
  constructor(
    private readonly ghostOrgService: GhostOrganisationService,
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly workOrdersRepo: WorkOrdersRepository,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async capturePurchaseOrder(params: {
    tenantId: string;
    userId: string;
    dto: CapturePurchaseOrderDto;
  }): Promise<CapturePurchaseOrderResponse>;
}
```

### 3.5 Transaction Logic

The entire capture operation executes in a single database transaction:

```
BEGIN

1. Validate the user, tenant, and permissions.
2. Resolve or create the ghost issuer organisation.
   - If dto.issuer.organisationId is provided, load and verify it.
   - Otherwise, call GhostOrganisationService.resolveOrCreate().
   - If the resolved org is an active subscribed tenant, reject with an error
     instructing the user to use the standard issuance flow.
3. Create the custodial Purchase Order:
   - tenant_id = receiving tenant
   - issuer_organisation_id = ghost org
   - recipient_organisation_id = receiving tenant
   - custodian_tenant_id = receiving tenant
   - capture_method = 'manual'
   - ownership_status = 'externally_captured'
   - created_by_user_id = user
   - Copy header fields from dto
4. Create the abbreviated Work Order:
   - tenant_id = receiving tenant
   - purchase_order_id = PO created in step 3
   - source_organisation_id = ghost org
   - source_tenant_id = null (ghost has no tenant)
   - Copy header fields from PO
   - Perspective swap: PO issuer identity → WO from; PO recipient → WO to
   - business status = 'received' (lookup resolution)
   - version_acknowledged = true (no versioning gap on manual capture)
5. Return both IDs.

COMMIT
```

The user sees the WO immediately after the transaction commits. No asynchronous processing is required for the WO to appear.

### 3.6 Idempotency

Prevent duplicate POs for the same issuer + PO number combination:

```sql
CREATE UNIQUE INDEX UQ_po_issuer_org_number
    ON purchase_orders(issuer_organisation_id, purchase_order_number)
    WHERE issuer_organisation_id IS NOT NULL
      AND purchase_order_number IS NOT NULL
      AND deleted_at IS NULL;
```

The capture service checks this constraint before inserting. If a PO already exists for the same issuer org + PO number, the service returns the existing PO and its linked WO instead of creating duplicates.

---

## Phase 4 — Work Order Workflow

### 4.1 Workflow Definition

```
apps/api/src/modules/domain/workflows/definitions/
└── work-order.workflows.ts
```

```typescript
export const workOrderStandard: WorkflowDefinition = {
  entity: 'work_order',
  name: 'standard',
  description: 'Standard WO lifecycle: received → acceptance → execution → completion',
  initialStep: 'received',
  steps: [
    {
      id: 'received',
      label: 'Received',
      transitions: [
        { to: 'accepted', action: 'accept' },
        { to: 'declined', action: 'decline' },
      ],
    },
    {
      id: 'accepted',
      label: 'Accepted',
      transitions: [
        { to: 'scheduled', action: 'schedule' },
        { to: 'in_progress', action: 'start' },
        { to: 'declined', action: 'decline' },
      ],
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      transitions: [
        { to: 'in_progress', action: 'start' },
        { to: 'accepted', action: 'unschedule' },
      ],
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      transitions: [
        { to: 'completed', action: 'complete' },
        { to: 'accepted', action: 'pause' },
      ],
    },
    {
      id: 'completed',
      label: 'Completed',
      isFinal: true,
      transitions: [],
    },
    {
      id: 'declined',
      label: 'Declined',
      isFinal: true,
      transitions: [],
    },
  ],
};
```

### 4.2 Registration

Register in the workflow registry alongside `purchaseOrderStandard`. The workflow engine already supports multiple entity types.

---

## Phase 5 — Extend DocumentIssuanceService

### 5.1 Current Behaviour

`DocumentIssuanceService.execute()` already creates a WO in the recipient tenant when `recipientTenantId` is provided. The PO fields are mapped to WO fields with a perspective swap.

### 5.2 Changes

When `execute()` creates a WO from a PO, it must now also populate:

```typescript
source_organisation_id: params.sourceTenantId  // the issuer's org ID
```

This ensures the WO tracks the issuing organisation regardless of how it was created.

No other changes to `DocumentIssuanceService` are needed for this phase. The manual capture flow bypasses `DocumentIssuanceService` because it creates both the PO and WO directly in a single transaction (there is no issuance event — the PO was externally issued, not issued through Claims Manager).

---

## Phase 6 — Organisation Claiming & Custody Transfer

### 6.1 Claiming Flow

When a new tenant registers and their identity matches an existing ghost organisation, the claiming process begins.

```
1. New tenant is created with subscription_status = 'active'.
2. System (or admin) identifies a candidate ghost organisation
   by matching ABN, legal entity name, or verified email domain.
3. An organisation_claims record is created:
   - ghost_organisation_id = ghost org
   - claiming_tenant_id = new tenant
   - status = 'pending'
4. Verification takes place (method depends on available evidence):
   - ABN match: automated verification, mark as 'approved'
   - Email domain match only: flag for manual review
   - Admin approval: admin reviews and approves/rejects
5. On approval:
   - Update organisation_claims.status = 'approved'
   - Link the ghost org to the tenant:
     a. Merge identity fields from ghost org into the tenant's org record
     b. Update ghost org: subscription_status = 'verified'
   - Trigger custody transfer for all custodial POs
```

### 6.2 Custody Transfer Service

```
apps/api/src/modules/domain/services/
└── custody-transfer.service.ts
```

```typescript
@Injectable()
export class CustodyTransferService {
  /**
   * Transfer all custodial POs attributed to a ghost issuer
   * to the newly verified issuer tenant.
   */
  async transferCustodialPurchaseOrders(params: {
    ghostOrganisationId: string;
    issuerTenantId: string;
    organisationClaimId: string;
    transferredByUserId: string;
    tx: DrizzleDbOrTx;
  }): Promise<CustodyTransferResult>;
}
```

### 6.3 Transfer Transaction

For each custodial PO attributed to the ghost organisation:

```
BEGIN

1. Find all purchase_orders WHERE
     issuer_organisation_id = :ghostOrganisationId
     AND ownership_status = 'externally_captured'

2. For each PO:
   a. Update the PO:
      - tenant_id = issuer tenant (new owner)
      - issuer_organisation_id = issuer tenant org (same entity, now verified)
      - custodian_tenant_id = null
      - ownership_status = 'transferred'
      (preserve: capture_method, created_by_user_id, created_at)
   b. Insert a po_custody_transfers record:
      - purchase_order_id = PO
      - from_tenant_id = original custodian
      - to_tenant_id = issuer tenant
      - organisation_claim_id = claim record
      - transferred_by_user_id = user
   c. The linked work_orders remain unchanged:
      - work_order.tenant_id = original receiving tenant (no change)
      - work_order.purchase_order_id = same PO ID (no change, FK still valid)
      - work_order.source_organisation_id = same org (no change)
      - work_order.source_tenant_id = issuer tenant (updated — now subscribed)

3. Update the ghost organisation:
   - subscription_status = 'verified'

COMMIT
```

### 6.4 Data Protection During Transfer

When a PO is transferred, the following receiving-tenant data must NOT be exposed to the issuer:

| Data | Location | Protected By |
|---|---|---|
| Internal notes, margins, costs | `work_orders` fields (owned by receiver) | Receiver's WO remains in receiver's tenant; issuer has no access |
| Staff comments, resource allocation | WO-associated records | Tenant-scoped queries prevent cross-tenant access |
| Internal attachments, risk assessments | `attachments` with `tenant_id = receiver` | Tenant scoping |
| Workflow metadata | `entity_workflow_state` with receiver's tenant | Tenant scoping |

Shared commercial data on the PO (PO number, scope, line items, rates, totals) becomes accessible to the issuer tenant after transfer. This is correct — this data was commercially issued by the issuer.

### 6.5 Receiving Tenant Access After Transfer

After a PO is transferred to the issuer tenant, the receiving tenant retains access to the commercial information through:

1. Their own Work Order (`work_orders` row with `tenant_id = receiving tenant`)
2. The WO's line item hierarchy (groups/combos/items scoped to the receiver)
3. The WO's `work_order_payload` JSONB (snapshot of the PO data at time of receipt)

The receiver does NOT retain direct access to the PO row (it now belongs to the issuer tenant). If the receiver needs to view the original PO data, they access it through their WO.

---

## Phase 7 — Audit & Provenance

### 7.1 Fields Preserved Through Lifecycle

Every PO captures the following provenance fields that must never be overwritten during custody transfer:

| Field | Set When | Preserved |
|---|---|---|
| `created_by_user_id` | PO is created (manual capture or standard) | Always |
| `created_at` | PO is created | Always |
| `capture_method` | Manual capture sets to `'manual'` | Always |
| `custodian_tenant_id` | Manual capture sets to receiving tenant | Cleared on transfer, but original value preserved in `po_custody_transfers.from_tenant_id` |

### 7.2 Audit Trail

The `po_custody_transfers` table provides a complete history:

```
Who originally captured the PO → purchase_orders.created_by_user_id
Which tenant was custodian → po_custody_transfers.from_tenant_id
When capture occurred → purchase_orders.created_at
When transfer occurred → po_custody_transfers.transferred_at
Who approved the transfer → po_custody_transfers.transferred_by_user_id
Why (claim reference) → po_custody_transfers.organisation_claim_id
```

The `organisation_claims` table provides:

```
When the ghost org was claimed → organisation_claims.created_at
How it was verified → organisation_claims.verification_method
Who reviewed it → organisation_claims.reviewed_by_user_id
Evidence → organisation_claims.evidence (JSONB)
```

---

## Phase 8 — API Endpoints Summary

### New Endpoints

| Method | Route | Purpose | Auth |
|---|---|---|---|
| `POST` | `/purchase-orders/capture` | Manual PO capture (ghost issuer + custodial PO + WO) | Authenticated tenant user |
| `GET` | `/organisations/ghosts` | List ghost organisations associated with the tenant's custodial POs | Admin |
| `POST` | `/organisations/ghosts/:id/claim` | Initiate a claim on a ghost organisation | Admin |
| `GET` | `/organisation-claims` | List pending/active claims for the tenant | Admin |
| `POST` | `/organisation-claims/:id/approve` | Approve a claim and trigger custody transfer | Platform admin |
| `POST` | `/organisation-claims/:id/reject` | Reject a claim | Platform admin |

### Modified Endpoints

| Method | Route | Change |
|---|---|---|
| `GET` | `/purchase-orders` | Support filtering by `ownership_status` and `capture_method` |
| `GET` | `/purchase-orders/:id` | Include `issuer_organisation_id`, `ownership_status`, `custodian_tenant_id` in response |
| `GET` | `/work-orders/:id` | Include `source_organisation_id` in response |

---

## Phase 9 — Frontend

### 9.1 Manual PO Capture Form

Add a "Capture External PO" action accessible from:
- The Work Orders list page toolbar
- The Job detail page (Work Orders tab)

The form collects:
- Issuer identity fields (business name, ABN, email, phone)
- PO number (required)
- Header fields (name, dates, scope, total amount)
- Job/claim association

On submit, calls `POST /purchase-orders/capture`. On success, navigates to the newly created Work Order detail page.

### 9.2 Ghost Organisation Display

When viewing a custodial PO or a WO sourced from a ghost org, the UI displays:
- A badge indicating the issuer is an external (non-subscribed) organisation
- The issuer's known identity fields (name, ABN, email)
- The capture method and date

### 9.3 Claim Management (Admin)

An admin page showing:
- Ghost organisations associated with the tenant
- Pending claims
- Claim history
- Ability to initiate a claim on a ghost org (if the current tenant believes they represent that organisation)

---

## Sequence Diagrams

### Scenario 1: Both Parties Subscribed (Existing Flow — Extended)

```
Issuer Tenant             Claims Manager               Receiver Tenant
     │                         │                              │
     │  Create PO              │                              │
     │────────────────────────>│                              │
     │                         │ Save PO                      │
     │                         │ (tenant_id = issuer)         │
     │                         │ (issuer_org_id = issuer)     │
     │                         │ (recipient_org_id = receiver)│
     │                         │ (ownership_status = 'owned') │
     │                         │                              │
     │  Approve PO             │                              │
     │────────────────────────>│                              │
     │                         │ Workflow: draft → approved    │
     │                         │                              │
     │  Issue PO               │                              │
     │────────────────────────>│                              │
     │                         │ Workflow: approved → issued   │
     │                         │ DocumentIssuanceService:      │
     │                         │   1. Create version snapshot  │
     │                         │   2. Create WO in receiver    │
     │                         │      (tenant_id = receiver)   │
     │                         │      (source_org_id = issuer) │
     │                         │      (source_tenant = issuer) │
     │                         │   3. Copy line items          │
     │                         │   4. Copy party associations  │
     │                         │──────────────────────────────>│
     │                         │                     WO visible│
     │                         │                              │
     │                         │              Accept WO       │
     │                         │<──────────────────────────────│
     │                         │ Workflow: received → accepted │
     │   PO acknowledged       │                              │
     │<────────────────────────│                              │
```

### Scenario 2: Ghost Issuer — Manual Capture

```
External Builder          Receiver Tenant              Claims Manager
     │                         │                              │
     │  Emails PO to vendor    │                              │
     │────────────────────────>│                              │
     │                         │                              │
     │                         │ POST /purchase-orders/capture│
     │                         │─────────────────────────────>│
     │                         │                              │
     │                         │              BEGIN TRANSACTION│
     │                         │              1. Resolve ghost │
     │                         │                 org (builder) │
     │                         │              2. Create PO     │
     │                         │                 tenant=vendor  │
     │                         │                 issuer=ghost   │
     │                         │                 custody=vendor │
     │                         │                 status=ext_cap │
     │                         │              3. Create WO      │
     │                         │                 tenant=vendor  │
     │                         │                 po_id=PO       │
     │                         │                 src_org=ghost  │
     │                         │              COMMIT           │
     │                         │                              │
     │                         │ { purchaseOrderId, workOrderId }
     │                         │<─────────────────────────────│
     │                         │                              │
     │                         │ WO visible immediately       │
```

### Scenario 3: Ghost Issuer Later Subscribes

```
Builder (new tenant)      Claims Manager               Vendor (existing tenant)
     │                         │                              │
     │  Register / Subscribe   │                              │
     │────────────────────────>│                              │
     │                         │ Create active tenant         │
     │                         │                              │
     │  Claim ghost org        │                              │
     │────────────────────────>│                              │
     │                         │ Create organisation_claims   │
     │                         │ status = 'pending'           │
     │                         │                              │
     │                         │ Verify (ABN match)           │
     │                         │                              │
     │  Admin approves         │                              │
     │────────────────────────>│                              │
     │                         │              BEGIN TRANSACTION│
     │                         │              1. Approve claim │
     │                         │              2. Link ghost org│
     │                         │                 → verified    │
     │                         │              3. For each PO:  │
     │                         │                 tenant → builder
     │                         │                 status → transferred
     │                         │                 custodian → null
     │                         │              4. Log transfers │
     │                         │              5. Update WOs:   │
     │                         │                 source_tenant │
     │                         │                 = builder     │
     │                         │              COMMIT           │
     │                         │                              │
     │  POs now visible        │                              │
     │  in builder's account   │            WOs unchanged     │
     │                         │            in vendor's account│
```

### Scenario 4: Duplicate Prevention

```
Receiver Tenant              Claims Manager
     │                              │
     │ POST /purchase-orders/capture│
     │ (PO# = "PO-2024-001",       │
     │  issuer ABN = "123456789")   │
     │─────────────────────────────>│
     │                              │
     │                 Resolve ghost by ABN
     │                 → found: org_ghost_abc
     │                              │
     │                 Check: purchase_orders
     │                   WHERE issuer_org = org_ghost_abc
     │                   AND po_number = 'PO-2024-001'
     │                              │
     │                 Already exists → return existing PO + WO
     │                              │
     │ { purchaseOrderId: existing, │
     │   workOrderId: existing,     │
     │   issuerCreated: false }     │
     │<─────────────────────────────│
```

---

## Implementation Order

| Step | Description | Depends On |
|---|---|---|
| 1 | Drizzle schema changes (`organizations`, `purchase_orders`, `work_orders`, new tables) | — |
| 2 | Generate and review migration | Step 1 |
| 3 | `GhostOrganisationService` (resolve/create) | Step 2 |
| 4 | `ManualCaptureService` (capture transaction) | Step 3 |
| 5 | `POST /purchase-orders/capture` controller endpoint | Step 4 |
| 6 | Work order workflow definition | Step 2 |
| 7 | Extend `DocumentIssuanceService` with `source_organisation_id` | Step 2 |
| 8 | Frontend: manual capture form | Step 5 |
| 9 | Frontend: ghost org display on PO/WO detail | Step 5 |
| 10 | `CustodyTransferService` | Step 2 |
| 11 | Organisation claim endpoints and admin UI | Step 10 |
| 12 | Backfill migration for existing PO data | Step 2 |

Steps 3–5 and 6–7 can be developed in parallel.

---

## Invariants

The implementation must enforce these at all times:

1. Every `purchase_orders` row has a non-null `tenant_id` referencing an active tenant.
2. A ghost organisation has `subscription_status = 'ghost'` and zero rows in `organization_users`.
3. A custodial PO has `ownership_status = 'externally_captured'` and `custodian_tenant_id` set.
4. `issuer_organisation_id` is the commercial issuer; `tenant_id` is the record owner. These may differ for custodial POs.
5. Manual capture creates the PO and WO in a single database transaction.
6. The receiving tenant sees the WO immediately after capture (no async dependency).
7. A WO's `tenant_id` never changes during custody transfer — only the PO moves.
8. Custody transfer preserves `created_by_user_id`, `created_at`, and `capture_method`.
9. The unique index on `(issuer_organisation_id, purchase_order_number)` prevents duplicate POs from the same issuer.
10. Email domain alone is not sufficient proof of organisation ownership.
11. Tenant-scoped queries prevent the issuer from seeing receiver-private WO data after transfer.
12. Every custody transfer is logged in `po_custody_transfers` with full provenance.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Ghost org proliferation (many duplicates for the same real company) | Resolution algorithm with ABN as primary key; admin merge tooling in future phase |
| Custody transfer breaks FK references | WO FK (`purchase_order_id`) remains valid because the PO row ID does not change; only `tenant_id` changes |
| Receiver loses access to PO data after transfer | WO retains a copy of all relevant commercial data via its own fields and `work_order_payload` |
| False organisation claim (impersonation) | Multi-factor verification; ABN alone is not auto-approved for domain-match-only claims; admin review required |
| `chk_po_parent` constraint (`claim_id OR job_id`) may not hold for custodial POs if the receiver doesn't have a matching job | Manual capture form requires job or claim association; the custodial PO is associated with the receiver's job |
| PO `tenant_id` changing during transfer may break tenant-scoped indexes | Ensure all PO indexes are re-evaluated; the unique index on `(tenant_id, external_id)` must accommodate the new tenant |

---

*Previous: [39 — Filesystem Module](./39_FILESYSTEM_MODULE.md)*
