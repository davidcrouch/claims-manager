# 42 — Cross-Tenant Invoice / Bill

## Objective

Implement the cross-tenant pattern for the Invoice (issuer) / Bill (receiver) document pair, enabling:

- A vendor to issue an Invoice that creates a Bill in the buyer's tenant
- A buyer to manually capture an external Invoice from a non-subscribed vendor (ghost org)
- Custody transfer when a ghost vendor later subscribes
- Version tracking so the buyer sees when the Invoice has been updated

**Architecture reference:** [41_CROSS_TENANT_SUPPLY_CHAIN_ARCHITECTURE.md](./41_CROSS_TENANT_SUPPLY_CHAIN_ARCHITECTURE.md)

**PO/WO reference implementation:** [40_CROSS_TENANT_PO_WO.md](./40_CROSS_TENANT_PO_WO.md)

---

## Scope & Exclusions

### In scope

- Schema additions to `invoices` (issuer-side org/custody fields)
- Schema additions to `bills` (source tenant/org fields)
- Extend `DocumentIssuanceService.createBillFromInvoice()` with source tracking
- Manual Invoice capture API (`POST /invoices/capture`)
- Custody transfer support for invoices
- Idempotency constraints
- Frontend capture form

### Out of scope (future phases)

- Invoice line-item hierarchy (invoices use flat `invoice_payload` JSONB today)
- Payment processing and remittance advice as a cross-tenant flow
- Credit notes and adjustments
- Pub/Sub event propagation (outbox not yet implemented)

---

## Current State

| Aspect | Status |
|--------|--------|
| `bills.invoice_id` FK | Exists (NOT NULL, cross-tenant capable) |
| `DocumentIssuanceService` mapping | `invoice → bill` in `RECIPIENT_TYPE_MAP` |
| `createBillFromInvoice()` | Implemented — copies header fields, sets version fields |
| Cross-tenant org fields on `invoices` | Missing |
| Cross-tenant source fields on `bills` | Missing (`source_tenant_id`, `source_organisation_id`) |
| Version fields on `bills` | Exist (`source_version_number`, `latest_available_version`, `version_acknowledged`) |
| Manual capture endpoint | Not implemented |

---

## Phase 1 — Schema Changes

### 1.1 `invoices` table — issuer-side fields

```sql
ALTER TABLE invoices ADD COLUMN issuer_organisation_id UUID
    REFERENCES organizations(id);

ALTER TABLE invoices ADD COLUMN recipient_organisation_id UUID
    REFERENCES organizations(id);

ALTER TABLE invoices ADD COLUMN custodian_tenant_id UUID
    REFERENCES organizations(id);

ALTER TABLE invoices ADD COLUMN capture_method TEXT;

ALTER TABLE invoices ADD COLUMN ownership_status TEXT NOT NULL DEFAULT 'owned';

CREATE INDEX idx_invoices_issuer_org ON invoices(issuer_organisation_id);
CREATE INDEX idx_invoices_ownership ON invoices(ownership_status);
```

### 1.2 `bills` table — source tracking fields

```sql
ALTER TABLE bills ADD COLUMN source_tenant_id UUID;

ALTER TABLE bills ADD COLUMN source_organisation_id UUID
    REFERENCES organizations(id);
```

### 1.3 Idempotency constraints

```sql
-- Prevent duplicate invoices from the same issuer
CREATE UNIQUE INDEX UQ_invoices_issuer_org_number
    ON invoices(issuer_organisation_id, invoice_number)
    WHERE issuer_organisation_id IS NOT NULL
      AND invoice_number IS NOT NULL
      AND is_deleted = false;
```

The existing `idx_bills_invoice` index on `(tenant_id, invoice_id)` already effectively prevents duplicate bills per source invoice per tenant.

### 1.4 Migration

Generate a Drizzle migration. The migration must:

- Add all new columns as nullable or with safe defaults
- Backfill existing invoices: set `ownership_status = 'owned'` and `issuer_organisation_id = tenant_id` for all current rows
- Backfill existing bills with `source_tenant_id` and `source_organisation_id` from the linked invoice where possible

---

## Phase 2 — Service Changes

### 2.1 Extend `DocumentIssuanceService.createBillFromInvoice()`

Add source tracking fields to the bill creation:

```typescript
const billData: Partial<BillInsert> = {
  // ... existing fields ...
  sourceTenantId: params.sourceTenantId,
  sourceOrganisationId: params.sourceTenantId, // issuer's org
};
```

### 2.2 Extend `InvoicesService` for org field population

When a subscribed vendor creates an invoice through the standard flow, auto-populate:

```typescript
issuer_organisation_id = tenant org (the vendor creating it)
recipient_organisation_id = recipient org (resolved from PO or explicit)
ownership_status = 'owned'
```

---

## Phase 3 — Manual Invoice Capture

### 3.1 Endpoint

```text
POST /invoices/capture
```

### 3.2 Request Shape

```typescript
interface CaptureInvoiceDto {
  // Issuer identification (at least one required)
  issuer: {
    abn?: string;
    legalName?: string;
    tradingName?: string;
    email?: string;
    phone?: string;
    organisationId?: string;  // pre-selected ghost org
  };

  // Invoice header
  invoiceNumber: string;
  issueDate?: string;
  comments?: string;
  subTotal?: number;
  totalTax?: number;
  totalAmount?: number;

  // Associations
  purchaseOrderId: string;  // required — invoices always reference a PO
  jobId?: string;
  claimId?: string;

  // Source document
  sourceDocumentId?: string;
}
```

