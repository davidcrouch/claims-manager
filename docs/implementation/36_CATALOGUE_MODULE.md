# 36 — Item Catalogue Module

**Status:** Implementation plan — ready for development  
**Date:** 2026-06-14  
**Depends on:** `03_DATABASE_SETUP.md`, `06_TENANT_MODULE.md`, `07_LOOKUP_MODULE.md`  
**Related:** `10_QUOTES_MODULE.md`, `11_PURCHASE_ORDERS_MODULE.md`, `33b_WORK_ORDERS_MODULE.md`, `35c_DOMAIN_SERVICES.md`

---

## 0. Objective

Implement a tenant-scoped **construction item catalogue** that is the **system of record** for reusable priced items and assemblies. The catalogue feeds quote, purchase order, and work order line items via snapshot-based selection — document lines copy pricing at insert time and retain `catalog_item_id` / `catalog_combo_id` links for traceability and mismatch detection.

This plan covers database schema, API module, domain services, document integration, seed data, and a minimal admin UI. Crunchwork (and other providers) receive **mapped references only**; they do not own catalogue master data.

---

## 1. Locked design decisions

| Decision | Choice |
|----------|--------|
| **Master data** | claims-manager catalogue is authoritative |
| **Item model** | Single `catalog_items` table; `kind = 'primitive' \| 'assembly'` |
| **Types** | Dedicated `catalog_item_types` table (material, labour, equipment, vendor, other) |
| **Categories** | Dedicated `catalog_categories` table; self-referential `parent_category_id`; unlimited depth (typically 2–4 levels) |
| **Units** | Reuse `lookup_values` domain `unit_type` (existing on line-item tables) |
| **Pricing (v1)** | Default `unit_cost` / `buy_cost` on `catalog_items`; **no** separate price-list table |
| **Assembly pricing** | `computed` (default), `fixed`, or `cost_plus`; cache computed cost on the assembly row |
| **Assembly explosion** | **One level** when adding to a document: combo header + direct BOM children as lines; nested assemblies appear as single kit lines |
| **Document snapshot** | Copy name, description, type, category, unit, costs, markup to document lines; never re-read live catalogue prices on issued documents |
| **External sync** | `external_reference` on catalogue rows + optional `external_entity_links`; inbound unknown IDs → review queue, not auto-create |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Master Catalogue (Layer 1)                   │
│  catalog_item_types │ catalog_categories │ catalog_items         │
│                     │ catalog_assembly_components (BOM)          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ CatalogSelectionService
                                │ (snapshot + FK link)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Document Line Items (existing tables)               │
│  quote_groups / quote_combos / quote_items                       │
│  purchase_order_groups / purchase_order_combos / purchase_order_items │
│  work_order_groups / work_order_combos / work_order_items        │
└───────────────────────────────┬─────────────────────────────────┘
                                │ outbound sync (optional)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              External providers (Crunchwork, etc.)               │
│  catalogItemId / catalogComboId resolved via external_reference │
└─────────────────────────────────────────────────────────────────┘
```

**Module location:** `apps/api/src/modules/catalog/`  
**Repositories:** `apps/api/src/database/repositories/catalog-*.repository.ts`  
**Schema:** `apps/api/src/database/schema/index.ts` (new tables + FK backfill on existing line-item columns)

---

## 3. Database schema

### 3.1 `catalog_item_types`

```sql
create table catalog_item_types (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references organizations(id) on delete restrict,
  code          text not null,          -- material | labour | equipment | vendor | other
  name          text not null,
  sort_index    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, code)
);

create index idx_catalog_item_types_tenant on catalog_item_types (tenant_id, is_active);
```

### 3.2 `catalog_categories`

```sql
create table catalog_categories (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references organizations(id) on delete restrict,
  parent_category_id  uuid references catalog_categories(id) on delete restrict,
  code                text not null,
  name                text not null,
  sort_index          integer not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, parent_category_id, code)
);

