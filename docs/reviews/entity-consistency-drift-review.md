# Entity Consistency & Drift Review

**Date:** 2026-08-22  
**Scope:** Full-stack entity lifecycle — repositories, services, controllers, transformers, use-cases, workflows, outbound events  
**Objective:** Identify architectural drift between entities and surface design issues that compound as the system scales

---

## Executive Summary

The codebase follows a layered NestJS architecture (Controller → Service → Repository) with a dedicated domain module (Transformers → Use-Cases → Workflows). The patterns were clearly well-designed initially, but incremental development across ~15 entity types has introduced significant drift. The drift is not random — it follows a chronological gradient where earlier entities (Job, Claim) are more fully-featured and later additions (Bills, WorkOrders) are thinner implementations that skip established patterns.

**Critical issues** (production-risk):
1. Tenant isolation bypass — 7/9 repositories allow cross-tenant updates
2. Race-condition exposure — Invoice and Quote projections lack idempotency protection
3. Fire-and-forget event loss — no retry, no dead-letter, no at-least-once guarantee

**Architectural drift** (tech-debt compounding):
4. Two competing soft-delete strategies (`deletedAt` vs `isDeleted`)
5. Two competing provider-sync architectures (OutboundSyncService vs direct CrunchworkService)
6. Two competing parent-resolution services (EntityRelationshipService vs ExternalObjectService)
7. Untyped transformers losing compile-time safety (7/10)

---

## 1. Repository Layer

### 1.1 Tenant Isolation Gap (CRITICAL)

Only **Contacts** and **Assessments** include `tenantId` in the `update()` WHERE clause. The remaining 7 repositories (Jobs, Invoices, Quotes, Tasks, WorkOrders, Bills, PurchaseOrders) filter only by `id`:

```typescript
// UNSAFE — current pattern in 7/9 repos
.where(eq(entity.id, params.id))

// SAFE — pattern in Contacts + Assessments
.where(and(eq(entity.id, params.id), eq(entity.tenantId, params.tenantId)))
```

If a UUID is ever leaked, guessed, or replayed from logs, an attacker on Tenant A could modify records belonging to Tenant B. The service layer does pass `tenantId` for reads, but the write path is unguarded at the data-access layer.

**Recommendation:** Add `tenantId` to all `update()` and `softDelete()` WHERE clauses. Consider a base repository class or Drizzle middleware that enforces this.

### 1.2 Soft-Delete Strategy Split

| Strategy | Entities |
|----------|----------|
| `deletedAt` (nullable timestamp) | Jobs, Quotes, Assessments, WorkOrders, PurchaseOrders |
| `isDeleted` (boolean flag) | Invoices, Bills |
| None (no soft-delete) | Contacts, Tasks |

This means:
- Generic utilities can't assume a universal "is this deleted?" check
- Reporting queries must know which strategy each table uses
- Future middleware (e.g. "exclude deleted by default") must handle both patterns

**Recommendation:** Migrate to a single strategy. `deletedAt` is superior (preserves deletion timestamp, doubles as both flag and audit field).

### 1.3 Transaction Support Gap

Assessments is the **only** repository missing `tx?: DrizzleDbOrTx` on `create()` and `update()`. This means Assessment operations cannot participate in multi-entity transactions started by use-cases or workflows.

### 1.4 findOne Deleted-Record Behaviour

Only Assessments filters `deletedAt` in `findOne`. Every other repository that has soft-delete will happily return a deleted record by ID. This is a correctness risk — controllers returning deleted entities as if they're active.

### 1.5 ViewRow Joins Inconsistency

| Has ViewRow + lookup joins in findAll | Missing (returns raw Row) |
|---------------------------------------|---------------------------|
| Jobs, Quotes, Tasks | Invoices, Bills, PurchaseOrders, WorkOrders, Contacts, Assessments |

The entities without ViewRow require N+1 queries at the frontend to resolve status/type names, or force the service layer to do the enrichment — adding latency and complexity.

### 1.6 Minor Drift

- **PurchaseOrders** manually sets `createdAt: new Date()` in `create()` — overrides DB default
- **Where-clause style**: Jobs uses array-push; all others use mutable reassignment
- **`create()` return**: Invoices/Tasks use `inserted!` (assertion); others return potentially-undefined value typed as non-null

---

## 2. Service Layer

