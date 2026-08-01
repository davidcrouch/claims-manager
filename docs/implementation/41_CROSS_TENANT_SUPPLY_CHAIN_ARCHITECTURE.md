# 41 — Cross-Tenant Supply Chain Architecture

## Overview

Claims Manager supports a recursive supply chain where any organisation may simultaneously act as a buyer (issuing work downstream) and a vendor (responding to work from upstream). Commercial documents flow between organisations as **issuer/receiver document pairs**:

| Pair | Issuer Table | Receiver Table | Direction | Commercial Purpose |
|------|-------------|----------------|-----------|-------------------|
| PO / WO | `purchase_orders` | `work_orders` | Buyer → Vendor | Work instruction |
| Invoice / Bill | `invoices` | `bills` | Vendor → Buyer | Payment demand |
| RFQ / Job | `rfqs` | `jobs` | Buyer → Vendor | Pricing request |
| Estimate / Proposal | `quotes` | `proposals` | Vendor → Buyer | Pricing response |

A complete procurement cycle chains all four pairs:

```text
RFQ (Buyer issues)
    → Job (Vendor receives)
        → Estimate (Vendor issues)
            → Proposal (Buyer receives)
                → PO (Buyer issues)
                    → WO (Vendor receives)
                        → Invoice (Vendor issues)
                            → Bill (Buyer receives)
```

Each step is a standard cross-tenant document issuance. No special bidirectional logic exists — a "response" is simply the next pair in the chain, issued in the reverse direction.

---

## Recursive Supply Chain

Every tenant sits in the middle of a supply chain and plays both roles:

```text
Upstream Buyer              This Tenant                 Downstream Vendor
═══════════════             ═══════════                 ═════════════════

RFQ (issued) ───────────►   Job (received)
                             │
                             ├─ assembles Estimate
                             ├─ identifies sub-scope needing downstream pricing
                             │
                             RFQ (issues subset) ──────► Job (received)
                                                          │
                                                          Estimate (issued) ─► Proposal (received by this tenant)
                             │
                             ├─ incorporates winning Proposal into own Estimate
                             ├─ repeats until all items have coverage
                             │
                             Estimate (issues) ────────► Proposal (upstream buyer receives)
```

There is no depth limit. Vendor B could further sub-contract to Vendor C using the same pattern. The architecture handles this naturally because each pair is independently reusable at every supply chain level.

### Line-item lineage

Traceability flows through `source_*_id` fields at each level:

```text
Quote items ──(source_quote_item_id)──► RFQ items
RFQ items ──(scope snapshot)──► Job (via rfqPayload)
Proposal items ──(source_rfq_item_id)──► trace back to RFQ scope
Quote items updated ◄── prices from winning Proposal items
```

This allows any buyer to trace which downstream items rolled up into the price they received.

---

## Generalised Cross-Tenant Document Pair

Every pair follows an identical structural pattern:

```text
┌─────────────────────────────────────────────────────────────────┐
│ ISSUER TABLE (tenant A)                                         │
│                                                                 │
│  • tenant_id = issuer tenant (record owner)                     │
│  • issuer_organisation_id = commercial issuer org               │
│  • recipient_organisation_id = intended recipient org           │
│  • Business data (amounts, dates, scope, line items)            │
│                                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    Cross-tenant FK (intentional)
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ RECEIVER TABLE (tenant B)                                       │
│                                                                 │
│  • tenant_id = receiver tenant (record owner)                   │
│  • source_{issuer_entity}_id = FK to issuer's record            │
│  • source_tenant_id = issuer tenant (if subscribed)             │
│  • source_organisation_id = issuer org (ghost or subscribed)    │
│  • Operational data (status, notes, private fields)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The FK intentionally crosses tenant boundaries. It is a system-level link, not subject to tenant-scoped queries. Standard tenant-scoped queries filter by `tenant_id` on each table independently.

---

## Schema Contract

### Issuer-side table — required columns

Every issuer table must include these columns to support the cross-tenant pattern:

| Column | Type | Purpose |
|--------|------|---------|
| `issuer_organisation_id` | UUID FK → organizations | Commercial issuer (may be a ghost org) |
| `recipient_organisation_id` | UUID FK → organizations | Commercial recipient |
| `custodian_tenant_id` | UUID FK → organizations | Tenant holding custody when issuer is a ghost |
| `capture_method` | TEXT | `null` (standard), `manual`, `email`, `automated` |
| `ownership_status` | TEXT NOT NULL DEFAULT 'owned' | `owned`, `externally_captured`, `claimed`, `transferred` |

### Receiver-side table — required columns

| Column | Type | Purpose |
|--------|------|---------|
| `source_{issuer_entity}_id` | UUID FK → issuer table | Link to the source issuer record |
| `source_tenant_id` | UUID | Issuing tenant (null if ghost issuer) |
| `source_organisation_id` | UUID FK → organizations | Issuing org (ghost or subscribed) |
| `source_version_number` | INTEGER NOT NULL DEFAULT 1 | Version of the source doc when copy was created |
| `latest_available_version` | INTEGER NOT NULL DEFAULT 1 | Latest version available from issuer |
| `version_acknowledged` | BOOLEAN NOT NULL DEFAULT true | Receiver has seen the latest version |

### Field semantics per scenario

**Standard issuance (subscribed issuer creates and issues):**

```text
ISSUER TABLE:
  tenant_id = issuer tenant
  issuer_organisation_id = issuer tenant org
  recipient_organisation_id = receiver tenant org
  custodian_tenant_id = null
  capture_method = null
  ownership_status = 'owned'

RECEIVER TABLE:
  tenant_id = receiver tenant
  source_{entity}_id = issuer record ID
  source_tenant_id = issuer tenant
  source_organisation_id = issuer tenant org
```

**Manual capture (receiver captures external doc from ghost issuer):**

```text
ISSUER TABLE (custodial):
  tenant_id = receiving tenant (custodian)
  issuer_organisation_id = ghost organisation
  recipient_organisation_id = receiving tenant org
  custodian_tenant_id = receiving tenant
  capture_method = 'manual'
  ownership_status = 'externally_captured'

RECEIVER TABLE:
  tenant_id = receiving tenant
  source_{entity}_id = custodial record ID (same tenant)
  source_tenant_id = null (ghost has no tenant)
  source_organisation_id = ghost organisation
```

**After custody transfer (ghost subscribes):**

```text
ISSUER TABLE (transferred):
  tenant_id = new issuer tenant
  issuer_organisation_id = issuer tenant org (same org, now verified)
  recipient_organisation_id = receiving tenant org
  custodian_tenant_id = null (cleared)
  capture_method = 'manual' (preserved for audit)
  ownership_status = 'transferred'

RECEIVER TABLE (unchanged):
  tenant_id = receiving tenant (no change)
  source_{entity}_id = same record ID (no change)
  source_tenant_id = new issuer tenant (updated)
  source_organisation_id = same org (no change)
```

---

## Ghost Organisation Pattern

All four document pairs share a single `GhostOrganisationService` (implemented in doc 40, Phase 2).

A ghost organisation is an `organizations` record with `subscription_status = 'ghost'`. It:

- Has no users, no login, no config
- Contains identity fields: `abn`, `legal_name`, `trading_name`, `primary_email`, `email_domain`, `phone`
- Is resolved using a priority-based matching algorithm (ABN → email → legal name + domain → create new)

No additional ghost organisation infrastructure is needed beyond what doc 40 provides. Each pair-specific plan reuses the existing service.

---

## Manual Capture Transaction Pattern

When a subscribed tenant receives a commercial document from a non-subscribed organisation (via email, post, or other external channel), they manually capture it. The transaction template is:

```text
BEGIN

1. Validate user, tenant, and permissions
2. Resolve or create the ghost issuer organisation
   - If the resolved org is active (subscribed), reject and instruct user
     to use the standard digital issuance flow