create index idx_catalog_categories_tenant on catalog_categories (tenant_id, is_active);
create index idx_catalog_categories_parent on catalog_categories (tenant_id, parent_category_id);
```

**Notes:**

- `parent_category_id` null = root category.
- No max-depth column; depth computed via recursive CTE when needed.
- Items link to the **most specific** category leaf; reporting rolls up via ancestors.

### 3.3 `catalog_items`

```sql
create table catalog_items (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references organizations(id) on delete restrict,
  code                  text not null,
  name                  text not null,
  description           text,
  kind                  text not null,   -- primitive | assembly
  type_id               uuid not null references catalog_item_types(id),
  category_id           uuid references catalog_categories(id),
  sub_category_id       uuid references catalog_categories(id),
  unit_type_lookup_id   uuid references lookup_values(id),

  -- default pricing (single price list per tenant in v1)
  unit_cost             numeric(14,4),
  buy_cost              numeric(14,4),
  markup_type           text,            -- percent | fixed | none
  markup_value          numeric(14,4),
  tax_rate              numeric(14,4),

  -- assembly-only
  pricing_mode          text,            -- computed | fixed | cost_plus
  fixed_unit_cost       numeric(14,4),
  computed_unit_cost    numeric(14,4),   -- cached roll-up from BOM
  computed_cost_at      timestamptz,

  external_reference    text,
  is_active             boolean not null default true,
  effective_from        date,
  effective_to          date,
  metadata              jsonb not null default '{}'::jsonb,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  unique (tenant_id, code),
  constraint chk_catalog_items_kind check (kind in ('primitive', 'assembly')),
  constraint chk_catalog_items_primitive_unit check (
    kind = 'assembly' or unit_type_lookup_id is not null
  ),
  constraint chk_catalog_items_assembly_pricing check (
    kind = 'primitive' or pricing_mode is not null
  )
);

create index idx_catalog_items_tenant on catalog_items (tenant_id, is_active, deleted_at);
create index idx_catalog_items_type on catalog_items (tenant_id, type_id);
create index idx_catalog_items_category on catalog_items (tenant_id, category_id);
create index idx_catalog_items_kind on catalog_items (tenant_id, kind);
create unique index uq_catalog_items_tenant_extref
  on catalog_items (tenant_id, external_reference)
  where external_reference is not null;
```

### 3.4 `catalog_assembly_components` (BOM)

```sql
create table catalog_assembly_components (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references organizations(id) on delete restrict,
  assembly_id     uuid not null references catalog_items(id) on delete cascade,
  component_id    uuid not null references catalog_items(id) on delete restrict,
  quantity        numeric(14,4) not null default 1,
  waste_factor    numeric(8,4) not null default 1,
  sort_index      integer not null default 0,
  is_optional     boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint chk_bom_no_self_ref check (assembly_id != component_id)
);

