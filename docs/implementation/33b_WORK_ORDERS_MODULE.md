# 33b — Work Orders Module (Full Stack)

## Objective

Implement the Work Orders entity. A Work Order is a purchase order received from an upstream party that defines the scope of work for a job. It mirrors the Purchase Order structure and includes a link back to the upstream party's PO.

---

## Prerequisites

- Plan 33a (Sidebar Restructure) complete — `/work-orders` route exists as stub
- Purchase Orders module implemented (plan 11) — pattern reference
- Schema file (`apps/api/src/database/schema/index.ts`) accessible

---

## Domain Context

A Work Order is the **inbound** counterpart to a Purchase Order:

- **PO** = a purchase order this tenant **sends to** a downstream party
- **Work Order** = a purchase order this tenant **receives from** an upstream party

Work Orders share most structural fields with POs (line item hierarchy, parties, totals) but represent the **scope of work directive** from the upstream party. They may link to a PO in the upstream party's tenant.

---

## Steps

### 33b.1 Database Schema

**File:** `apps/api/src/database/schema/index.ts`

Add four new tables mirroring the PO hierarchy:

#### `work_orders` table

```typescript
export const workOrders = pgTable(
  'work_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),

    // Link to upstream party's PO
    sourcePurchaseOrderId: uuid('source_purchase_order_id'),
    sourceTenantId: uuid('source_tenant_id'),
    sourceExternalReference: text('source_external_reference'),

    externalId: text('external_id'),
    workOrderNumber: text('work_order_number'),
    name: text('name'),

    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    workOrderTypeLookupId: uuid('work_order_type_lookup_id').references(() => lookupValues.id),

    startDate: date('start_date'),
    endDate: date('end_date'),
    startTime: time('start_time'),
    endTime: time('end_time'),

    note: text('note'),
    scopeOfWork: text('scope_of_work'),

    woTo: jsonb('wo_to').notNull().default({}),
    woFor: jsonb('wo_for').notNull().default({}),
    woFrom: jsonb('wo_from').notNull().default({}),
    serviceWindow: jsonb('service_window').notNull().default({}),

    woToEmail: text('wo_to_email'),
    woForName: text('wo_for_name'),

    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),
    adjustedTotal: numeric('adjusted_total', { precision: 14, scale: 2 }),

    workOrderPayload: jsonb('work_order_payload').notNull().default({}),

    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_wo_parent', sql`claim_id IS NOT NULL OR job_id IS NOT NULL`),
    index('idx_wo_job').on(t.tenantId, t.jobId),
    index('idx_wo_claim').on(t.tenantId, t.claimId),
    index('idx_wo_number').on(t.tenantId, t.workOrderNumber),
  ],
);
```

#### `work_order_groups`, `work_order_combos`, `work_order_items` tables

Mirror `purchase_order_groups`, `purchase_order_combos`, `purchase_order_items` with:
- Foreign keys referencing `workOrders` instead of `purchaseOrders`
- Same column set (group label lookup, dimensions, sort index, totals, etc.)
- Same combo/item hierarchy with mutual exclusion check constraint

#### Drizzle relations (optional)

```typescript
export const workOrdersRelations = relations(workOrders, ({ one }) => ({
  claim: one(claims),
  job: one(jobs),
  vendor: one(vendors),
  statusLookup: one(lookupValues, {
    fields: [workOrders.statusLookupId],
    references: [lookupValues.id],
  }),
}));
```

#### New lookup domains

Add to `lookup_values` domain list:
- `work_order_status`
- `work_order_type`

---

### 33b.2 Migration

Run `drizzle-kit generate` to produce the SQL migration file under `apps/api/src/database/migrations-drizzle/`. Review the generated SQL to ensure:
- All FKs point to correct parent tables
- Check constraints are present
- Indexes are created

---

### 33b.3 Repository

**File:** `apps/api/src/database/repositories/work-orders.repository.ts`

```typescript
@Injectable()
export class WorkOrdersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
  }) { /* query work_orders with lookups joined */ }

  async findOne(params: { tenantId: string; id: string }) { /* by id */ }

  async findByJob(params: { tenantId: string; jobId: string }) { /* by job */ }

  async create(params: { tenantId: string; data: NewWorkOrder }) { /* insert */ }

  async update(params: { tenantId: string; id: string; data: Partial<NewWorkOrder> }) { /* update */ }
}
```