### 2.1 findOne Error Contract (HIGH)

| Behaviour | Services |
|-----------|----------|
| Throws `NotFoundException` | Jobs, Assessments |
| Returns `null` | Contacts, Invoices, Quotes, Tasks, WorkOrders, Bills, PurchaseOrders, Appointments, RFQs |

Controllers must handle both patterns differently. More critically, a service calling another service's `findOne` might not expect a thrown exception (or might not expect `null`). This split creates a class of bugs where error handling is write-time guesswork.

**Recommendation:** Standardise on one pattern. Two methods (`findOne` returns null, `findOneOrFail` throws) is the cleanest.

### 2.2 Type Safety Abandonment (HIGH)

Bills, WorkOrders, and PurchaseOrders cast request bodies to `as any` before passing to repositories:

```typescript
// Found in bills.service.ts, work-orders.service.ts
await this.repo.create({ data: { ...body, tenantId } as any });
```

This bypasses all compile-time validation, meaning:
- Misspelled fields pass silently
- Type-wrong values (string where number expected) reach the database
- Schema changes won't produce build errors in these services

**Recommendation:** Create typed DTOs or at minimum entity-partial types for all services. Assessments demonstrates the correct pattern with `CreateAssessmentDto` / `UpdateAssessmentDto`.

### 2.3 Event Emission Coverage Gaps

| Has outbound events | No events (silent operations) |
|--------------------|-------------------------------|
| Jobs, Quotes, Tasks, Invoices, PurchaseOrders, Appointments, Assessments | **Bills, WorkOrders, Contacts, RFQs** |

Bills and WorkOrders represent financial commitments. Their creation and status changes are invisible to external integrations and audit systems.

### 2.4 Provider Sync Architecture Split

Two different architectures coexist for syncing to the external provider (Crunchwork):

| Architecture | Entities | Pattern |
|--------------|----------|---------|
| `OutboundSyncService` (queue-based, resilient) | Jobs | Enqueues a job; processed async with retries |
| Direct `CrunchworkService` calls (synchronous) | Quotes, Invoices, Tasks, Appointments, PurchaseOrders | In-line await; failure = request failure |

The queue-based pattern is architecturally superior (decoupled, retryable, non-blocking). Only Jobs uses it.

### 2.5 userId Audit Trail Gaps

| Missing userId on writes | Impact |
|-------------------------|--------|
| Jobs (create/update) | Can't track who created/modified jobs |
| Contacts (create) | Can't track who added contacts |
| Appointments (create/update) | Can't track who scheduled appointments |
| Tasks (update) | Can't track who modified tasks |

### 2.6 Logger Inconsistency

Three naming patterns exist:
- `Logger(ClassName.name)` — correct, refactor-safe
- `Logger('StringLiteral')` — fragile, won't update on rename
- No logger at all — Bills, Contacts

Log message prefixes also vary: `api:`, `[ClassName.method]`, `ClassName.method —`. This makes log aggregation and grep-based debugging unreliable.

---

## 3. Controller Layer

### 3.1 UUID Validation (HIGH)

Only **Jobs** and **Assessments** apply `ParseUUIDPipe` to `:id` params. The other 10 controllers pass raw strings — malformed IDs reach the service/repository layer, potentially causing cryptic database errors instead of clean 400 responses.

### 3.2 HTTP Verb Misuse

Assessments correctly uses `@Patch(':id')` for updates. All other controllers use `@Post(':id')` — non-RESTful and confusing for API consumers. The codebase uses POST for both creation and mutation.

### 3.3 Permission Model Gap — Reports

Reports uses `P.reports.read` for **create** and **update** endpoints because no `P.reports.manage` or `P.reports.create` permission exists. Any user with read access can create/modify reports.

### 3.4 DTO Validation

| Full DTO validation | `Record<string, unknown>` (no validation) |
|---------------------|---------------------------------------------|
| Assessments | Jobs, Contacts, Invoices, Quotes, Tasks, WorkOrders, Bills, PurchaseOrders, Appointments, RFQs, Reports |

10/12 controllers accept completely unvalidated request bodies. Combined with the `as any` casts in services, malformed payloads pass all the way to the database.

### 3.5 Pagination Default Drift

Appointments uses `undefined` defaults for page/limit (delegating to the service). All other controllers default to `page=1, limit=20`.