create index idx_catalog_bom_assembly on catalog_assembly_components (tenant_id, assembly_id);
create index idx_catalog_bom_component on catalog_assembly_components (tenant_id, component_id);
```

**Rules enforced in application code (not DB):**

- `assembly_id` must reference a row where `kind = 'assembly'`.
- `component_id` may be primitive or assembly (nested BOM).
- No circular references (recursive CTE cycle check on insert/update).
- Same component may appear on multiple lines (no unique on `(assembly_id, component_id)`).

### 3.5 FK backfill on existing line-item tables

Add foreign keys from existing nullable UUID columns to `catalog_items`:

| Table | Column | FK target | Semantics |
|-------|--------|-----------|-----------|
| `quote_combos` | `catalog_combo_id` | `catalog_items.id` | Assembly (`kind = assembly`) |
| `quote_items` | `catalog_item_id` | `catalog_items.id` | Primitive or kit line |
| `purchase_order_combos` | `catalog_combo_id` | `catalog_items.id` | Assembly |
| `purchase_order_items` | `catalog_item_id` | `catalog_items.id` | Primitive or kit line |
| `work_order_combos` | `catalog_combo_id` | `catalog_items.id` | Assembly |
| `work_order_items` | `catalog_item_id` | `catalog_items.id` | Primitive or kit line |

Use `on delete set null` so retiring a catalogue item does not cascade-delete historical document lines.

Proposal tables (`proposal_combos`, `proposal_items`) follow the same pattern when that module is wired to catalogue selection.

### 3.6 Drizzle migration

1. Add tables in dependency order: types → categories → items → assembly_components.
2. Add FK constraints on line-item `catalog_*_id` columns (nullable, set null on delete).
3. Register tables and relations in `apps/api/src/database/schema/index.ts`.

Migration file naming: `apps/api/src/database/migrations-drizzle/XXXX_catalogue_module.sql` via `drizzle-kit generate`.

---

## 4. Seed data

### 4.1 Per-tenant bootstrap

Run on tenant creation (or one-off seed migration per existing org):

**Types** (`catalog_item_types`):

| code | name |
|------|------|
| `material` | Material |
| `labour` | Labour |
| `equipment` | Equipment |
| `vendor` | Vendor |
| `other` | Other |

**Categories** — seed a minimal tree; tenants extend via admin UI:

```
Trades
├── Electrical
├── Carpentry
├── Plumbing
├── Plastering
└── General
```

**Units** — ensure `lookup_values` domain `unit_type` includes: `ea`, `m2`, `lm`, `hr`, `day`, `kg`, `lot` (via existing lookups seed or tenant bootstrap).

### 4.2 Sample catalogue items (dev/staging only)

Optional seed script `apps/api/src/database/seeds/catalog-dev.seed.ts` with a handful of primitives and one two-level assembly for integration testing.

---

## 5. Module structure

```
apps/api/src/modules/catalog/
├── catalog.module.ts
├── catalog.controller.ts              # items + assemblies + selection
├── catalog-types.controller.ts
├── catalog-categories.controller.ts
├── services/
│   ├── catalog-item.service.ts
│   ├── catalog-category.service.ts
│   ├── catalog-type.service.ts
│   ├── catalog-assembly.service.ts    # BOM CRUD, cycle detection
│   ├── catalog-pricing.service.ts     # resolve unit cost, refresh computed
│   └── catalog-selection.service.ts   # add to quote/PO/WO
├── dto/
│   ├── create-catalog-item.dto.ts
│   ├── update-catalog-item.dto.ts
│   ├── catalog-item-query.dto.ts
│   ├── create-assembly-component.dto.ts
│   ├── update-assembly-component.dto.ts
│   ├── create-category.dto.ts
│   ├── update-category.dto.ts
│   ├── add-catalog-to-document.dto.ts
│   └── catalog-tree-response.dto.ts
└── interfaces/
    ├── catalog-item.interface.ts
    └── catalog-pricing.interface.ts

