# 44 — Cross-Tenant Estimate / Proposal

## Objective

Implement the cross-tenant pattern for the Estimate (issuer) / Proposal (receiver) document pair, enabling:

- A vendor to issue an Estimate (Quote) that creates a Proposal in the buyer's tenant
- A buyer to manually capture an external Estimate from a non-subscribed vendor (ghost org)
- Line-item sync (quote groups/combos/items copied to proposal groups/combos/items)
- Perspective swap (`quoteFrom`/`quoteTo` → `proposalFrom`/`proposalTo`)
- Custody transfer when a ghost vendor later subscribes
- Recursive price incorporation from downstream Proposals into the vendor's own Estimate

**Architecture reference:** [41_CROSS_TENANT_SUPPLY_CHAIN_ARCHITECTURE.md](./41_CROSS_TENANT_SUPPLY_CHAIN_ARCHITECTURE.md)

**PO/WO reference implementation:** [40_CROSS_TENANT_PO_WO.md](./40_CROSS_TENANT_PO_WO.md)

---

## Scope & Exclusions

### In scope

- Schema additions to `quotes` (issuer-side org/custody fields)
- Schema additions to `proposals` (source tenant/org fields)
- Extend `DocumentIssuanceService.createProposalFromQuote()` with line items, perspective swap, and source tracking
- Manual Estimate capture API (`POST /quotes/capture`)
- Custody transfer support for quotes
- Idempotency constraints
- Frontend capture form
- Proposal accept/decline endpoints

### Out of scope (future phases)

- Automated price comparison across multiple proposals
- Negotiation/counter-offer workflows
- Pub/Sub event propagation
- Proposal validity/expiry enforcement

---

## Current State

| Aspect | Status |
|--------|--------|
| `proposals.quote_id` FK | Exists (NOT NULL, cross-tenant capable) |
| `DocumentIssuanceService` mapping | `quote → proposal` in `RECIPIENT_TYPE_MAP` |
| `createProposalFromQuote()` | Implemented — header only, no line items, no perspective swap |
| Cross-tenant org fields on `quotes` | Missing |
| Cross-tenant source fields on `proposals` | Missing (`source_tenant_id`, `source_organisation_id`) |
| Version fields on `proposals` | Exist (`source_version_number`, `latest_available_version`, `version_acknowledged`) |
| Proposal line-item hierarchy | Exists (proposal_groups/combos/items with `source_rfq_*_id`) |
| Perspective swap in issuance | Not implemented (`quoteFrom`/`quoteTo` not mapped) |
| Proposal accept/decline | Not implemented (planned in 33d) |
| "Estimate" entity | Same as `quotes` table — UI terminology only |

---

## Phase 1 — Schema Changes

### 1.1 `quotes` table — issuer-side fields

```sql
ALTER TABLE quotes ADD COLUMN issuer_organisation_id UUID
    REFERENCES organizations(id);

ALTER TABLE quotes ADD COLUMN recipient_organisation_id UUID
    REFERENCES organizations(id);

ALTER TABLE quotes ADD COLUMN custodian_tenant_id UUID
    REFERENCES organizations(id);

ALTER TABLE quotes ADD COLUMN capture_method TEXT;

ALTER TABLE quotes ADD COLUMN ownership_status TEXT NOT NULL DEFAULT 'owned';

CREATE INDEX idx_quotes_issuer_org ON quotes(issuer_organisation_id);
CREATE INDEX idx_quotes_ownership ON quotes(ownership_status);
```

### 1.2 `proposals` table — source tracking fields

```sql
ALTER TABLE proposals ADD COLUMN source_tenant_id UUID;

ALTER TABLE proposals ADD COLUMN source_organisation_id UUID
    REFERENCES organizations(id);
```

### 1.3 Idempotency constraints

```sql
-- Prevent duplicate quotes from the same issuer
CREATE UNIQUE INDEX UQ_quotes_issuer_org_number
    ON quotes(issuer_organisation_id, quote_number)
    WHERE issuer_organisation_id IS NOT NULL
      AND quote_number IS NOT NULL
      AND deleted_at IS NULL;
```

The existing `proposals.quote_id` effectively prevents duplicate proposals per source quote per tenant (enforced by the existing index structure).

### 1.4 Migration

Generate a Drizzle migration. The migration must:

- Add all new columns as nullable or with safe defaults
- Backfill existing quotes: set `ownership_status = 'owned'` and `issuer_organisation_id = tenant_id`
- Backfill existing proposals with `source_tenant_id` and `source_organisation_id` from the linked quote where possible