### 3.6 Missing CRUD Endpoints

- **Contacts** has no `update` endpoint
- No entity except Quotes and Assessments has a delete endpoint
- Appointments has `cancel` instead of delete (appropriate, but undocumented why)

---

## 4. Domain Transformer Layer

### 4.1 Type Safety (HIGH)

| Typed (`EntityTransformer<ConcreteInsert>`) | Untyped (`EntityTransformer` defaults to `Record<string, unknown>`) |
|---------------------------------------------|----------------------------------------------------------------------|
| Job, Claim, Quote (3/10) | Invoice, Report, PurchaseOrder, Appointment, Message, Task, Attachment (7/10) |

The 7 untyped transformers:
- Lose compile-time guarantees on the `entity` output shape
- Can't benefit from IDE autocomplete when mapping fields
- Allow misspelled field names to pass without error

### 4.2 Lookup Resolution Precedence Drift

The `ClaimTransformer` has a unique `declareOrRaw` pattern that handles bare-string lookups by stashing the raw value in customData. Other transformers (Invoice, Report, PO, Appointment, Message, Task, Attachment) handle bare-string lookups by declaring a lookup request with `name` instead of `externalReference`. Job and Quote don't handle bare-string lookups at all — if a lookup field arrives as a string rather than an object, those fields are silently lost.

### 4.3 Contact/Assignee Extraction

Only Job and Claim extract contacts and assignees. The extraction logic is effectively copy-pasted between them with minor variations. No shared utility exists.

### 4.4 Unknown-Key Preservation

Only Job and Claim sweep unrecognised payload keys into `customData`. Other transformers silently discard them (mitigated by the full payload being stored in an `apiPayload` JSONB column, but the unknown-key sweep allows quick field access without parsing the raw blob).

---

## 5. Projection Use-Cases

### 5.1 Race-Condition Exposure (CRITICAL)

| Has `createIfNotExists` (ON CONFLICT DO NOTHING) | Plain `create()` (no conflict handling) |
|---------------------------------------------------|-----------------------------------------|
| Job, Claim | **Invoice, Quote** |

If concurrent webhook deliveries arrive for the same Invoice or Quote (common with retry-heavy webhook systems), one will fail with a unique-constraint violation. Job and Claim correctly handle this by falling back to an update of the winning row.

### 5.2 External Link Management Inconsistency

| Pattern | Use-Cases |
|---------|-----------|
| `upsert()` on every path (create + update) | Job, Claim, Quote |
| Only creates link on insert path | **Invoice** |

If an Invoice's external link is ever deleted (data corruption, migration error), the system cannot re-establish it during a subsequent update — the invoice becomes "orphaned" from its external identity.

### 5.3 Parent Resolution Service Split

| Uses `EntityRelationshipService` | Uses `ExternalObjectService` directly |
|----------------------------------|---------------------------------------|
| Job, Claim, Quote | **Invoice** |

Two different resolution APIs solve the same problem (find internal entity ID from external reference). This means:
- Caching/indexing improvements to one service don't benefit the other
- A bug in resolution logic must be fixed in two places
- New developers must discover both patterns

### 5.4 Assignee Handling Inconsistency

| Strategy | Use-Case |
|----------|----------|
| Snapshots into `customData.assignees` (no join table) | Job |
| Dedicated `AssigneeSyncService` with `strategy: 'replace'` | Claim |
| No assignee support | Invoice, Quote |

Job's snapshot approach means assignees aren't queryable via SQL (buried in JSONB). Claim's approach is normalised but uses a different service. The system can't uniformly answer "who is assigned to entity X?"

---

## 6. Workflow Engine

### 6.1 Guard Coverage Gaps

| Entity | Missing Guards |
|--------|---------------|
| Invoice | No guard on `submit` — can submit an empty invoice |
| Work Order | No guard on `complete` — can complete with zero items |
| Bill | No guards at all — financial document with no precondition checks |
| Proposal | No guards on `accept` — can accept without review |

### 6.2 Hook Inconsistency

- **Contact workflows have zero hooks** — no `syncStatusLookup`, no `publishCrossTenantEvent`. Contact lifecycle changes are invisible.
- **Job uses `syncOutbound`** while all other entities use `publishCrossTenantEvent` — different hook name for conceptually similar operations.
- **`enableInvoiceCreation`** is a feature-flag side-effect on Work Order's `complete` transition — architecturally this belongs as a guard on Invoice creation, not a hook on WO completion.