3. Create the custodial issuer-side record:
   - tenant_id = receiving tenant (custodian)
   - issuer_organisation_id = ghost org
   - recipient_organisation_id = receiving tenant org
   - custodian_tenant_id = receiving tenant
   - capture_method = 'manual'
   - ownership_status = 'externally_captured'
4. Create the receiver-side record:
   - tenant_id = receiving tenant
   - source_{entity}_id = custodial record from step 3
   - source_tenant_id = null
   - source_organisation_id = ghost org
   - business_status = initial state (e.g. 'received')
5. Return both IDs

COMMIT
```

The user sees the receiver-side record immediately. No asynchronous processing is required for it to appear.

### Idempotency

Each pair defines a unique constraint on the issuer table to prevent duplicates:

| Pair | Constraint |
|------|-----------|
| PO / WO | `UNIQUE(issuer_organisation_id, purchase_order_number)` |
| Invoice / Bill | `UNIQUE(issuer_organisation_id, invoice_number)` |
| RFQ / Job | `UNIQUE(issuer_organisation_id, rfq_number)` |
| Estimate / Proposal | `UNIQUE(issuer_organisation_id, quote_number)` |

Additionally, the receiver table has a unique constraint preventing duplicate copies:

| Pair | Constraint |
|------|-----------|
| PO / WO | `UNIQUE(tenant_id, purchase_order_id)` on work_orders |
| Invoice / Bill | `UNIQUE(tenant_id, invoice_id)` on bills (effectively enforced by existing idx) |
| RFQ / Job | `UNIQUE(tenant_id, source_rfq_id)` on jobs |
| Estimate / Proposal | `UNIQUE(tenant_id, quote_id)` on proposals (effectively enforced by existing idx) |

---

## Custody Transfer Pattern

When a ghost organisation later subscribes to Claims Manager and is verified, custodial records are transferred to the new issuer tenant. The process is managed by `CustodyTransferService` (doc 40, Phase 6).

The transfer is generalised to support all four document pairs:

```text
BEGIN

1. Find all custodial issuer records WHERE
     issuer_organisation_id = :ghostOrganisationId
     AND ownership_status = 'externally_captured'
     AND entity_type IN ('purchase_order', 'invoice', 'rfq', 'quote')

2. For each record:
   a. Update the issuer record:
      - tenant_id = new issuer tenant
      - custodian_tenant_id = null
      - ownership_status = 'transferred'
   b. Log the transfer in the appropriate custody_transfers table
   c. Update linked receiver records:
      - source_tenant_id = new issuer tenant (now subscribed)

3. Receiver records are otherwise unchanged:
   - tenant_id remains the original receiver
   - source_{entity}_id remains the same (FK still valid)
   - All receiver-private data remains protected