---

## Phase 2 — Service Changes

### 2.1 Extend `createProposalFromQuote()`

The existing method copies header fields only. Extend it to:

1. **Set source tracking fields:**

```typescript
sourceTenantId: params.sourceTenantId,
sourceOrganisationId: params.sourceTenantId, // vendor org
```

2. **Perspective swap:**

```typescript
proposalFrom: src.quoteFrom,   // vendor's identity → "from" on proposal
proposalTo: src.quoteTo,       // buyer's identity → "to" on proposal
proposalFromName: src.quoteFromName ?? src.quoteToName,
proposalToName: src.quoteToName ?? src.quoteFromName,
```

3. **Copy line items (groups/combos/items):**

```typescript
// Load quote hierarchy
const groups = await this.quoteGroupsRepo.findByQuote({ quoteId, tx });
const combos = await this.quoteCombosRepo.findByGroups({ groupIds, tx });
const items = await this.quoteItemsRepo.findByGroupsAndCombos({ groupIds, comboIds, tx });

// Create proposal hierarchy with lineage tracking
for (const group of groups) {
  const proposalGroup = await this.proposalGroupsRepo.create({
    data: {
      tenantId: params.recipientTenantId,
      proposalId: proposalId,
      sourceRfqGroupId: group.id,  // trace back to quote group via this field
      groupLabelLookupId: group.groupLabelLookupId,
      description: group.description,
      dimensions: group.dimensions,
      sortIndex: group.sortIndex,
      totals: group.totals,
    },
    tx,
  });

  // ... copy combos and items similarly
}
```

4. **Exclude internal/private items:**

Quote items marked `internal = true` must NOT be copied to the proposal. These represent the vendor's private cost analysis (buy costs, markup values, margins).

```typescript
const visibleItems = items.filter(item => !item.internal);
```

5. **Strip margin fields:**

When copying items, exclude fields that reveal the vendor's cost structure:

```typescript
// Do NOT copy to proposal:
// - buyCost
// - markupType
// - markupValue
// - allocatedCost
// - committedCost
```

### 2.2 Extend `QuotesService` for org field population

When a subscribed vendor creates a quote through the standard flow:

```typescript
issuer_organisation_id = vendor tenant org
recipient_organisation_id = buyer org (resolved from job → claim → issuer)
ownership_status = 'owned'
```

---

## Phase 3 — Manual Estimate Capture

### 3.1 Endpoint

```text
POST /quotes/capture
```

(Also aliased as `POST /estimates/capture` if the frontend uses Estimate terminology.)

### 3.2 Request Shape

```typescript
interface CaptureEstimateDto {
  // Issuer identification (at least one required)
  issuer: {
    abn?: string;
    legalName?: string;
    tradingName?: string;
    email?: string;
    phone?: string;
    organisationId?: string;
  };

  // Estimate header
  quoteNumber?: string;
  name: string;
  reference?: string;
  note?: string;
  quoteDate?: string;
  expiresInDays?: number;
  subTotal?: number;
  totalTax?: number;
  totalAmount?: number;

  // Associations (at least one required)
  jobId?: string;
  claimId?: string;

  // RFQ linkage (if this estimate is a response to an RFQ we issued)
  rfqId?: string;

  // Source document
  sourceDocumentId?: string;
}
```

### 3.3 Response Shape

```typescript
interface CaptureEstimateResponse {
  quoteId: string;
  proposalId: string;
  issuerOrganisationId: string;
  issuerCreated: boolean;
}
```

### 3.4 Transaction Logic

```text
BEGIN

1. Validate user, tenant, and permissions.
2. Resolve or create the ghost issuer organisation (the vendor).
   - If resolved org is an active subscribed tenant, reject with error.
3. Create the custodial Quote:
   - tenant_id = receiving tenant (custodian / buyer)
   - issuer_organisation_id = ghost org (vendor)
   - recipient_organisation_id = receiving tenant org (buyer)
   - custodian_tenant_id = receiving tenant
   - capture_method = 'manual'
   - ownership_status = 'externally_captured'
   - Header fields from dto
   - job_id, claim_id associations
4. Create the Proposal:
   - tenant_id = receiving tenant (buyer)
   - quote_id = quote from step 3
   - source_tenant_id = null (ghost)
   - source_organisation_id = ghost org
   - rfq_id = dto.rfqId (if responding to an RFQ we issued)
   - status = 'Received' (lookup resolution)
   - version_acknowledged = true (no version gap on manual capture)
   - proposalFrom = issuer identity snapshot
   - proposalTo = receiver identity snapshot
5. Return both IDs.

COMMIT
```