Register in `apps/api/src/database/database.module.ts` and export from `apps/api/src/database/repositories/index.ts`.

---

### 33b.4 API Module

**Directory:** `apps/api/src/modules/work-orders/`

```
work-orders/
├── work-orders.module.ts
├── work-orders.controller.ts
└── work-orders.service.ts
```

#### Controller Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/work-orders` | List work orders (paginated, tenant-scoped) |
| `GET` | `/work-orders/job/:jobId` | List work orders for a job |
| `GET` | `/work-orders/:id` | Get work order detail |
| `POST` | `/work-orders` | Create work order |
| `POST` | `/work-orders/:id` | Update work order |

#### Service Layer

```typescript
@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(params: { page?: number; limit?: number; search?: string; sort?: string; status?: string });
  async findOne(params: { id: string });
  async findByJob(params: { jobId: string });
  async create(params: { data: Record<string, unknown> });
  async update(params: { id: string; data: Record<string, unknown> });
}
```

#### Module Registration

Register `WorkOrdersModule` in `apps/api/src/app.module.ts`.

---

### 33b.5 Frontend — API Client

**File:** `apps/frontend/src/lib/api-client.ts`

Add methods:

```typescript
async getWorkOrders(params?: { page?: number; limit?: number; search?: string; sort?: string; status?: string });
async getWorkOrder(id: string);
async getJobWorkOrders(jobId: string);
async createWorkOrder(data: Record<string, unknown>);
async updateWorkOrder(id: string, data: Record<string, unknown>);
```

---

### 33b.6 Frontend — List Page

Replace the stub at `apps/frontend/src/app/(app)/work-orders/page.tsx` with a full server-rendered list page following the Jobs list pattern:

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/work-orders/page.tsx` | Server page — fetch initial data + lookups |
| `app/(app)/work-orders/actions.ts` | Server actions for client-side refetch |
| `components/work-orders/WorkOrdersPageClient.tsx` | Client wrapper — list + form drawer |
| `components/work-orders/WorkOrdersListClient.tsx` | List with toolbar (search, sort, status filter) |

**List columns:** Work Order #, Job, Status, Scope, Total Amount, Start Date, Updated

**Sort options:** `updated_at` (Updated), `created_at` (Created), `work_order_number` (WO #)

---

### 33b.7 Frontend — Detail Page

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/work-orders/[id]/page.tsx` | Server page — fetch work order + parent job/claim |
| `app/(app)/work-orders/[id]/actions.ts` | Server actions for tab data |
| `components/work-orders/WorkOrderDetail.tsx` | Detail layout with URL-synced tabs |
| `components/work-orders/WorkOrderHeader.tsx` | Page header with status badge |
| `components/work-orders/tabs/` | Tab panel components |

**Tabs:**

| Tab | Content |
|---|---|
| Overview | Core fields, parties (To/For/From), dates, scope of work |
| Line Items | Groups → combos → items hierarchy (mirror PO line items display) |
| Linked PO | Source purchase order from upstream party (if linked) |
| Parties | Contacts associated with the work order |
| Audit | Created/updated timestamps, status history |

---

### 33b.8 Job Detail Integration

Add a "Work Orders" tab to the Job detail page (`components/jobs/JobDetail.tsx`):

- Add `work-orders` to `VALID_TABS`
- Create `components/jobs/tabs/JobWorkOrdersTab.tsx`
- Add server action `fetchJobWorkOrdersAction` in `app/(app)/jobs/[id]/actions.ts`
- Tab shows list of work orders linked to the job with click-through to `/work-orders/[id]`

---

## Acceptance Criteria

- [ ] `GET /work-orders` returns paginated, tenant-scoped work orders
- [ ] `GET /work-orders/:id` returns full work order with line item hierarchy
- [ ] `POST /work-orders` creates work order linked to a job/claim
- [ ] Work order list page functional with search, sort, status filter
- [ ] Work order detail page shows all tabs with correct data
- [ ] Job detail page includes "Work Orders" tab
- [ ] `source_purchase_order_id` links to upstream party's PO when available
- [ ] Line items hierarchy (groups/combos/items) renders correctly

---

*Next: 33c_RFQS_MODULE.md*