### 6.3 Missing Workflows

| Entity | Has Workflow? | Should it? |
|--------|:---:|---|
| Assessment | No | Yes — has draft/submitted/complete lifecycle in the service |
| Report | No | Possibly — reports have publish states |
| Message | No | No — messages are immutable |
| Journal | No | No — journals are append-only |

### 6.4 Outbound Event Gaps

Almost all outbound events route through `entityType: 'job'` (the aggregate root). Sub-entities on the recipient tenant side (Bill, Work Order, RFQ, Proposal) have **no outbound event coverage**. If an external system needs to know a Bill was approved or a Work Order was completed, there's no mechanism to notify them.

---

## 7. Design Issues (Beyond Drift)

### 7.1 No Base Repository / Repository Trait

60 repositories with no shared base class means every pattern (tenant scoping, soft-delete filtering, pagination, sorting) is re-implemented per entity. A `BaseRepository<TTable>` with standard CRUD + tenant guards would eliminate most inconsistencies at the source.

### 7.2 No Request Validation Layer

The architecture has no uniform validation gate between controller and service. Class-validator DTOs are used in exactly one entity (Assessments). Everything else relies on the database to reject malformed data — producing 500 errors instead of 400s.

### 7.3 Monolithic Schema File

All Drizzle table definitions live in a single `schema/index.ts` (~3,500+ lines). This:
- Creates merge conflicts when multiple developers touch different entities
- Makes it hard to see which relations/indices belong to which entity
- Slows IDE performance with a single massive AST

### 7.4 Fire-and-Forget Event Reliability

All outbound events use a pattern like:

```typescript
this.outboundEventsService.emit(...).catch(() => {});
```

There is no:
- Retry mechanism
- Dead-letter queue
- At-least-once delivery guarantee
- Idempotency key on the event

If the recipient is temporarily unavailable, the event is permanently lost. For financial events (invoice.approved, purchase_order.completed), this is a data-integrity risk.

### 7.5 Transaction Discipline