apps/api/src/database/repositories/
├── catalog-items.repository.ts
├── catalog-categories.repository.ts
├── catalog-item-types.repository.ts
└── catalog-assembly-components.repository.ts
```

Register `CatalogModule` in `apps/api/src/app.module.ts`.

---

## 6. Repository layer

### 6.1 `CatalogItemsRepository`

```typescript
async findMany(params: {
  tenantId: string;
  kind?: 'primitive' | 'assembly';
  typeId?: string;
  categoryId?: string;       // includes descendants when includeDescendants: true
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ data: CatalogItemRow[]; total: number }>;

async findById(params: { tenantId: string; id: string }): Promise<CatalogItemRow | null>;
async findByCode(params: { tenantId: string; code: string }): Promise<CatalogItemRow | null>;
async create(params: { tenantId: string; data: CatalogItemInsert }): Promise<CatalogItemRow>;
async update(params: { tenantId: string; id: string; data: Partial<CatalogItemInsert> }): Promise<CatalogItemRow>;
async softDelete(params: { tenantId: string; id: string }): Promise<void>;
```

### 6.2 `CatalogCategoriesRepository`

```typescript
async findTree(params: { tenantId: string; includeInactive?: boolean }): Promise<CategoryTreeNode[]>;
async findDescendantIds(params: { tenantId: string; categoryId: string }): Promise<string[]>;
async create / update / softDelete ...
```

Category filter on item search uses `findDescendantIds` + `IN (...)` or a recursive CTE in SQL.

### 6.3 `CatalogAssemblyComponentsRepository`

```typescript
async findByAssemblyId(params: { tenantId: string; assemblyId: string }): Promise<BomLineRow[]>;
async replaceBom(params: {
  tenantId: string;
  assemblyId: string;
  lines: BomLineInsert[];
  tx: DrizzleDbOrTx;
}): Promise<BomLineRow[]>;
async detectCycle(params: {
  assemblyId: string;
  componentId: string;
  tx?: DrizzleDbOrTx;
}): Promise<boolean>;
```

---

## 7. Service layer

### 7.1 `CatalogPricingService`

Resolves the effective unit cost for any catalogue item at a point in time.

```typescript
@Injectable()
export class CatalogPricingService {
  /** Primitive: unit_cost. Assembly: per pricing_mode. */
  async resolveUnitCost(params: {
    tenantId: string;
    itemId: string;
    asOf?: Date;
  }): Promise<ResolvedPrice>;

  /** Recursively compute assembly cost from BOM; update computed_unit_cost cache. */
  async refreshComputedCost(params: {
    tenantId: string;
    assemblyId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{ computedUnitCost: string }>;

  /** After component price or BOM change, mark affected parent assemblies stale. */
  async invalidateAssemblyCostCache(params: {
    tenantId: string;
    itemId: string;
  }): Promise<void>;
}
```

**Computed assembly cost formula (per 1 unit of assembly):**

```
Σ (line.quantity × line.waste_factor × resolveUnitCost(line.component_id))
```

For `pricing_mode = 'fixed'`, use `fixed_unit_cost`.  
For `pricing_mode = 'cost_plus'`, apply assembly-level `markup_type` / `markup_value` on top of computed cost.

### 7.2 `CatalogAssemblyService`

- CRUD BOM lines.
- Validate assembly has ≥1 component before `is_active = true`.
- Run cycle detection before add/update component.
- On BOM change → `CatalogPricingService.refreshComputedCost`.
- Block deactivation of items referenced in active BOMs or open documents (configurable: warn vs hard block).

### 7.3 `CatalogSelectionService`

Adds catalogue content to document line hierarchies with **one-level explosion**.

```typescript
@Injectable()
export class CatalogSelectionService {
  async addPrimitiveToQuote(params: {
    tenantId: string;
    quoteGroupId?: string;
    quoteComboId?: string;
    catalogItemId: string;
    quantity: string;
    tx: DrizzleDbOrTx;
  }): Promise<QuoteItemRow>;

  async addAssemblyToQuote(params: {
    tenantId: string;
    quoteGroupId: string;
    catalogAssemblyId: string;
    quantity: string;           // combo quantity multiplier
    tx: DrizzleDbOrTx;
  }): Promise<{ combo: QuoteComboRow; items: QuoteItemRow[] }>;

  // Mirror methods for purchase orders and work orders:
  // addPrimitiveToPurchaseOrder, addAssemblyToPurchaseOrder
  // addPrimitiveToWorkOrder, addAssemblyToWorkOrder
}
```

**`addAssemblyToQuote` algorithm (one-level explosion):**

1. Load assembly; verify `kind = 'assembly'` and `is_active`.
2. Load BOM lines ordered by `sort_index`.
3. Insert `quote_combo`:
   - `catalog_combo_id` = assembly id
   - `name`, `description`, `category`, `sub_category` from assembly
   - `quantity` = user quantity
4. For each BOM line:
   - `lineQty = bom.quantity × bom.waste_factor × combo.quantity`
   - Resolve component via `CatalogPricingService.resolveUnitCost`
   - Insert `quote_item` under combo:
     - **Primitive component:** full field snapshot; `catalog_item_id` = component id
     - **Nested assembly component:** snapshot assembly name/cost as a **single kit line**; `catalog_item_id` = nested assembly id; do **not** expand nested BOM
5. Compute combo `totals` JSONB from child lines (unitCost, subTotal, totalTax, total).
6. Return combo + items.

**Snapshot fields copied to document lines:**

`name`, `description`, `category`, `sub_category`, `item_type` (from type code), `unit_type_lookup_id`, `quantity`, `unit_cost`, `buy_cost`, `markup_type`, `markup_value`, `tax`, plus `catalog_item_id` or parent `catalog_combo_id`.

Document lines remain editable after insert (estimator overrides). Overrides do not write back to catalogue.

### 7.4 `CatalogItemService` / `CatalogCategoryService` / `CatalogTypeService`

Standard tenant-scoped CRUD with validation:

- Unique `code` per tenant.
- Primitive requires `unit_type_lookup_id`.
- Assembly requires `pricing_mode`; BOM optional until activation.
- Category move must not create cycles (same check as BOM).
- Soft delete sets `deleted_at`; reject if item is referenced in active BOM.

---

## 8. API endpoints

All routes under `/api/v1`, tenant-scoped, authenticated.

### 8.1 Types (read-heavy; admin write)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/catalog/types` | List types for tenant |
| `POST` | `/catalog/types` | Create type (Admin) |
| `POST` | `/catalog/types/:id` | Update type (Admin) |

### 8.2 Categories

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/catalog/categories` | Flat list |
| `GET` | `/catalog/categories/tree` | Nested tree for pickers |
| `POST` | `/catalog/categories` | Create category |
| `POST` | `/catalog/categories/:id` | Update category |
| `DELETE` | `/catalog/categories/:id` | Soft deactivate (block if items or children) |

### 8.3 Items

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/catalog/items` | Paginated search; filters: `kind`, `typeId`, `categoryId`, `q` |
| `GET` | `/catalog/items/:id` | Detail including BOM summary for assemblies |
| `POST` | `/catalog/items` | Create primitive or assembly shell |
| `POST` | `/catalog/items/:id` | Update item |
| `DELETE` | `/catalog/items/:id` | Soft delete |
| `POST` | `/catalog/items/:id/refresh-cost` | Recompute assembly cached cost (Admin) |

### 8.4 Assembly BOM

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/catalog/items/:id/components` | List BOM lines |
| `PUT` | `/catalog/items/:id/components` | Replace entire BOM (transactional) |
| `POST` | `/catalog/items/:id/components` | Add single BOM line |
| `POST` | `/catalog/items/:assemblyId/components/:lineId` | Update BOM line |
| `DELETE` | `/catalog/items/:assemblyId/components/:lineId` | Remove BOM line |

### 8.5 Document selection

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/quotes/:quoteId/groups/:groupId/catalog-items` | Add primitive to group or combo (body specifies parent) |
| `POST` | `/quotes/:quoteId/groups/:groupId/catalog-assemblies` | Add assembly (one-level explosion) |
| `POST` | `/purchase-orders/:poId/groups/:groupId/catalog-items` | Same for PO |
| `POST` | `/purchase-orders/:poId/groups/:groupId/catalog-assemblies` | Same for PO |
| `POST` | `/work-orders/:woId/groups/:groupId/catalog-items` | Same for WO |
| `POST` | `/work-orders/:woId/groups/:groupId/catalog-assemblies` | Same for WO |

Selection endpoints may live on `CatalogController` or on the respective entity controllers; prefer **entity controllers delegating to `CatalogSelectionService`** to keep quote/PO/WO modules as entry points.

### 8.6 Import (Phase 4)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/catalog/import/csv` | Bulk upsert items (Admin) |
| `GET` | `/catalog/import/template` | Download CSV template |

---

## 9. Integration with existing modules

### 9.1 Quote / PO / WO line items

Existing columns already reserved:

- `catalog_item_id`, `catalog_combo_id` on combo/item tables
- `category`, `sub_category`, `item_type` as text on lines — populate from catalogue type code and category name/code at snapshot time
- `mismatches` on quote items — future: detect when live catalogue price ≠ snapshotted `unit_cost` on draft quotes

**Phase 2 task:** Extend quote/PO/WO update flows to accept catalogue-driven line adds without requiring a Crunchwork round-trip when operating in internal-only mode.

### 9.2 Domain layer

Add to `35c` service inventory:

| Service | Phase |
|---------|-------|
| `CatalogPricingService` | 2 |
| `CatalogSelectionService` | 3 |

`CatalogSelectionService` receives `tx` from calling use case (same pattern as `LineItemSyncService`).

### 9.3 Crunchwork outbound (Phase 5 — optional)

When pushing quotes/POs to CW:

- Map local `catalog_items.external_reference` → CW `catalogItemId` / `catalogComboId`.
- Lines added from catalogue without CW ids send without catalogue refs until admin links `external_reference`.
- Inbound CW lines with unknown catalogue ids: log to review queue; **do not** auto-create catalogue rows.

### 9.4 Versioning

Issued documents use existing `VersioningService` snapshots. Catalogue changes after issue do not alter frozen line-item snapshots.

---

## 10. Frontend (minimal admin UI)

**Location:** `apps/frontend/src/app/(app)/admin/catalog/` (or under Settings → Catalogue)

| Page | Purpose |
|------|---------|
| `/admin/catalog` | Searchable item list; filters by type, category, kind |
| `/admin/catalog/items/new` | Create primitive or assembly |
| `/admin/catalog/items/[id]` | Edit item; BOM tab for assemblies |
| `/admin/catalog/categories` | Tree editor (indent, drag reorder, add child) |

**Shared components:**

- `CatalogItemPicker` — modal/drawer for quote/PO/WO line editors
- `CategoryTreeSelect` — hierarchical picker
- `AssemblyBomEditor` — grid: component, qty, waste, unit cost, extended cost, live total

**Sidebar:** Add "Catalogue" under Admin (alongside Settings) per `33i_ADMIN_PAGES.md` patterns.

Detailed UI steps can be split to `36a_CATALOGUE_UI.md` if the frontend scope grows; v1 can ship admin-only without quote-editor integration.

---

## 11. Validation and business rules

| Rule | Enforcement |
|------|-------------|
| Unique item `code` per tenant | DB unique + service |
| Primitive must have unit | DB check + DTO |
| Active assembly must have ≥1 BOM line | Service on activate |
| No circular BOM | `detectCycle` before save |
| No category cycles | Service on category parent change |
| Deactivate item referenced in BOM | Block or require remove from BOMs first |
| Labour types should use time units (`hr`, `day`) | Soft validation warning in UI |
| `effective_from` / `effective_to` | `resolveUnitCost` respects window; null = always effective |

---

## 12. Testing strategy

### 12.1 Unit tests

- `CatalogPricingService`: computed / fixed / cost_plus; nested assembly cost roll-up; waste factor
- `CatalogAssemblyService`: cycle detection (A→B→C→A rejected)
- `CatalogSelectionService`: one-level explosion; nested assembly as kit line; quantity multiplication

### 12.2 Integration tests

- CRUD items + categories + BOM in transaction
- Add assembly to quote → verify combo + correct number of item rows + snapshot fields
- FK set null when catalogue item soft-deleted; document lines retain copied data

### 12.3 Test fixtures

Use dev seed assembly: e.g. `BATH-RELINE` containing primitive lines + `WATERPROOF-KIT` sub-assembly.

---

## 13. Implementation phases

### Phase 1 — Schema and taxonomy (estimate: 1–2 days)

- [ ] Drizzle schema + migration for all catalogue tables
- [ ] FK backfill on `catalog_*_id` line-item columns
- [ ] Repositories: types, categories, items
- [ ] Seed types + root categories per tenant
- [ ] `CatalogTypeService`, `CatalogCategoryService` + controllers
- [ ] `GET/POST` category tree API

**Exit criteria:** Admin can manage types and category tree via API.

### Phase 2 — Primitives and assemblies (estimate: 2–3 days)

- [ ] `CatalogItemService` CRUD
- [ ] `CatalogAssemblyService` + BOM endpoints
- [ ] `CatalogPricingService` with computed cost cache
- [ ] Item search API with category descendant filter
- [ ] Unit tests for pricing and cycle detection

**Exit criteria:** Full catalogue CRUD including nested BOM; computed assembly costs refresh correctly.

### Phase 3 — Document selection (estimate: 2–3 days)

- [ ] `CatalogSelectionService` for quotes, POs, WOs
- [ ] Wire selection endpoints on entity controllers
- [ ] Combo totals calculation from snapshotted lines
- [ ] Integration tests: add assembly to quote

**Exit criteria:** User can add primitive or assembly from catalogue to a draft quote/PO/WO with one-level explosion.

### Phase 4 — Admin UI and import (estimate: 2–3 days)

- [ ] Admin catalogue list + item editor + category tree UI
- [ ] `CatalogItemPicker` component (standalone; quote integration optional)
- [ ] CSV import endpoint + template
- [ ] Dev seed data

**Exit criteria:** Operators manage catalogue without raw API calls.

### Phase 5 — External mapping and mismatch detection (estimate: 1–2 days, optional)

- [ ] Admin UI to set `external_reference` on catalogue items
- [ ] Inbound unknown catalogue id → review log
- [ ] Draft quote mismatch flag when catalogue price drifts from snapshot
- [ ] Outbound CW sync sends linked external refs

**Exit criteria:** Linked items round-trip to Crunchwork; unlinked items still work internally.

---

## 14. Deferred (post-v1)

| Feature | Reason to defer |
|---------|-----------------|
| Multiple price lists per tenant | Single default price agreed for v1 |
| "Expand sub-assembly to primitives" on quote | One-level explosion sufficient initially |
| Parametric BOM (`quantity_formula`) | Adds complexity; fixed quantities first |
| Vendor-specific item pricing | Link to `vendors` table later |
| Full-text fuzzy search (`pg_trgm`) | Add when catalogue exceeds ~5k items |
| Catalogue change audit log | Use generic audit module when available |
| `36a_CATALOGUE_UI.md` quote-editor inline picker | Ship admin first, embed in quote UI second |

---

## 15. Acceptance criteria (module complete)

- [ ] Tenant-scoped types, categories (unlimited depth), and items persisted with migrations applied
- [ ] Primitives and assemblies in unified `catalog_items` table
- [ ] BOM supports nested assemblies with cycle prevention and waste factors
- [ ] Assembly pricing: computed (default), fixed, cost_plus with cached `computed_unit_cost`
- [ ] Adding assembly to quote creates combo + one-level exploded item lines with price snapshot
- [ ] Adding primitive to quote/PO/WO creates snapshotted line with `catalog_item_id`
- [ ] claims-manager is catalogue master; no auto-create from external ids
- [ ] Soft delete catalogue items without breaking historical document lines
- [ ] Admin UI for catalogue and category management
- [ ] Unit and integration tests cover pricing, BOM cycles, and selection explosion

---

## 16. File checklist

| Action | Path |
|--------|------|
| Add tables | `apps/api/src/database/schema/index.ts` |
| Generate migration | `apps/api/src/database/migrations-drizzle/` |
| Add repositories | `apps/api/src/database/repositories/catalog-*.repository.ts` |
| Export repositories | `apps/api/src/database/repositories/index.ts` |
| New module | `apps/api/src/modules/catalog/**` |
| Register module | `apps/api/src/app.module.ts` |
| Tenant bootstrap | extend org/tenant creation or seed script |
| Selection hooks | `apps/api/src/modules/quotes/quotes.controller.ts` (and PO/WO) |
| Admin UI | `apps/frontend/src/app/(app)/admin/catalog/**` |
| Sidebar link | `apps/frontend/src/components/layout/AppSidebar.tsx` |

---

## 17. Mapping reference (future)

When inbound CW sync resolves catalogue ids, document in `docs/mapping/catalogue.md`:

- CW catalogue object shape → `catalog_items` columns
- Unknown id handling policy
- Outbound field mapping for `catalogItemId` / `catalogComboId`

That mapping doc is **Phase 5** deliverable; not required for internal-only catalogue operation.
