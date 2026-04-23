# 11 — Purchase Orders Module

## Objective

Implement the Purchase Orders module that proxies write operations to the
Crunchwork (CW) API and serves read operations from the local hybrid
relational+JSONB schema. POs mirror the quotes hierarchy
(`groups → combos → items`), link to vendors / quotes / jobs / claims, and may
carry inline invoices.

Ingress (CW → local DB) is handled separately by the entity-mapper pipeline
(see [`27d_ENTITY_MAPPER_SERVICE.md`](./27d_ENTITY_MAPPER_SERVICE.md) and
[`29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md`](./29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md)).
The field-by-field CW ↔ internal mapping for Purchase Orders is the single
source of truth in [`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md);
this module consumes the tables it populates.

**CW contract reference:** `docs/Insurance REST API-v17-20260304_100318.pdf`
§3.3.8 (Purchase Orders).

---

## Current State (partial)

As of this writing the module is a **thin shim** and the mapper covers only a
subset of the spec:

| Area | Today | Target (below) |
|---|---|---|
| Controller (`purchase-orders.controller.ts`) | `GET /purchase-orders`, `GET /purchase-orders/:id`, `GET /purchase-orders/job/:jobId`, `POST /purchase-orders/:id` | Same surface (already matches target) |
| Service (`purchase-orders.service.ts`) | `findAll` / `findOne` / `findByJob` against local repo; `update` proxies to `CrunchworkService.updatePurchaseOrder` and refreshes `purchase_order_payload` | Adds `findByVendor`, `findByQuote`, and richer response shape |
| Sync / mapping | `CrunchworkPurchaseOrderMapper` in `apps/api/src/modules/external/mappers/crunchwork-purchase-order.mapper.ts` populates `status_lookup_id`, `purchase_order_type_lookup_id`, `claim_id`, `job_id`, `name`, `purchase_order_number`, `start_date`, `end_date`, `note`, `total_amount`, `adjusted_total`, `purchase_order_payload`; syncs `groups → combos → items` with the subset of fields listed in [`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md) §11 | Full mapper coverage per [`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md) §§2–10 (parent resolution, vendor / quote FK, flat `to*`/`for*`/`from*` → `po_to`/`po_for`/`po_from`, `service_window`, `allocation_context`, full group / combo / item field set, inline invoice delegation) |

Every field the current mapper does not yet normalise still survives losslessly
in `purchase_orders.purchase_order_payload` (and the `*_payload` JSONB on each
child row), so this plan describes forward work rather than backfill. Known
gaps are catalogued in [`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md) §11.

---

## Phase Dependencies

| Feature | Crunchwork Phase | Notes |
|---------|------------------|-------|
| `GET /purchase-orders/{id}` (read by ID) | **1** | Primary ingest path for POs |
| `POST /purchase-orders/{id}` (update) | **1** | Insurance / Claims Manager |
| `GET /purchase-orders` (list) | — | **No CW list endpoint.** Served locally; populated by the webhook pipeline + the job-level sub-resource list. |
| `GET /jobs/{id}/purchase-orders` (sub-resource list) | **2** | Used to seed the local PO list from a job |
| `POST /purchase-orders` (create) | — | **Not in CW contract for ingress here.** POs are created in CW through the quote-approval flow; they arrive inbound via the `NEW_PURCHASE_ORDER` webhook and then via `GET /purchase-orders/{id}`. |

**Purchase Orders list source:** The local DB serves the list. It is populated by:

- POs projected by the webhook pipeline — each `NEW_PURCHASE_ORDER` /
  `UPDATE_PURCHASE_ORDER` event is fetched via `GET /purchase-orders/{id}` and
  mapped by `CrunchworkPurchaseOrderMapper` into `purchase_orders` + children.
- POs updated via `POST /purchase-orders/:id` (the response is persisted
  synchronously).
- Phase 2+: seeding from `GET /jobs/{id}/purchase-orders` when a job is
  opened in the UI.

---

## Steps

### 11.1 Module Structure

The module intentionally stays thin — it is a REST façade over the shared
purchase-orders repository plus the CW HTTP client. Sync/ingress logic lives
in the external entity-mapper pipeline and must not be duplicated here.

```
apps/api/src/modules/purchase-orders/
├── purchase-orders.module.ts
├── purchase-orders.controller.ts
└── purchase-orders.service.ts
```

Related code that lives outside this folder:

| Concern | Location |
|---------|----------|
| DB schema (`purchase_orders`, `purchase_order_groups`, `purchase_order_combos`, `purchase_order_items`) | `apps/api/src/database/schema/index.ts` |
| Data access | `apps/api/src/database/repositories/purchase-orders.repository.ts` |
| CW ↔ internal mapping (spec) | [`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md) |
| CW ↔ internal mapping (impl) | `apps/api/src/modules/external/mappers/crunchwork-purchase-order.mapper.ts` |
| Lookup resolution | `apps/api/src/modules/external/lookup-resolver.service.ts` |
| External-link / parent resolution | `apps/api/src/modules/external/external-object.service.ts` |
| CW HTTP client (`getPurchaseOrder`, `updatePurchaseOrder`, `getJobPurchaseOrders`) | `apps/api/src/crunchwork/crunchwork.service.ts` |
| CW connection selection | `apps/api/src/modules/external/connection-resolver.service.ts` |
| Inline invoice delegation | `apps/api/src/modules/external/mappers/crunchwork-invoice.mapper.ts` |

### 11.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/purchase-orders` | List POs from local DB with query-string filter / pagination | All authenticated |
| `GET` | `/purchase-orders/:id` | Get PO detail from local DB (with line-item hierarchy) | Insurance, Claims Manager, Vendor |
| `GET` | `/purchase-orders/job/:jobId` | List POs for a job (served locally) | All authenticated |
| `POST` | `/purchase-orders/:id` | Update PO via Crunchwork, refresh local row from response | Admin, Claims Manager, Insurance |

Query parameters on `GET /purchase-orders`:

| Param | Meaning | Notes |
|-------|---------|-------|
| `page` | 1-based page number | Default `1` |
| `limit` | Page size | Default `20`, capped at `100` |
| `jobId` | Restrict to a single job | Matches `purchase_orders.job_id` |
| `vendorId` | Restrict to a single vendor | Matches `purchase_orders.vendor_id` |
| `claimId` | Restrict to a single claim (Phase 2+) | Matches `purchase_orders.claim_id` |
| `status` | Comma-separated `status_lookup_id` values (Phase 2+) | |
| `search` | Substring match against `purchase_order_number`, `name`, `external_id` (Phase 2+) | Case-insensitive |

### 11.3 Service Layer

```typescript
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    vendorId?: string;
    claimId?: string;
  }): Promise<{ data: PurchaseOrderRow[]; total: number }>;

  async findOne(params: { id: string }): Promise<PurchaseOrderRow | null>;

  async findByJob(params: { jobId: string }): Promise<PurchaseOrderRow[]>;

  async update(params: {
    id: string;
    body: Record<string, unknown>;
  }): Promise<PurchaseOrderRow | null>;
}
```

Behaviour:

- `findAll` / `findOne` / `findByJob` are **read-only** against the local
  `purchase_orders` table, scoped by `TenantContext`. They do not hit CW.
- `update` resolves the active CW connection via `ConnectionResolverService`,
  calls `crunchworkService.updatePurchaseOrder`, then persists the response's
  `purchase_order_payload` so the caller immediately sees the new row. The
  richer projection (lookups, child tables, JSONB buckets) arrives shortly
  after via the webhook pipeline invoking `CrunchworkPurchaseOrderMapper` —
  which upserts against the same row keyed on the `external_links` row for
  the PO's `external_object`.
- `update` does **not** perform lookup resolution inline; that is the
  mapper's job on the back-projection. This keeps the synchronous CW
  round-trip fast and avoids duplicating mapping logic in two places.
- There is no `create` on this module — POs are created in CW through the
  quote-approval flow and arrive inbound via the webhook pipeline.

### 11.4 Sync / Projection

There is no `PurchaseOrdersSyncService` inside this module. CW → local sync is
performed by `CrunchworkPurchaseOrderMapper`
(`apps/api/src/modules/external/mappers/crunchwork-purchase-order.mapper.ts`),
registered with the entity-mapper registry
(`apps/api/src/modules/external/entity-mapper.registry.ts`) and invoked by
`InProcessProjectionService` whenever a `purchase_order.*` external object
changes.

The mapper:

1. Resolves the existing PO row (external link → future fallbacks on
   `(tenant_id, external_id)` and `(tenant_id, purchase_order_number)`; see
   mapping doc §13).
2. Resolves `job_id`, `claim_id`, `vendor_id`, `quote_id` via
   `ExternalObjectService.resolveInternalEntityId`. Returns
   `{ skipped: 'skipped_no_parent' }` if neither `job_id` nor `claim_id`
   resolves (the `chk_po_parent` CHECK constraint requires at least one).
3. Builds the `purchase_orders` row — scalars, service window,
   `po_to` / `po_for` / `po_from` JSONB (from flat `to*`/`for*`/`from*` keys
   per mapping doc §6), `adjustment_info`, `allocation_context`, and the
   promoted totals.
4. Resolves every lookup FK (`purchase_order_status`, `purchase_order_type`)
   through `LookupResolver` with auto-create.
5. Stores the verbatim CW response in `purchase_order_payload`.
6. Rebuilds the line-item tree in `purchase_order_groups →
   purchase_order_combos → purchase_order_items` using a
   destroy-and-rebuild strategy (mapping doc §9), resolving
   `group_label_lookup_id` and `unit_type_lookup_id` per row.
7. Delegates each element of `payload.invoices[]` to
   `CrunchworkInvoiceMapper` so inline invoices land in `invoices` with
   `purchase_order_id` set to this PO.

All behaviour above is specified field-by-field in
[`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md). If this
module changes in a way that affects ingress — e.g. a new CW field — the
mapping doc must be updated first, then the mapper, then the schema.

### 11.5 PO Line Item Hierarchy

Mirrors quotes but with PO-specific fields (`reconciliation`,
`manualAllocation`, `quoteLineItemId`, `quoteComboId`). See
[`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md) §9 for the
full field-by-field mapping. The tree shape:

```
PurchaseOrder
├── groups[]                 (purchase_order_groups)
│   ├── groupLabel (lookup → group_label_lookup_id)
│   ├── dimensions (JSONB: length / width / height)
│   ├── totals (JSONB: subTotal / totalTax / total)
│   ├── items[]              (purchase_order_items, with purchase_order_group_id)
│   └── combos[]             (purchase_order_combos)
│       ├── name / category / subCategory / quantity
│       ├── catalogComboId → catalog_combo_id
│       ├── quoteComboId   → quote_combo_id
│       └── items[]         (purchase_order_items, with purchase_order_combo_id)
│           ├── name / description / category / type / index
│           ├── unitType.externalReference → unit_type_lookup_id
│           ├── quantity / tax / buyCost / unitCost / markupType / markupValue
│           ├── pcps (PC / PS)
│           ├── reconciliation / manualAllocation
│           └── quoteLineItemId → quote_line_item_id
```

`chk_po_item_parent` enforces that every `purchase_order_items` row has
exactly one of `purchase_order_group_id` / `purchase_order_combo_id` set.

### 11.6 Response Shape

The controller currently returns the raw repository row
(`typeof purchase_orders.$inferSelect`). The UI reads the JSONB buckets and
fetches the line-item tree from `purchase_order_groups` /
`purchase_order_combos` / `purchase_order_items` directly.

A richer response DTO (with inlined lookup `{id, name, externalReference}`
triplets and expanded line-item hierarchy) is tracked as follow-up; the shape
below is the **target** for when that DTO lands, not the current response:

```typescript
export class PurchaseOrderResponseDto {
  id: string;
  purchaseOrderNumber: string | null;
  externalId: string | null;            // Insurer's own reference
  name: string | null;
  status: LookupValueDto | null;
  purchaseOrderType: LookupValueDto | null;
  jobId: string | null;
  claimId: string | null;
  vendorId: string | null;
  quoteId: string | null;
  note: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  serviceWindow: Record<string, unknown>;     // incl. expiresInDays
  poTo: Record<string, unknown>;              // flattened to* → named keys
  poFor: Record<string, unknown>;
  poFrom: Record<string, unknown>;
  allocationContext: Record<string, unknown>; // vendorAllocation*, quoteRevisionId
  adjustmentInfo: Record<string, unknown>;
  totalAmount: number | null;
  adjustedTotal: number | null;
  adjustedTotalAdjustmentAmount: number | null;
  groups: POGroupResponseDto[];               // with nested combos & items
  invoices: InvoiceSummaryDto[];
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 11.7 Tenant Scoping

Every service method resolves the caller's tenant via `TenantContext` and
every repository call is scoped by `tenant_id`. There is no code path on this
module that bypasses tenant scoping. The mapper obtains tenant from the
orchestrator (which resolves it from the CW connection), never from the
payload's `tenantId` field.

---

## Acceptance Criteria

- [x] `GET /purchase-orders` returns paginated, tenant-scoped list with `jobId` / `vendorId` filters.
- [x] `GET /purchase-orders/:id` returns the persisted PO row (tenant-scoped).
- [x] `GET /purchase-orders/job/:jobId` returns all POs for a given job.
- [x] `POST /purchase-orders/:id` updates the PO in Crunchwork and refreshes `purchase_order_payload` locally.
- [x] Every field listed in CW Insurance REST API v17 §3.3.8 has an internal destination defined in [`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md).
- [x] Webhook-driven projection populates the **currently-mapped** subset (see [`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md) §11) into `purchase_orders`, `purchase_order_groups`, `purchase_order_combos`, `purchase_order_items`.
- [ ] Webhook-driven projection populates **all** lookup FKs, JSONB buckets (`po_to` / `po_for` / `po_from` / `service_window` / `adjustment_info` / `allocation_context`), promoted columns, and group-level items per [`docs/mapping/purchase_orders.md`](../mapping/purchase_orders.md) §§2–9. (Gaps are catalogued in §11 of that doc.)
- [ ] Inline `invoices[]` on a PO payload are delegated to `CrunchworkInvoiceMapper` during PO projection.
- [ ] Vendor and quote FKs (`vendor_id`, `quote_id`) are resolved by the mapper.
- [ ] `GET /purchase-orders` supports `claimId`, `status`, and `search` query parameters.
- [ ] Rich `PurchaseOrderResponseDto` with inlined lookup objects and expanded line-item hierarchy (see §11.6) — tracked as follow-up; UI currently consumes the raw row plus line-item children.