- `ContactSyncService`: `tx` is **required**
- `LineItemSyncService`: `tx` is **optional** (defaults to `this.db`)
- `DocumentIssuanceService`: `tx` is **required**
- Repository `create()`/`update()`: `tx` is optional (except Assessments which doesn't accept it at all)

No consistent convention. If a caller forgets to pass `tx` to `LineItemSyncService`, the line items are written outside the parent entity's transaction — a partial-write risk.

---

## 8. Prioritised Remediation Roadmap

### P0 — Production Risk (fix immediately)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | Add `tenantId` to all repository `update()` WHERE clauses | S | Prevents cross-tenant data corruption |
| 2 | Add `createIfNotExists` to Invoice and Quote use-cases | S | Prevents duplicate creation on webhook retries |
| 3 | Add `ParseUUIDPipe` to all controller `:id` params | S | Prevents invalid IDs reaching the database |

### P1 — Data Integrity (fix this quarter)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 4 | Standardise soft-delete to `deletedAt` everywhere | M | Enables universal deleted-record filtering |
| 5 | Add DTO validation to all controllers | M | Rejects malformed requests at the edge |
| 6 | External link upsert on all use-case paths (Invoice update) | S | Prevents orphaned entities |
| 7 | Add outbound events for Bills, WorkOrders, RFQs | M | Enables external integration parity |
| 8 | Add `tx` support to Assessments repository | S | Enables transactional workflows |

### P2 — Architecture (plan this quarter, execute next)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 9 | Create `BaseRepository<T>` with tenant-guarded CRUD | L | Eliminates 80% of repository drift |
| 10 | Unify provider sync to queue-based `OutboundSyncService` | L | Resilient, retryable provider communication |
| 11 | Unify parent resolution to `EntityRelationshipService` | M | Single resolution path with shared caching |
| 12 | Type all transformers with concrete insert types | M | Compile-time field mapping safety |
| 13 | Split schema/index.ts into per-entity files | M | Developer ergonomics, fewer merge conflicts |
| 14 | Introduce event outbox pattern (replace fire-and-forget) | L | At-least-once event delivery |

### P3 — Consistency Polish (backlog)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 15 | Standardise findOne (return null) + add findOneOrFail | S | Predictable error contract |
| 16 | Add ViewRow joins to all repositories | M | Eliminate N+1 queries on list pages |
| 17 | Standardise logger naming to `ClassName.name` | S | Reliable log grep |
| 18 | Add workflow for Assessments | M | Lifecycle state machine parity |
| 19 | Add guards to Invoice/Bill/WorkOrder workflows | S | Prevent invalid state transitions |
| 20 | Standardise HTTP verbs (PATCH for updates) | S | RESTful API contract |
| 21 | Add userId tracking to Jobs, Contacts, Appointments | S | Complete audit trail |
| 22 | Normalise assignee handling (dedicated table, not JSONB) | M | Queryable assignment data |

---

## Appendix A — Entity Feature Matrix

| Entity | Typed Repo | Tenant-guarded Update | Soft Delete | ViewRow | UUID Pipe | DTO Validation | Events | Workflow | Provider Sync | Typed Transformer |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Job | Yes | **No** | deletedAt | Yes | Yes | No | Yes | Yes | Queue | Yes |
| Claim | Yes | — | — | — | — | — | — | — | — | Yes |
| Contact | Yes | Yes | None | No | No | No | No | Yes | No | — |
| Invoice | Yes | No | isDeleted | No | No | No | Yes | Yes | Direct | No |
| Quote | Yes | No | deletedAt | Yes | No | No | Yes | Yes | Direct | Yes |
| Task | Yes | No | None | Yes | No | No | Yes | No | Direct | No |
| Assessment | Yes | Yes | deletedAt | No | Yes | **Yes** | Yes | No | Direct | — |
| Work Order | Yes | No | deletedAt | Partial | No | No | **No** | Yes | No | — |
| Bill | Yes | No | isDeleted | No | No | No | **No** | Yes | No | — |
| Purchase Order | Yes | No | deletedAt | No | No | No | Yes | Yes | Direct | No |
| Appointment | Yes | No | None | No | No | No | Yes | No | Direct | No |
| RFQ | Yes | No | None | No | No | No | **No** | Yes | No | — |
| Report | Yes | No | None | No | No | No | No | No | No | No |
| Proposal | — | — | — | — | — | — | **No** | Yes | — | — |

---

## Appendix B — Workflow State Coverage

| Entity | States | Guards | Hooks | Cross-Tenant Hook |
|--------|--------|--------|-------|:-:|
| Job | 7 | allTasksClosed | syncStatusLookup, syncOutbound | No |
| Invoice | 5 | (none) | syncStatusLookup, issueDocument, publishCrossTenantEvent | Yes |
| Quote | 3 | hasLineItems | syncStatusLookup, issueDocument, publishCrossTenantEvent | Yes |
| Purchase Order | 6 | hasLineItems, hasRecipient, checkMaxDepth | syncStatusLookup, issueDocument, publishCrossTenantEvent | Yes |
| Bill | 6 | (none) | syncStatusLookup, publishCrossTenantEvent | Yes |
| Work Order | 6 | (none) | syncStatusLookup, enableInvoiceCreation, publishCrossTenantEvent | Yes |
| RFQ | 6 | hasLineItems, checkMaxDepth | syncStatusLookup, issueDocument, publishCrossTenantEvent | Yes |
| Contact | 4+3 | hasEmailOrPhone | (none) | No |
| Proposal | 4 | (none) | syncStatusLookup, createPurchaseOrder, publishCrossTenantEvent | Yes |

---

## Appendix C — Outbound Event Coverage

| Event | Emitted From | Missing For |
|-------|-------------|-------------|
| `job.created` | Jobs service | — |
| `task.created/completed/failed` | Tasks service | — |
| `quote.published/status_changed` | Quotes service | — |
| `invoice.approved` | Invoice use-case | — |
| `purchase_order.completed` | PO service | — |
| `appointment.scheduled` | Appointments service | — |
| `document.uploaded` | Assessments service | — |
| `field.updated` | Generic (Jobs) | — |
| `bill.*` | — | **All bill lifecycle events** |
| `work_order.*` | — | **All WO lifecycle events** |
| `rfq.*` | — | **All RFQ lifecycle events** |
| `proposal.*` | — | **All proposal lifecycle events** |
| `contact.*` | — | **All contact lifecycle events** |
| `vendor.*` | — | **All vendor lifecycle events** |
