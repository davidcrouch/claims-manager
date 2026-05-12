# 33d — Proposals Module (Full Stack)

## Objective

Implement the Proposals entity. A Proposal is an estimate/quote received from a downstream party for a scope of work, optionally in response to an RFQ.

---

## Prerequisites

- Plan 33a (Sidebar Restructure) complete — `/proposals` route exists as stub
- Quotes module implemented (plan 10) — structural pattern reference
- RFQs module planned (plan 33c) — Proposals may link to an RFQ

---

## Domain Context

A Proposal is the **inbound** counterpart to an Estimate/Quote:

- **Estimate/Quote** = pricing this tenant **sends to** an upstream party
- **Proposal** = pricing a downstream party **sends to** this tenant

A Proposal may be:
- **Solicited**: in response to a specific RFQ (linked via `rfq_id`)
- **Unsolicited**: a vendor submits a proposal without a prior RFQ

Proposals mirror the Quote structure (groups/combos/items hierarchy with pricing) but represent third-party pricing rather than the contractor's own estimate.

---

## Steps

### 33d.1 Database Schema

**File:** `apps/api/src/database/schema/index.ts`

#### `proposals` table

```typescript
export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    rfqId: uuid('rfq_id').references(() => rfqs.id, { onDelete: 'set null' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),

    proposalNumber: text('proposal_number'),
    name: text('name'),
    reference: text('reference'),
    note: text('note'),

    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    proposalTypeLookupId: uuid('proposal_type_lookup_id').references(() => lookupValues.id),

    receivedDate: timestamp('received_date', { withTimezone: true }),
    proposalDate: timestamp('proposal_date', { withTimezone: true }),
    expiresInDays: integer('expires_in_days'),

    subTotal: numeric('sub_total', { precision: 14, scale: 2 }),
    totalTax: numeric('total_tax', { precision: 14, scale: 2 }),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),

    proposalTo: jsonb('proposal_to').notNull().default({}),
    proposalFor: jsonb('proposal_for').notNull().default({}),
    proposalFrom: jsonb('proposal_from').notNull().default({}),

    proposalToEmail: text('proposal_to_email'),
    proposalToName: text('proposal_to_name'),
    proposalFromName: text('proposal_from_name'),

    customData: jsonb('custom_data').notNull().default({}),
    proposalPayload: jsonb('proposal_payload').notNull().default({}),

    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_proposal_parent', sql`claim_id IS NOT NULL OR job_id IS NOT NULL`),
    index('idx_proposal_job').on(t.tenantId, t.jobId),
    index('idx_proposal_claim').on(t.tenantId, t.claimId),
    index('idx_proposal_rfq').on(t.tenantId, t.rfqId),
    index('idx_proposal_vendor').on(t.tenantId, t.vendorId),
    index('idx_proposal_number').on(t.tenantId, t.proposalNumber),
  ],
);
```

#### `proposal_groups`, `proposal_combos`, `proposal_items` tables

Mirror quote line item hierarchy:
- `proposal_groups` → `proposals` (cascade)
- `proposal_combos` → `proposal_groups` (cascade)
- `proposal_items` → either `proposal_groups` or `proposal_combos` (check constraint)
- Include `source_rfq_group_id`, `source_rfq_item_id` for traceability when linked to an RFQ

#### New lookup domains

- `proposal_status` (e.g. Received, Under Review, Accepted, Rejected, Expired)
- `proposal_type`

---

### 33d.2 Migration

Run `drizzle-kit generate`. Verify generated SQL.

---

### 33d.3 Repository

**File:** `apps/api/src/database/repositories/proposals.repository.ts`

Standard CRUD repository:

```typescript
async findAll(params: { tenantId; page?; limit?; search?; sort?; status? });
async findOne(params: { tenantId; id });
async findByJob(params: { tenantId; jobId });
async findByRfq(params: { tenantId; rfqId });
async findByVendor(params: { tenantId; vendorId });
async create(params: { tenantId; data });
async update(params: { tenantId; id; data });
```

---

### 33d.4 API Module

**Directory:** `apps/api/src/modules/proposals/`

#### Controller Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/proposals` | List proposals (paginated, tenant-scoped) |
| `GET` | `/proposals/job/:jobId` | List proposals for a job |
| `GET` | `/proposals/rfq/:rfqId` | List proposals responding to an RFQ |
| `GET` | `/proposals/vendor/:vendorId` | List proposals from a vendor |
| `GET` | `/proposals/:id` | Get proposal detail with line items |
| `POST` | `/proposals` | Create/record a proposal |
| `POST` | `/proposals/:id` | Update proposal |
| `POST` | `/proposals/:id/accept` | Accept proposal (status transition) |
| `POST` | `/proposals/:id/reject` | Reject proposal (status transition) |

#### Accept/Reject Flow

`POST /proposals/:id/accept` transitions status and optionally triggers downstream actions:
- Marks proposal as accepted
- Future: can auto-generate a PO from the accepted proposal's line items

`POST /proposals/:id/reject` transitions status with optional `reason` in body.

---

### 33d.5 Frontend — API Client

Add methods to `apps/frontend/src/lib/api-client.ts`:

```typescript
async getProposals(params?: { page?; limit?; search?; sort?; status? });
async getProposal(id: string);
async getJobProposals(jobId: string);
async getRfqProposals(rfqId: string);
async createProposal(data: Record<string, unknown>);
async updateProposal(id: string, data: Record<string, unknown>);
async acceptProposal(id: string);
async rejectProposal(id: string, data?: { reason?: string });
```

---

### 33d.6 Frontend — List Page

Replace stub at `apps/frontend/src/app/(app)/proposals/page.tsx`.

**List columns:** Proposal #, Vendor, Job, RFQ #, Status, Total, Received Date, Updated

**Sort options:** `updated_at`, `created_at`, `proposal_number`, `received_date`, `total_amount`

---

### 33d.7 Frontend — Detail Page

**Tabs:**

| Tab | Content |
|---|---|
| Overview | Core fields, vendor info, dates, totals, accept/reject actions |
| Line Items | Groups/combos/items hierarchy with full pricing |
| Linked RFQ | Source RFQ details (if solicited); side-by-side scope comparison |
| Vendor | Vendor details, other proposals from this vendor |
| Audit | Timestamps, status history |

---

### 33d.8 RFQ Detail Integration

In the RFQ detail page (plan 33c), populate the **Proposals** tab:
- List proposals that reference `rfq_id = this RFQ`
- Show status, vendor, total for each
- Click-through to proposal detail

---

### 33d.9 Job Detail Integration

Add a "Proposals" tab to Job detail or include proposals in the existing structure:
- Option A: Separate "Proposals" tab in `VALID_TABS`
- Option B: Show proposals under the "Quotes" tab with a sub-section for received proposals
- **Recommended: Option A** for clarity — add `proposals` to `VALID_TABS`

---

## Acceptance Criteria

- [ ] `GET /proposals` returns paginated, tenant-scoped proposals
- [ ] Proposals correctly link to source RFQ when solicited
- [ ] Accept/reject status transitions work
- [ ] Proposal list page functional with search, sort, status filter
- [ ] Proposal detail shows line item hierarchy
- [ ] RFQ detail "Proposals" tab shows linked proposals
- [ ] Vendor detail shows proposals from that vendor

---

*Next: 33e_BILLS_MODULE.md*