### 3.3 Response Shape

```typescript
interface CaptureInvoiceResponse {
  invoiceId: string;
  billId: string;
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
3. Create the custodial Invoice:
   - tenant_id = receiving tenant (custodian)
   - issuer_organisation_id = ghost org
   - recipient_organisation_id = receiving tenant org
   - custodian_tenant_id = receiving tenant
   - capture_method = 'manual'
   - ownership_status = 'externally_captured'
   - purchase_order_id, invoice_number, financials from dto
4. Create the Bill:
   - tenant_id = receiving tenant
   - invoice_id = invoice from step 3
   - source_tenant_id = null (ghost)
   - source_organisation_id = ghost org
   - purchase_order_id = same as invoice (receiver's PO/WO context)
   - status = 'Received' (lookup resolution)
   - version_acknowledged = true (no version gap on manual capture)
5. Return both IDs.

COMMIT
```

### 3.5 Idempotency

Check the unique constraint before inserting. If an Invoice already exists for the same issuer org + invoice number, return the existing Invoice and its linked Bill.

---

## Phase 4 — Custody Transfer

Extend `CustodyTransferService` to include invoices in the transfer query:

```text
Find all invoices WHERE
  issuer_organisation_id = :ghostOrganisationId
  AND ownership_status = 'externally_captured'
```

For each invoice:
1. Update `tenant_id` = new issuer tenant
2. Update `custodian_tenant_id` = null
3. Update `ownership_status` = 'transferred'
4. Log transfer in `po_custody_transfers` (rename to generic `custody_transfers` or add `entity_type` column)
5. Update linked bills: `source_tenant_id` = new issuer tenant

The bill's `tenant_id` remains unchanged — it still belongs to the buyer.

---

## Phase 5 — Frontend

### 5.1 Manual Invoice Capture Form

Add a "Capture External Invoice" action accessible from:
- The Bills list page toolbar
- The PO detail page (Invoices tab)

The form collects:
- Issuer identity fields (business name, ABN, email, phone)
- Invoice number (required)
- Financial fields (amounts, dates)
- PO association (required)

On submit, calls `POST /invoices/capture`. On success, navigates to the newly created Bill detail page.

### 5.2 Ghost Issuer Display

When viewing a custodial Invoice or a Bill sourced from a ghost org:
- Badge indicating the issuer is an external (non-subscribed) organisation
- Issuer's known identity fields
- Capture method and date

---

## Lifecycle States

### Invoice (issuer-side)

| Status | Meaning |
|--------|---------|
| Draft | Invoice created, not yet submitted |
| Submitted | Invoice submitted to buyer |
| Approved | Buyer approved the invoice |
| Declined | Buyer declined the invoice |

### Bill (receiver-side)

| Status | Meaning |
|--------|---------|
| Received | Bill received from vendor |
| Under Review | Bill is being reviewed |
| Approved | Bill approved for payment |
| Declined | Bill rejected (with reason) |
| Paid | Bill has been paid |
| Disputed | Bill is under dispute |

| Payment Status | Meaning |
|---------------|---------|
| Unpaid | No payment made |
| Partial | Partial payment received |
| Paid | Full payment received |
| Overdue | Past due date, unpaid |

---

## Sequence Diagrams

### Scenario 1: Subscribed Vendor Issues Invoice

```text
Vendor Tenant              Claims Manager               Buyer Tenant
     │                         │                              │
     │  Create Invoice         │                              │
     │────────────────────────>│                              │
     │                         │ Save Invoice                 │
     │                         │ (tenant_id = vendor)         │
     │                         │ (issuer_org = vendor org)    │
     │                         │ (recipient_org = buyer org)  │
     │                         │                              │
     │  Issue Invoice          │                              │
     │────────────────────────>│                              │
     │                         │ DocumentIssuanceService:     │
     │                         │   1. Create Bill in buyer    │
     │                         │      (invoice_id = source)   │
     │                         │      (source_tenant = vendor)│
     │                         │      (source_org = vendor)   │
     │                         │   2. Set version fields      │
     │                         │──────────────────────────────>│
     │                         │                    Bill visible│
```

### Scenario 2: Buyer Captures External Invoice

```text
External Vendor            Buyer Tenant                Claims Manager
     │                         │                              │
     │  Sends invoice (email)  │                              │
     │────────────────────────>│                              │
     │                         │ POST /invoices/capture       │
     │                         │─────────────────────────────>│
     │                         │              BEGIN TRANSACTION│
     │                         │              1. Resolve ghost │
     │                         │              2. Create Invoice│
     │                         │                 custody=buyer │
     │                         │              3. Create Bill   │
     │                         │                 tenant=buyer  │
     │                         │              COMMIT           │
     │                         │<─────────────────────────────│
     │                         │ Bill visible immediately     │
```

---

## Implementation Order

| Step | Description | Depends On |
|------|-------------|-----------|
| 1 | Drizzle schema changes (`invoices` + `bills` columns) | — |
| 2 | Generate and review migration | Step 1 |
| 3 | Extend `createBillFromInvoice()` with source fields | Step 2 |
| 4 | Auto-populate org fields on standard invoice create | Step 2 |
| 5 | Manual capture service and endpoint | Step 2 |
| 6 | Frontend: capture form | Step 5 |
| 7 | Extend custody transfer to include invoices | Step 2 |
| 8 | Backfill migration for existing data | Step 2 |

---

*Previous: [41 — Supply Chain Architecture](./41_CROSS_TENANT_SUPPLY_CHAIN_ARCHITECTURE.md)*