### 3.5 Idempotency

Check the unique constraint before inserting. If a Quote already exists for the same issuer org + quote number, return the existing Quote and its linked Proposal.

---

## Phase 4 — Proposal Accept/Decline

### 4.1 Accept Endpoint

```text
POST /proposals/:id/accept
```

When a buyer accepts a Proposal:
1. Update proposal status to 'Accepted'
2. This is the trigger for the buyer to create a Purchase Order (next step in the supply chain)
3. The PO references the accepted proposal via the job/claim context

### 4.2 Decline Endpoint

```text
POST /proposals/:id/decline
```

```typescript
interface DeclineProposalDto {
  reason?: string;
}
```

When a buyer declines a Proposal:
1. Update proposal status to 'Declined'
2. Optionally publish a `ProposalDeclined` event (future — when outbox is implemented)

---

## Phase 5 — Recursive Price Incorporation

When a vendor receives Proposals from downstream vendors (in response to sub-RFQs they issued), they incorporate the winning prices into their own Estimate.

### Pattern

1. Vendor's Estimate has items marked for downstream pricing
2. Vendor issued sub-RFQs for those items (via `rfqs.quote_id`)
3. Downstream vendors responded with Estimates → Proposals received
4. Vendor selects a winning Proposal
5. Vendor updates their own Estimate's line items with the downstream pricing

### Implementation

This is a **local operation** within the vendor's tenant — not a cross-tenant event. The service method:

```typescript
async incorporateProposalPricing(params: {
  quoteId: string;      // vendor's own Estimate
  proposalId: string;   // winning downstream Proposal
  itemMappings: Array<{
    quoteItemId: string;     // item in vendor's Estimate
    proposalItemId: string;  // corresponding item in the Proposal
  }>;
}): Promise<void> {
  // For each mapping:
  // 1. Read the proposal item's unit cost / totals
  // 2. Update the quote item's buyCost, allocatedCost
  // 3. Recalculate totals on the quote
}
```

The vendor can then mark items as "priced" and proceed to issue their Estimate upstream once all items have coverage.

---

## Phase 6 — Custody Transfer

Extend `CustodyTransferService` to include quotes in the transfer query:

```text
Find all quotes WHERE
  issuer_organisation_id = :ghostOrganisationId
  AND ownership_status = 'externally_captured'
```

For each quote:
1. Update `tenant_id` = new issuer tenant (vendor)
2. Update `custodian_tenant_id` = null
3. Update `ownership_status` = 'transferred'
4. Log transfer
5. Update linked proposals: `source_tenant_id` = new issuer tenant
6. Quote line items (groups/combos/items) transfer with the quote (same `tenant_id` update)

The proposal's `tenant_id` remains unchanged — it still belongs to the buyer.

---

## Phase 7 — Frontend

### 7.1 Manual Estimate Capture Form

Add a "Capture External Estimate" action accessible from:
- The Proposals list page toolbar
- The Job detail page (Proposals tab)
- The RFQ detail page (if capturing a response to an issued RFQ)

The form collects:
- Issuer identity fields (vendor business name, ABN, email, phone)
- Quote/estimate number (optional)
- Name (required)
- Financial totals
- Job/claim/RFQ association
- Expiry

On submit, calls `POST /quotes/capture`. On success, navigates to the newly created Proposal detail page.

### 7.2 Proposal Actions

Add accept/decline buttons on the Proposal detail page:
- "Accept" → transitions to Accepted status, prompts to create PO
- "Decline" → transitions to Declined status with optional reason

### 7.3 Ghost Issuer Display

When viewing a custodial Quote or a Proposal sourced from a ghost org:
- Badge indicating the issuer is an external (non-subscribed) vendor
- Issuer's known identity fields
- Capture method and date

---

## Lifecycle States

### Quote/Estimate (issuer-side)

| Status | Meaning |
|--------|---------|
| Draft | Estimate being assembled |
| Approved | Estimate reviewed and approved internally |
| Published | Estimate issued to the buyer |

### Proposal (receiver-side)

| Status | Meaning |
|--------|---------|
| Received | Proposal received from vendor |
| Under Review | Proposal is being evaluated |
| Accepted | Buyer has accepted the proposal |
| Declined | Buyer has declined the proposal |
| Expired | Proposal validity period has passed |

