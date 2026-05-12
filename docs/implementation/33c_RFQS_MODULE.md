# 33c — RFQs Module (Full Stack)

## Objective

Implement the Request for Quotation (RFQ) entity. An RFQ is generated from a subset of line items in an Estimate/Quote and sent to a downstream party to request a proposal for a scope of work.

---

## Prerequisites

- Plan 33a (Sidebar Restructure) complete — `/rfqs` route exists as stub
- Quotes module implemented (plan 10) — pattern reference and source entity
- Schema file accessible

---

## Domain Context

An RFQ sits in the **vendor-facing** (downstream) workflow:

1. Contractor creates an **Estimate/Quote** for a job (customer-facing, with full pricing)
2. Contractor generates an **RFQ** from selected quote line items, optionally **excluding unit pricing and/or quantities**
3. RFQ is sent to one or more downstream parties requesting their **Proposal** (response)
4. Downstream party responds with a **Proposal** (plan 33d)

Key characteristics:
- Line items are a **subset** of the source quote's line items
- Unit pricing and quantities can be **optionally hidden** from the downstream party
- Each RFQ targets a specific vendor (downstream party)
- Multiple RFQs can be generated from the same quote (for different vendors or scopes)

---

## Steps

### 33c.1 Database Schema

**File:** `apps/api/src/database/schema/index.ts`

#### `rfqs` table

```typescript
export const rfqs = pgTable(
  'rfqs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),

    rfqNumber: text('rfq_number'),
    name: text('name'),
    note: text('note'),

    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),

    sentDate: timestamp('sent_date', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    receivedDate: timestamp('received_date', { withTimezone: true }),

    includePricing: boolean('include_pricing').notNull().default(false),
    includeQuantities: boolean('include_quantities').notNull().default(true),

    rfqTo: jsonb('rfq_to').notNull().default({}),
    rfqFrom: jsonb('rfq_from').notNull().default({}),

    rfqToEmail: text('rfq_to_email'),
    rfqToName: text('rfq_to_name'),

    rfqPayload: jsonb('rfq_payload').notNull().default({}),

    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_rfq_parent', sql`claim_id IS NOT NULL OR job_id IS NOT NULL`),
    index('idx_rfq_job').on(t.tenantId, t.jobId),
    index('idx_rfq_claim').on(t.tenantId, t.claimId),
    index('idx_rfq_quote').on(t.tenantId, t.quoteId),
    index('idx_rfq_vendor').on(t.tenantId, t.vendorId),
    index('idx_rfq_number').on(t.tenantId, t.rfqNumber),
  ],
);
```

#### `rfq_groups`, `rfq_combos`, `rfq_items` tables

Mirror the quote line item hierarchy with these additions:
- `source_quote_group_id`, `source_quote_combo_id`, `source_quote_item_id` — track which quote line each RFQ line was generated from
- Items **may omit** `unit_cost`, `buy_cost`, `quantity` fields depending on `include_pricing`/`include_quantities` settings on the parent RFQ

```typescript
export const rfqGroups = pgTable('rfq_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  sourceQuoteGroupId: uuid('source_quote_group_id').references(() => quoteGroups.id),
  groupLabelLookupId: uuid('group_label_lookup_id').references(() => lookupValues.id),
  description: text('description'),
  dimensions: jsonb('dimensions').notNull().default({}),
  sortIndex: integer('sort_index').notNull().default(0),
  totals: jsonb('totals').notNull().default({}),
  groupPayload: jsonb('group_payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// rfq_combos and rfq_items follow same pattern with source references
```

#### New lookup domains

- `rfq_status` (e.g. Draft, Sent, Responded, Expired, Cancelled)

---

### 33c.2 Migration

Run `drizzle-kit generate` for the new tables. Verify FK references and check constraints.

---

### 33c.3 Repository

**File:** `apps/api/src/database/repositories/rfqs.repository.ts`

Standard CRUD repository following the established pattern. Include methods:

```typescript
async findAll(params: { tenantId; page?; limit?; search?; sort?; status? });
async findOne(params: { tenantId; id });
async findByJob(params: { tenantId; jobId });
async findByQuote(params: { tenantId; quoteId });
async create(params: { tenantId; data });
async update(params: { tenantId; id; data });
```

Register in `database.module.ts` and `repositories/index.ts`.

---

### 33c.4 API Module

**Directory:** `apps/api/src/modules/rfqs/`

```
rfqs/
├── rfqs.module.ts
├── rfqs.controller.ts
└── rfqs.service.ts
```