COMMIT
```

### Data protection during transfer

The issuer-side record contains only shared commercial data (amounts, dates, scope, line items). The receiver-side record contains operational and private data (internal notes, margins, costs, resource allocation). After transfer, the issuer gains access to their own commercial record but never sees the receiver's operational data.

---

## DocumentIssuanceService Extension

`DocumentIssuanceService` manages cross-tenant issuance via `RECIPIENT_TYPE_MAP`:

```text
purchase_order → work_order    (implemented — doc 40)
invoice        → bill          (implemented — header only)
quote          → proposal      (implemented — header only)
rfq            → job           (not yet implemented)
```

Each pair's `create*From*` method must perform:

| Step | PO→WO | Invoice→Bill | Quote→Proposal | RFQ→Job |
|------|-------|-------------|----------------|---------|
| Set source FK | `purchase_order_id` | `invoice_id` | `quote_id` | `source_rfq_id` (new) |
| Set `source_tenant_id` | Yes | Needs adding | Needs adding | Needs adding |
| Set `source_organisation_id` | Yes | Needs adding | Needs adding | Needs adding |
| Perspective swap (from/to) | Yes | N/A | Needs adding | Needs adding |
| Copy line items | Yes (full hierarchy) | No (flat payload) | Needs adding | No (scope in payload) |
| Set version fields | Yes | Yes | Yes | Needs adding |
| Resolve receiver status | Yes ('received') | Yes ('received') | Needs adding | Needs adding |

---

## Event Types

Each pair follows a consistent naming convention:

### Issuer-side events

```text
{EntityType}Created
{EntityType}Approved
{EntityType}Issued
{EntityType}Captured
{EntityType}Updated
{EntityType}Cancelled
{EntityType}CustodyTransferred
```

### Receiver-side events

```text
{ReceiverEntityType}Created
{ReceiverEntityType}Received
{ReceiverEntityType}Accepted
{ReceiverEntityType}Declined
{ReceiverEntityType}Started
{ReceiverEntityType}Completed
```

### Per-pair examples

| Pair | Issuer events | Receiver events |
|------|--------------|-----------------|
| PO/WO | PurchaseOrderIssued, PurchaseOrderCaptured | WorkOrderCreated, WorkOrderAccepted |
| Invoice/Bill | InvoiceIssued, InvoiceCaptured | BillCreated, BillApproved, BillPaid |
| RFQ/Job | RfqIssued, RfqCaptured | JobCreated, JobAccepted |
| Estimate/Proposal | EstimateIssued, EstimateCaptured | ProposalCreated, ProposalAccepted |

Events are written through the transactional outbox (future phase — see doc 40 scope exclusions). Until the outbox is implemented, cross-tenant issuance happens synchronously within `DocumentIssuanceService`.

---

## Concurrency and Versioning

When an issuer updates their document after issuance, the receiver must be notified:

1. Issuer updates their record and increments their internal version counter
2. The linked receiver record's `latest_available_version` is incremented
3. `version_acknowledged` is set to `false`
4. The receiver sees a "new version available" indicator in the UI
5. The receiver can acknowledge (pull latest changes) or continue working with their current version

This prevents delayed or out-of-order updates from silently overwriting the receiver's state.

---

## Cross-References

| Document | Scope |
|----------|-------|
| [40_CROSS_TENANT_PO_WO.md](./40_CROSS_TENANT_PO_WO.md) | Reference implementation — PO/WO pair (complete) |
| [42_CROSS_TENANT_INVOICE_BILL.md](./42_CROSS_TENANT_INVOICE_BILL.md) | Invoice/Bill pair |
| [43_CROSS_TENANT_RFQ_JOB.md](./43_CROSS_TENANT_RFQ_JOB.md) | RFQ/Job pair |
| [44_CROSS_TENANT_ESTIMATE_PROPOSAL.md](./44_CROSS_TENANT_ESTIMATE_PROPOSAL.md) | Estimate/Proposal pair |
| [docs/discussion/async comms.md](../discussion/async%20comms.md) | Original design discussion (PO/WO focused) |

---

## Invariants

These invariants apply to all four document pairs:

```text
1. Every issuer-side record has a non-null tenant_id referencing an active tenant.

2. A ghost organisation has subscription_status = 'ghost' and zero users.

3. A custodial record has ownership_status = 'externally_captured' and custodian_tenant_id set.

4. issuer_organisation_id is the commercial issuer; tenant_id is the record owner. These may differ for custodial records.

5. Manual capture creates the issuer and receiver records in a single database transaction.

6. The receiver sees their record immediately after capture (no async dependency).

7. A receiver record's tenant_id never changes during custody transfer — only the issuer record moves.

8. Custody transfer preserves created_by_user_id, created_at, and capture_method.

9. Unique constraints prevent duplicate receiver records per source issuer record per tenant.

10. Email domain alone is not sufficient proof of organisation ownership.

11. Tenant-scoped queries prevent cross-tenant data leakage after transfer.

12. Every custody transfer is logged with full provenance.

13. The recursive supply chain has no depth limit — the same pairs are reused at every level.

14. Line-item lineage is preserved across supply chain levels via source_*_id fields.

15. A "response" to a received document is not a special mechanism — it is a new document pair issued in the reverse direction.
```

---

*Previous: [40 — Cross-Tenant PO/WO](./40_CROSS_TENANT_PO_WO.md)*