---

## Data Privacy in Issuance

When a Quote is issued as a Proposal, the following fields are explicitly excluded from the copy:

| Field | Reason |
|-------|--------|
| `buyCost` on quote items | Vendor's internal purchase cost |
| `markupType` / `markupValue` | Vendor's margin structure |
| `allocatedCost` / `committedCost` | Internal cost tracking |
| Items where `internal = true` | Vendor's private line items |
| `approvalInfo` on the quote | Internal approval workflow data |
| `customData` (selectively) | May contain internal analysis |

The Proposal only receives the commercially visible pricing: `unitCost`, `quantity`, `tax`, and calculated totals.

---

## Sequence Diagrams

### Scenario 1: Subscribed Vendor Issues Estimate

```text
Vendor Tenant              Claims Manager               Buyer Tenant
     │                         │                              │
     │  Create Quote           │                              │
     │────────────────────────>│                              │
     │                         │ Save Quote                   │
     │                         │ (issuer_org = vendor)        │
     │                         │ (recipient_org = buyer)      │
     │                         │                              │
     │  Publish/Issue Quote    │                              │
     │────────────────────────>│                              │
     │                         │ DocumentIssuanceService:     │
     │                         │   1. Create Proposal         │
     │                         │      (quote_id = source)     │
     │                         │      (source_tenant = vendor)│
     │                         │   2. Perspective swap        │
     │                         │   3. Copy line items         │
     │                         │      (exclude internal)      │
     │                         │      (strip margins)         │
     │                         │   4. Set version fields      │
     │                         │──────────────────────────────>│
     │                         │                Proposal visible│
     │                         │                              │
     │                         │         Accept Proposal      │
     │                         │<──────────────────────────────│
     │                         │ Create PO (next pair in chain)│
```

### Scenario 2: Buyer Captures External Estimate

```text
External Vendor            Buyer Tenant                Claims Manager
     │                         │                              │
     │  Sends estimate (email) │                              │
     │────────────────────────>│                              │
     │                         │ POST /quotes/capture         │
     │                         │─────────────────────────────>│
     │                         │              BEGIN TRANSACTION│
     │                         │              1. Resolve ghost │
     │                         │              2. Create Quote  │
     │                         │                 custody=buyer │
     │                         │              3. Create Proposal│
     │                         │                 tenant=buyer  │
     │                         │              COMMIT           │
     │                         │<─────────────────────────────│
     │                         │ Proposal visible immediately │
```

### Scenario 3: Recursive Price Incorporation

```text
Vendor A                   Claims Manager
     │                         │
     │  Estimate with 10 items │
     │  3 items need sub-pricing│
     │                         │
     │  Issue sub-RFQs         │
     │────────────────────────>│ → Jobs in Vendor B, C
     │                         │
     │  (time passes)          │
     │                         │
     │  Receives Proposals     │
     │  from B and C           │
     │<────────────────────────│
     │                         │
     │  Selects winners        │
     │  incorporateProposalPricing()
     │────────────────────────>│
     │                         │ Updates quote items:
     │                         │   item.buyCost = proposal price
     │                         │   item.allocatedCost = proposal price
     │                         │                              
     │  All items now priced   │
     │  Issues Estimate upstream│
     │────────────────────────>│ → Proposal in Buyer's tenant
```

---

## Implementation Order

| Step | Description | Depends On |
|------|-------------|-----------|
| 1 | Drizzle schema changes (`quotes` + `proposals` columns) | — |
| 2 | Generate and review migration | Step 1 |
| 3 | Extend `createProposalFromQuote()` — source fields + perspective swap | Step 2 |
| 4 | Extend `createProposalFromQuote()` — line-item copy with privacy filtering | Step 3 |
| 5 | Auto-populate org fields on standard quote create | Step 2 |
| 6 | Manual capture service and endpoint | Step 2 |
| 7 | Proposal accept/decline endpoints | Step 2 |
| 8 | Frontend: capture form | Step 6 |
| 9 | Frontend: accept/decline UI | Step 7 |
| 10 | `incorporateProposalPricing()` service method | Step 2 |
| 11 | Extend custody transfer to include quotes | Step 2 |
| 12 | Backfill migration for existing data | Step 2 |

Steps 3–5 and 6–7 can be developed in parallel.

---

*Previous: [43 — Cross-Tenant RFQ/Job](./43_CROSS_TENANT_RFQ_JOB.md)*