#### Controller Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/rfqs` | List RFQs (paginated, tenant-scoped) |
| `GET` | `/rfqs/job/:jobId` | List RFQs for a job |
| `GET` | `/rfqs/quote/:quoteId` | List RFQs generated from a quote |
| `GET` | `/rfqs/:id` | Get RFQ detail with line items |
| `POST` | `/rfqs` | Create RFQ manually |
| `POST` | `/rfqs/from-quote/:quoteId` | Generate RFQ from selected quote line items |
| `POST` | `/rfqs/:id` | Update RFQ |

#### RFQ Generation from Quote

The `POST /rfqs/from-quote/:quoteId` endpoint accepts:

```typescript
{
  vendorId: string;                    // target downstream party
  name?: string;
  note?: string;
  dueDate?: string;
  includePricing: boolean;             // show unit costs to sub?
  includeQuantities: boolean;          // show quantities to sub?
  selectedGroupIds?: string[];         // which quote groups to include (all if omitted)
  selectedComboIds?: string[];         // which combos (all within selected groups if omitted)
  selectedItemIds?: string[];          // which items (all within selected combos/groups if omitted)
}
```

The service:
1. Fetches the source quote with full line item hierarchy
2. Filters to selected groups/combos/items
3. Creates the RFQ record linked to the quote
4. Copies filtered line items into `rfq_groups`/`rfq_combos`/`rfq_items`
5. If `includePricing: false`, nullifies cost fields on copied items
6. If `includeQuantities: false`, nullifies quantity fields

---

### 33c.5 Frontend — API Client

**File:** `apps/frontend/src/lib/api-client.ts`

Add methods:

```typescript
async getRfqs(params?: { page?; limit?; search?; sort?; status? });
async getRfq(id: string);
async getJobRfqs(jobId: string);
async getQuoteRfqs(quoteId: string);
async createRfq(data: Record<string, unknown>);
async generateRfqFromQuote(quoteId: string, data: Record<string, unknown>);
async updateRfq(id: string, data: Record<string, unknown>);
```

---

### 33c.6 Frontend — List Page

Replace stub at `apps/frontend/src/app/(app)/rfqs/page.tsx`.

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/rfqs/page.tsx` | Server page |
| `app/(app)/rfqs/actions.ts` | Server actions |
| `components/rfqs/RfqsPageClient.tsx` | Client wrapper |
| `components/rfqs/RfqsListClient.tsx` | List with toolbar |

**List columns:** RFQ #, Vendor, Job, Status, Due Date, Include Pricing?, Updated

**Sort options:** `updated_at`, `created_at`, `rfq_number`, `due_date`

---

### 33c.7 Frontend — Detail Page

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/rfqs/[id]/page.tsx` | Server page |
| `app/(app)/rfqs/[id]/actions.ts` | Server actions |
| `components/rfqs/RfqDetail.tsx` | Detail with tabs |
| `components/rfqs/RfqHeader.tsx` | Header |
| `components/rfqs/tabs/` | Tab panels |

**Tabs:**

| Tab | Content |
|---|---|
| Overview | Core fields, vendor, dates, pricing/quantity visibility flags |
| Scope Items | Line item hierarchy (groups/combos/items) — respects include_pricing/include_quantities display |
| Source Quote | Link to source quote with comparison view |
| Proposals | List of proposals received in response to this RFQ (populated after plan 33d) |
| Audit | Timestamps, status history |

---

### 33c.8 Quote Detail Integration

Add "Generate RFQ" action to the Quote detail page:

- Add a button/action in the Quote detail header or as a toolbar action
- Opens a drawer/modal with: vendor selector, line item picker (checkboxes on groups/combos/items), pricing/quantity visibility toggles, due date, notes
- Calls `generateRfqFromQuote` API on submit
- Add "RFQs" tab to Quote detail showing RFQs generated from this quote

---

## Acceptance Criteria

- [ ] `GET /rfqs` returns paginated, tenant-scoped RFQs
- [ ] `POST /rfqs/from-quote/:quoteId` generates RFQ from selected quote line items
- [ ] `includePricing: false` correctly nullifies cost fields on copied items
- [ ] `includeQuantities: false` correctly nullifies quantity fields
- [ ] RFQ list page functional with search, sort, status filter
- [ ] RFQ detail page shows scope items respecting visibility flags
- [ ] Source quote is linked and viewable from RFQ detail
- [ ] Quote detail page has "Generate RFQ" action and "RFQs" tab

---

*Next: 33d_PROPOSALS_MODULE.md*
