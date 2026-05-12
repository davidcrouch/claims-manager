# 33e — Bills Module (Full Stack)

## Objective

Implement the Bills entity. A Bill is an invoice received from a downstream party. It represents Accounts Payable viewed as a job cost against a Purchase Order.

---

## Prerequisites

- Plan 33a (Sidebar Restructure) complete — `/bills` route exists as stub
- Invoices module implemented (plan 12) — structural pattern reference
- Purchase Orders module implemented (plan 11) — Bills link to POs

---

## Domain Context

A Bill is the **inbound** counterpart to an Invoice:

- **Invoice** = a bill this tenant **sends to** an upstream party — Accounts Receivable
- **Bill** = an invoice this tenant **receives from** a downstream party — Accounts Payable

Bills are tracked as job costs against Purchase Orders. The same financial document is an "invoice" from the sending tenant's perspective and a "bill" from the receiving tenant's perspective.

Key characteristics:
- Links to a PO (the purchase order the bill is against)
- Links to a job and optionally a claim
- Links to a vendor (the downstream party who issued the bill)
- Tracks payment status (for AP workflow)
- Has a due date for payment scheduling

---

## Steps

### 33e.1 Database Schema

**File:** `apps/api/src/database/schema/index.ts`

#### `bills` table

```typescript
export const bills = pgTable(
  'bills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),

    billNumber: text('bill_number'),
    externalReference: text('external_reference'),

    issueDate: timestamp('issue_date', { withTimezone: true }),
    receivedDate: timestamp('received_date', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    paymentDate: timestamp('payment_date', { withTimezone: true }),

    comments: text('comments'),
    declinedReason: text('declined_reason'),

    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    paymentStatusLookupId: uuid('payment_status_lookup_id').references(() => lookupValues.id),

    subTotal: numeric('sub_total', { precision: 14, scale: 2 }),
    totalTax: numeric('total_tax', { precision: 14, scale: 2 }),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),

    isDeleted: boolean('is_deleted').notNull().default(false),
    billPayload: jsonb('bill_payload').notNull().default({}),

    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_bills_po').on(t.tenantId, t.purchaseOrderId),
    index('idx_bills_job').on(t.tenantId, t.jobId),
    index('idx_bills_claim').on(t.tenantId, t.claimId),
    index('idx_bills_vendor').on(t.tenantId, t.vendorId),
    index('idx_bills_number').on(t.tenantId, t.billNumber),
    index('idx_bills_status').on(t.tenantId, t.statusLookupId),
    index('idx_bills_due_date').on(t.tenantId, t.dueDate),
    index('idx_bills_payment_status').on(t.tenantId, t.paymentStatusLookupId),
    unique('UQ_bills_tenant_number').on(t.tenantId, t.purchaseOrderId, t.billNumber),
  ],
);
```

#### New lookup domains

- `bill_status` (e.g. Received, Under Review, Approved, Declined, Paid)
- `payment_status` (e.g. Unpaid, Partially Paid, Paid, Overdue)

---

### 33e.2 Migration

Run `drizzle-kit generate`. The bills table is straightforward — no line item hierarchy (bills reference PO line items for cost allocation).

---

### 33e.3 Repository

**File:** `apps/api/src/database/repositories/bills.repository.ts`

```typescript
@Injectable()
export class BillsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: { tenantId; page?; limit?; search?; sort?; status?; vendorId?; dueBefore? });
  async findOne(params: { tenantId; id });
  async findByJob(params: { tenantId; jobId });
  async findByPurchaseOrder(params: { tenantId; purchaseOrderId });
  async findByVendor(params: { tenantId; vendorId });
  async findOverdue(params: { tenantId }); // due_date < now() AND payment_status != 'Paid'
  async create(params: { tenantId; data });
  async update(params: { tenantId; id; data });

  // Aging query for Finance AP (used by plan 33f)
  async getAgingSummary(params: { tenantId }): Promise<AgingBucket[]>;
}
```

---

### 33e.4 API Module

**Directory:** `apps/api/src/modules/bills/`

#### Controller Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/bills` | List bills (paginated, tenant-scoped) |
| `GET` | `/bills/job/:jobId` | List bills for a job |
| `GET` | `/bills/purchase-order/:poId` | List bills against a PO |
| `GET` | `/bills/vendor/:vendorId` | List bills from a vendor |
| `GET` | `/bills/overdue` | List overdue bills |
| `GET` | `/bills/:id` | Get bill detail |
| `POST` | `/bills` | Record a received bill |
| `POST` | `/bills/:id` | Update bill |
| `POST` | `/bills/:id/approve` | Approve bill for payment |
| `POST` | `/bills/:id/decline` | Decline bill with reason |

---

### 33e.5 Frontend — API Client

Add methods to `apps/frontend/src/lib/api-client.ts`:

```typescript
async getBills(params?: { page?; limit?; search?; sort?; status?; vendorId? });
async getBill(id: string);
async getJobBills(jobId: string);
async getPurchaseOrderBills(poId: string);
async getOverdueBills();
async createBill(data: Record<string, unknown>);
async updateBill(id: string, data: Record<string, unknown>);
async approveBill(id: string);
async declineBill(id: string, data: { reason: string });
```

---

### 33e.6 Frontend — List Page

Replace stub at `apps/frontend/src/app/(app)/bills/page.tsx`.

**List columns:** Bill #, Vendor, Job, PO #, Status, Total, Due Date, Payment Status

**Sort options:** `updated_at`, `created_at`, `bill_number`, `due_date`, `total_amount`

**Status filter:** Include both bill status and payment status filters.

---

### 33e.7 Frontend — Detail Page

**Tabs:**

| Tab | Content |
|---|---|
| Overview | Bill details, vendor, dates (issue, received, due, payment), totals, approve/decline actions |
| Linked PO | Purchase order the bill is against — PO number, line items, how bill total relates to PO total |
| Job Context | Job details, other bills against the same job, cost summary |
| Vendor | Vendor details, billing history from this vendor |
| Audit | Timestamps, status history, approval/decline records |

---

### 33e.8 PO Detail Integration

Add a "Bills" tab or section to the Purchase Order detail page:
- Show bills received against this PO
- Display: bill number, vendor, amount, status, due date
- Summary: total billed vs. PO total

---

### 33e.9 Job Detail Integration

Add a "Bills" tab to Job detail:
- List all bills linked to this job across all POs
- Summary: total billed, total paid, total outstanding

---

## Acceptance Criteria

- [ ] `GET /bills` returns paginated, tenant-scoped bills
- [ ] Bills correctly link to PO, job, vendor
- [ ] Overdue bills query works (`due_date < now()` AND unpaid)
- [ ] Approve/decline status transitions work
- [ ] Bill list page functional with search, sort, status filter
- [ ] Bill detail shows linked PO and job context
- [ ] PO detail page includes bills section
- [ ] Job detail page includes "Bills" tab
- [ ] Aging summary query returns correct buckets for Finance AP (plan 33f)

---

*Next: 33f_FINANCE_AR_AP.md*
