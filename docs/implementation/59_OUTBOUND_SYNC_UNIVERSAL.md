# 59 — Universal Outbound Sync: Transactional Outbox for All CW-Facing Entities

**Parent:** [35f — Outbound Sync](./35f_OUTBOUND_SYNC.md)
**Depends on:** [14 — Tasks Module](./14_TASKS_MODULE.md), [15 — Appointments Module](./15_APPOINTMENTS_MODULE.md), [10 — Quotes Module](./10_QUOTES_MODULE.md), [12 — Invoices Module](./12_INVOICES_MODULE.md)

---

## 0. Problem Statement

Five entity types communicate outbound to Crunchwork. Only one — **job update** — uses the transactional outbox (`outbound_sync_queue` + `OutboundWorkerService`). The other four use inline `CrunchworkService` calls with inconsistent failure handling:

| Entity | Current outbound path | On CW failure |
|--------|----------------------|---------------|
| Job update | Outbox (correct) | `syncStatus: 'failed'`, retries |
| **Job create** | Inline `CrunchworkOutboundAdapter.push()` | Exception propagates; `syncStatus: 'failed'`; no retry |
| **Task create/update** | Inline `CrunchworkService.createTask/updateTask` | Swallowed — saves locally, CW silently missed |
| **Appointment create/update** | Inline `CrunchworkService.createAppointment/updateAppointment` | Exception propagates — user loses local change |
| **Appointment cancel** | Inline (gated behind `APPOINTMENT_CANCEL_ENABLED`) | Exception propagates |
| **Quote publish** | Inline two-step: `createQuote` then `updateQuote` | Exception propagates; partial CW state possible |
| **Invoice publish** | Inline two-step: `createInvoice` then `updateInvoice` | Exception propagates; orphaned CW record possible |

This creates silent data drift (tasks), lost user work (appointments), orphaned remote records (quotes/invoices), and no visibility into sync state.

### Goal

Migrate all five entity types to the existing transactional outbox so that:

1. Domain operations always succeed locally (local-first)
2. CW sync is retried automatically with exponential backoff
3. Every CW-facing entity has a `syncStatus` column visible in the UI
4. Failed syncs are surfaced to users, not swallowed
5. A single `SyncStatusIndicator` component provides consistent UX across all entities

---

## 1. Two Outbox Patterns

The five entities fall into two categories based on *when* CW sync triggers:

### Pattern A: Continuous Sync

Entities where every create/update/cancel should push to CW.

| Entity | Trigger | CW API calls |
|--------|---------|-------------|
| Task | `create()`, `update()` | `POST /tasks`, `POST /tasks/{id}` |
| Appointment | `create()`, `update()`, `cancel()` | `POST /appointments`, `POST /appointments/{id}`, `POST /appointments/{id}/cancel` |
| Job create | `create()` | `POST /jobs` |

### Pattern B: Publish Sync

Entities where drafts are local-only and CW sync triggers only on publish.

| Entity | Trigger | CW API calls |
|--------|---------|-------------|
| Quote | `publish()` | `POST /quotes` (create shell) then `POST /quotes/{id}` (status Published) |
| Invoice | `publish()` | `POST /invoices` (create shell) then `POST /invoices/{id}` (apply group pricing) |

The outbox infrastructure is the same for both patterns. The difference is which service method calls `enqueue()`.

---

## 2. Schema Migration

### 2.1 Add `syncStatus` and `externalReference` columns

A single migration adds `sync_status` to tasks, appointments, quotes, and invoices. Tasks and appointments also need an `external_reference` column (quotes and invoices already have one).

```sql
-- Migration: add_universal_sync_status

ALTER TABLE tasks
  ADD COLUMN sync_status TEXT,
  ADD COLUMN external_reference TEXT;

ALTER TABLE appointments
  ADD COLUMN sync_status TEXT,
  ADD COLUMN external_reference TEXT;

ALTER TABLE quotes
  ADD COLUMN sync_status TEXT;
  -- quotes.external_reference already exists

ALTER TABLE invoices
  ADD COLUMN sync_status TEXT;
  -- invoices.source_external_reference already exists (serves as external_reference)

-- Shared check constraint pattern (applied to each table)
ALTER TABLE tasks ADD CONSTRAINT chk_task_sync_status
  CHECK (sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed'));
ALTER TABLE appointments ADD CONSTRAINT chk_appt_sync_status
  CHECK (sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed'));
ALTER TABLE quotes ADD CONSTRAINT chk_quote_sync_status
  CHECK (sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed'));
ALTER TABLE invoices ADD CONSTRAINT chk_invoice_sync_status
  CHECK (sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed'));

-- Index for efficient "show me everything that failed" queries
CREATE INDEX idx_tasks_sync_status ON tasks(tenant_id, sync_status) WHERE sync_status IS NOT NULL;
CREATE INDEX idx_appointments_sync_status ON appointments(tenant_id, sync_status) WHERE sync_status IS NOT NULL;
CREATE INDEX idx_quotes_sync_status ON quotes(tenant_id, sync_status) WHERE sync_status IS NOT NULL;
CREATE INDEX idx_invoices_sync_status ON invoices(tenant_id, sync_status) WHERE sync_status IS NOT NULL;
```

### 2.2 Column semantics

| Value | Meaning | UI treatment |
|-------|---------|-------------|
| `NULL` | No CW connection (direct-provider tenant, unpublished draft) | No indicator shown |
| `'pending'` | Queued for sync, not yet delivered | Spinner / "Syncing..." |
| `'synced'` | Successfully delivered to CW | Checkmark (subtle, fades after first view) |
| `'failed'` | Exhausted retries | Warning badge + "Retry" action |

### 2.3 Drizzle schema updates

Add to `apps/api/src/database/schema/index.ts`:

```typescript
// tasks table — add after existing columns
syncStatus: text('sync_status'),
externalReference: text('external_reference'),

// appointments table — add after existing columns
syncStatus: text('sync_status'),
externalReference: text('external_reference'),

// quotes table — add after existing columns
syncStatus: text('sync_status'),

// invoices table — add after existing columns
syncStatus: text('sync_status'),
```

---

## 3. Backend: Generalize `OutboundWorkerService.patchEntity`

Currently `patchEntity` only handles jobs:

```typescript
// Current (apps/api/src/modules/domain/outbound/outbound-worker.service.ts:168)
private async patchEntity(record: OutboundQueueRow, result: OutboundPushResult): Promise<void> {
  if (record.entityType === 'job') {
    // ... patch jobs table
  }
}
```

### 3.1 Entity patch registry

Replace with a table-driven approach:

```typescript
private readonly patchConfigs: Record<string, {
  table: PgTable;
  idColumn: PgColumn;
  syncStatusColumn: PgColumn;
  externalRefColumn?: PgColumn;
  responsePayloadColumn?: PgColumn;
}> = {
  job:         { table: jobs,         idColumn: jobs.id,         syncStatusColumn: jobs.syncStatus,         externalRefColumn: jobs.externalReference,              responsePayloadColumn: jobs.apiPayload },
  task:        { table: tasks,        idColumn: tasks.id,        syncStatusColumn: tasks.syncStatus,        externalRefColumn: tasks.externalReference,             responsePayloadColumn: tasks.taskPayload },
  appointment: { table: appointments, idColumn: appointments.id, syncStatusColumn: appointments.syncStatus, externalRefColumn: appointments.externalReference },
  quote:       { table: quotes,       idColumn: quotes.id,       syncStatusColumn: quotes.syncStatus,       externalRefColumn: quotes.externalReference,            responsePayloadColumn: quotes.apiPayload },
  invoice:     { table: invoices,     idColumn: invoices.id,     syncStatusColumn: invoices.syncStatus,     externalRefColumn: invoices.sourceExternalReference,    responsePayloadColumn: invoices.invoicePayload },
};

private async patchEntity(record: OutboundQueueRow, result: OutboundPushResult): Promise<void> {
  const config = this.patchConfigs[record.entityType];
  if (!config) return;

  const patch: Record<string, unknown> = { [config.syncStatusColumn.name]: 'synced', updatedAt: new Date() };
  if (result.externalReference && config.externalRefColumn) {
    patch[config.externalRefColumn.name] = result.externalReference;
  }
  if (result.responsePayload && config.responsePayloadColumn) {
    patch[config.responsePayloadColumn.name] = result.responsePayload;
  }

  await this.db.update(config.table).set(patch).where(eq(config.idColumn, record.entityId));
}
```

Similarly, `markFailed` must patch `syncStatus: 'failed'` on the entity row for all types, not just jobs.

---

## 4. Backend: Service Changes

### 4.1 Tasks — Pattern A (continuous sync)

**File:** `apps/api/src/modules/tasks/tasks.service.ts`

#### `create()` — replace inline CW call with enqueue

Current flow:
1. Call `crunchworkService.createTask()` inline
2. On success: insert row with CW response in `taskPayload`
3. On failure: catch, insert row with empty `taskPayload`

New flow:
1. Insert row with `syncStatus: 'pending'` (or `null` if no connection)
2. Within the same transaction, call `outboundSync.enqueueIfConnected()` with action `'create'`
3. Return to user immediately
4. Worker calls `CrunchworkOutboundAdapter.pushTask()` asynchronously
5. On success: worker patches `syncStatus: 'synced'`, `externalReference`, `taskPayload`
6. On failure: worker patches `syncStatus: 'failed'`

#### `update()` — replace inline CW call with enqueue

Current flow:
1. Call `crunchworkService.updateTask()` inline
2. On success: update row with CW response
3. On failure: catch, update row with local-only patch

New flow:
1. Update row locally with `syncStatus: 'pending'`
2. Cancel any existing pending enqueue for this task (debounce)
3. Enqueue with action `'update'`, payload includes `externalReference` for CW routing
4. Worker handles retry; patches `syncStatus` on completion

#### Payload construction

The enqueue payload must include enough context for the adapter:
- `externalReference` — the CW task id (for updates)
- The original `body` fields that CW needs
- `jobId` resolved to CW's job id (from `job.apiPayload.id` or `job.externalReference`)

### 4.2 Appointments — Pattern A (continuous sync)

**File:** `apps/api/src/modules/appointments/appointments.service.ts`

Same pattern as tasks. The existing `buildOutboundBody()` method already constructs the CW payload shape (resolves CW job id, maps attendees, etc.). Move that logic into the enqueue payload so the adapter receives a CW-ready body.

#### `create()` — save locally + enqueue
#### `update()` — patch locally + enqueue
#### `cancel()` — patch locally (status Cancelled) + enqueue with action `'cancel'`

Remove the `APPOINTMENT_CANCEL_ENABLED` gate — the outbox makes cancel safe to enable since the user's local state is always saved.

### 4.3 Job Create — Pattern A (continuous sync)

**File:** `apps/api/src/modules/jobs/jobs.service.ts`

Current flow (lines 355–404):
1. Insert job row with `syncStatus: 'pending'`
2. Call `crunchworkOutbound.push()` inline
3. On success: patch `syncStatus: 'synced'`, `externalReference`, `apiPayload`
4. On failure: patch `syncStatus: 'failed'`, cancel pending queue entries, throw

New flow:
1. Insert job row with `syncStatus: 'pending'` (unchanged)
2. Enqueue to `outbound_sync_queue` with action `'create'` (replaces inline push)
3. Return job to caller — the job exists locally with `syncStatus: 'pending'`
4. Worker processes: pushes to CW, patches `syncStatus`/`externalReference`/`apiPayload`

**Trade-off:** Today, job create throws on CW failure so the caller knows immediately. With the outbox, the caller gets a success and discovers failure later via `syncStatus`. This is intentional — the local job is valid and useful even before CW confirms. Downstream operations (start workflow, create tasks) can proceed on the local record.

**Workflow interaction:** `startWorkflowForJob` is called after create. With the outbox, the workflow starts on the local job while CW sync happens in parallel. If CW sync fails, the job still exists locally with `syncStatus: 'failed'`; the workflow is unaffected because it operates on local state.

### 4.4 Quotes — Pattern B (publish sync)

**File:** `apps/api/src/modules/quotes/quotes.service.ts`

#### `create()` — unchanged (local draft, `syncStatus: null`)
#### `update()` on drafts — unchanged (local only)

#### `publish()` — replace inline CW calls with enqueue

Current flow:
1. Build outbound groups via `CatalogSelectionService`
2. `crunchworkService.createQuote()` → get CW quote id
3. Validate CW response groups
4. `crunchworkService.updateQuote()` → status Published
5. Patch local row: `externalReference`, status Pending, totals

New flow:
1. Build outbound groups (same as today)
2. Patch local row: status Pending, `syncStatus: 'pending'`, stamp `publishStatus` on line items
3. Enqueue with action `'publish'`, payload includes the full outbound groups + enrichment
4. Worker calls enhanced `CrunchworkOutboundAdapter.pushQuote()`:
   a. `createQuote` → get CW id
   b. Validate response groups (log warning, don't throw on empty — leave for manual review)
   c. `updateQuote` with status Published
   d. Return `externalReference: cwQuoteId` + `responsePayload`
5. Worker patches: `syncStatus: 'synced'`, `externalReference`, `apiPayload`

#### `update()` on published quotes — enqueue with action `'update'`

Currently calls `crunchworkService.updateQuote()` inline. Change to enqueue; the adapter uses `externalReference` to route the update.

### 4.5 Invoices — Pattern B (publish sync)

**File:** `apps/api/src/modules/invoices/invoices.service.ts`

#### `create()` — unchanged (local draft, `syncStatus: null`)
#### `update()` on drafts — unchanged (local only)

#### `publish()` — replace inline CW calls with enqueue

Current flow:
1. Resolve existing CW invoice id (reuse check)
2. `crunchworkService.createInvoice()` → get CW invoice id
3. `applyCrunchworkInvoiceGroupPricing()` → update CW invoice with line-item amounts
4. Patch local row: `sourceExternalReference`, status Submitted, totals

New flow:
1. Resolve existing CW invoice id (same reuse check)
2. Patch local row: status Submitted, `syncStatus: 'pending'`
3. Enqueue with action `'publish'`, payload includes PO reference, group pricing data, and reused CW id if any
4. Worker calls enhanced `CrunchworkOutboundAdapter.pushInvoice()`:
   a. If reusing: `getInvoice` to verify CW record
   b. Else: `createInvoice` → get CW id
   c. Apply group pricing via `updateInvoice`
   d. Return `externalReference: cwInvoiceId` + `responsePayload`
5. Worker patches: `syncStatus: 'synced'`, `sourceExternalReference`, `invoicePayload`, totals

---

## 5. Backend: Adapter Enhancements

### 5.1 `CrunchworkOutboundAdapter.pushTask()`

Already exists and is sufficient for simple create/update. Needs one fix: resolve `externalReference` from the payload (not the local entity id) when routing update calls.

### 5.2 `CrunchworkOutboundAdapter.pushAppointment()`

Already exists. Same external id resolution fix as tasks.

### 5.3 `CrunchworkOutboundAdapter.pushQuote()`

Currently a simple create-or-update. Must be enhanced to handle the `'publish'` action:

```typescript
if (action === 'publish') {
  // Step 1: Create quote shell on CW
  const createResponse = await this.crunchwork.createQuote({ connectionId, body: payload.createBody });
  const cwQuoteId = createResponse.id;

  // Step 2: Update with status Published
  const publishBody = { ...payload.publishBody, status: 'Published' };
  const updateResponse = await this.crunchwork.updateQuote({ connectionId, quoteId: cwQuoteId, body: publishBody });

  return { externalReference: cwQuoteId, responsePayload: updateResponse };
}
```

### 5.4 `CrunchworkOutboundAdapter.pushInvoice()`

Must be enhanced to handle the `'publish'` action with the two-step vendor-tax create + pricing overlay. The logic currently in `InvoicesService.publish()` (build create body, apply group pricing) moves here.

### 5.5 `CrunchworkOutboundAdapter.pushJob()` — create action

Already works. Currently called inline from `JobsService.create()`. With this change, the worker calls it via the outbox instead.

---

## 6. Backend: External ID Resolution

### 6.1 The problem

When the adapter sends an update to CW, it needs the CW entity id — not our local UUID. Today this is inconsistent:

| Entity | Where CW id lives |
|--------|--------------------|
| Job | `jobs.externalReference` |
| Task (CW-originated) | `external_links` table |
| Task (locally-created, synced inline) | Buried in `taskPayload` response |
| Appointment | Same situation as task |
| Quote | `quotes.externalReference` (set on publish) |
| Invoice | `invoices.sourceExternalReference` (set on publish) |

### 6.2 The fix

When the worker patches an entity after a successful **create** or **publish**, it writes the CW id into `externalReference` (or `sourceExternalReference` for invoices). Subsequent updates include this value in the enqueue payload so the adapter can route correctly.

For existing data (tasks/appointments that were previously synced inline), a one-time backfill script extracts the CW id from `taskPayload.id` / `appointmentPayload.id` and writes it to the new `externalReference` column.

### 6.3 Backfill script

```typescript
// scripts/backfill-external-references.ts

// Tasks: extract taskPayload.id → externalReference where originType = 'user' and taskPayload.id exists
// Appointments: extract appointmentPayload.id → externalReference where appointmentPayload.id exists
// Skip records where externalReference is already set
// Skip records with originType = 'provider' (these use external_links)
```

---

## 7. Backend: OutboundEventsService (More0 events)

The `OutboundEventsService` fire-and-forget calls (`emitTaskCreated`, `emitTaskCompleted`, etc.) are **separate from CW sync**. These wake up More0 playbooks and should continue to fire inline from the service methods — they are not part of this outbox migration.

However, the worker should also fire these events on successful sync when the action is `'create'` or when status changes imply completion/failure. This ensures playbooks are notified even if the original service call's fire-and-forget emission failed.

---

## 8. Frontend: `SyncStatusIndicator` Component

### 8.1 Shared component

A single reusable component used across tasks, appointments, quotes, and invoices.

**File:** `apps/frontend/src/components/shared/SyncStatusIndicator.tsx`

```typescript
interface SyncStatusIndicatorProps {
  syncStatus: 'pending' | 'synced' | 'failed' | null | undefined;
  onRetry?: () => void;
  compact?: boolean; // Row-level icon vs drawer detail
}
```

| `syncStatus` | Compact (row) | Full (drawer) |
|--------------|--------------|---------------|
| `null` / `undefined` | Nothing rendered | Nothing rendered |
| `'pending'` | Small spinner icon | "Syncing with Crunchwork..." text + spinner |
| `'synced'` | Small cloud-check icon (muted) | "Synced" label in metadata footer |
| `'failed'` | Warning triangle icon (destructive) | "Sync failed" alert + error detail + Retry button |

### 8.2 Task list integration

**File:** `apps/frontend/src/components/tasks/TasksListClient.tsx`

- Add `SyncStatusIndicator` inline next to the task name (compact mode)
- Add "Sync failed" filter option to the existing status filter menu
- On `syncStatus === 'failed'`, the row gets a subtle destructive background tint

### 8.3 Task drawer integration

**File:** `apps/frontend/src/components/forms/TaskFormDrawer.tsx`

- Add `SyncStatusIndicator` (full mode) to the metadata footer alongside Created/Updated/Origin
- When `syncStatus === 'failed'`, show a "Retry" button that calls `POST /tasks/{id}/retry-sync`

### 8.4 Appointment list and drawer

Same pattern as tasks. `SyncStatusIndicator` inline on rows, full detail in drawer.

### 8.5 Quote detail

**File:** `apps/frontend/src/components/quotes/QuoteDetail.tsx`

- Show `SyncStatusIndicator` after publish (when `syncStatus` is non-null)
- The existing "Insurer Review" card is a natural home for sync status
- Publish wizard returns immediately; indicator shows progress

### 8.6 Invoice detail

**File:** `apps/frontend/src/components/invoices/InvoiceDetail.tsx`

- Show `SyncStatusIndicator` after publish
- The publish button changes from "Submit to NRMA (wait)" to "Submit to NRMA (returns immediately)"
- Indicator shows sync progress in the detail view

### 8.7 Frontend type updates

**File:** `apps/frontend/src/types/api.ts`

Add `syncStatus?: 'pending' | 'synced' | 'failed' | null` to `Task`, `Appointment`, `Quote`, and `Invoice` interfaces.

---

## 9. Backend: Retry Endpoint

A generic retry endpoint that re-enqueues a failed sync:

**File:** `apps/api/src/modules/domain/outbound/outbound-retry.controller.ts`

```
POST /outbound-sync/:entityType/:entityId/retry
```

- Validates entity exists and belongs to the tenant
- Checks `syncStatus === 'failed'`
- Resets `syncStatus` to `'pending'`
- Calls `OutboundSyncService.enqueueIfConnected()` with the entity's current state as payload
- Returns 200

Used by the frontend "Retry" button on any entity's `SyncStatusIndicator`.

---

## 10. Admin: Sync Queue Dashboard

### 10.1 API endpoint

```
GET /admin/outbound-sync/summary
```

Returns aggregated queue health:

```json
{
  "pending": { "task": 3, "appointment": 0, "quote": 1, "invoice": 0, "job": 2 },
  "failed": { "task": 1, "appointment": 0, "quote": 0, "invoice": 1, "job": 0 },
  "sent_last_hour": 47,
  "avg_processing_seconds": 2.3
}
```

### 10.2 Admin page

**File:** `apps/frontend/src/app/(app)/admin/outbound-sync/page.tsx`

Shows queue depth by entity type, failed records with error details, and bulk retry actions. Lower priority — the per-entity `SyncStatusIndicator` handles the common case.

---

## 11. Implementation Sequence

Work is ordered to deliver value incrementally. Each phase is independently deployable.

### Phase 1: Schema + Worker Generalization

1. **Migration:** Add `sync_status` and `external_reference` columns to tasks, appointments, quotes, invoices
2. **Drizzle schema:** Update `apps/api/src/database/schema/index.ts`
3. **Worker:** Generalize `patchEntity` and `markFailed` in `OutboundWorkerService` to support all five entity types via the patch config registry
4. **Backfill script:** Extract CW ids from payload JSON into new `externalReference` columns for existing tasks/appointments

### Phase 2: Tasks (Pattern A)

5. **TasksService.create():** Replace inline `crunchworkService.createTask()` with local insert + `outboundSync.enqueueIfConnected()`
6. **TasksService.update():** Replace inline `crunchworkService.updateTask()` with local patch + cancel-and-re-enqueue
7. **Adapter:** Ensure `pushTask()` resolves `externalReference` correctly for updates
8. **Frontend:** Add `syncStatus` to `Task` type, add `SyncStatusIndicator` to task list rows and drawer

### Phase 3: Appointments (Pattern A)

9. **AppointmentsService.create():** Replace inline CW call with local insert + enqueue
10. **AppointmentsService.update():** Replace inline CW call with local patch + enqueue
11. **AppointmentsService.cancel():** Replace inline CW call with local status patch + enqueue; remove `APPOINTMENT_CANCEL_ENABLED` gate
12. **Adapter:** Ensure `pushAppointment()` resolves `externalReference` correctly
13. **Frontend:** Add `syncStatus` to `Appointment` type, add `SyncStatusIndicator` to appointment list and drawer

### Phase 4: Job Create (Pattern A)

14. **JobsService.create():** Replace inline `crunchworkOutbound.push()` with enqueue to outbox
15. **Remove** the inline try/catch/throw pattern (lines 357–404 of `jobs.service.ts`)
16. **Frontend:** Job list already shows `syncStatus` — verify create flow works with the indicator

### Phase 5: Quotes (Pattern B)

17. **QuotesService.publish():** Replace inline `createQuote` + `updateQuote` with local status patch + enqueue
18. **QuotesService.update() for published quotes:** Replace inline `updateQuote` with enqueue
19. **Adapter:** Enhance `pushQuote()` to handle the `'publish'` action (two-step create + status update)
20. **Frontend:** Add `syncStatus` to `Quote` type, add `SyncStatusIndicator` to quote detail view. Publish wizard returns immediately instead of waiting for CW.

### Phase 6: Invoices (Pattern B)

21. **InvoicesService.publish():** Replace inline `createInvoice` + pricing overlay with local status patch + enqueue
22. **Adapter:** Enhance `pushInvoice()` to handle the `'publish'` action (two-step create + group pricing)
23. **Move** pricing overlay logic from `InvoicesService` into the adapter (or a shared utility the adapter calls)
24. **Frontend:** Add `syncStatus` to `Invoice` type, add `SyncStatusIndicator` to invoice detail view. Publish wizard returns immediately.

### Phase 7: Retry + Admin

25. **Retry endpoint:** `POST /outbound-sync/:entityType/:entityId/retry`
26. **Frontend:** Wire "Retry" button in `SyncStatusIndicator` to the retry endpoint
27. **Admin summary endpoint + page** (lower priority)

---

## 12. Testing Strategy

### 12.1 Unit tests

- **OutboundWorkerService:** `patchEntity` correctly updates each entity type's `syncStatus` and `externalReference`
- **Each service:** Verify `enqueueIfConnected` is called (not `CrunchworkService` directly) on create/update/publish
- **Each service:** Verify `syncStatus` is set to `'pending'` on the entity row
- **Adapter:** Each `push*` method handles create, update, publish actions correctly

### 12.2 Integration tests

- Create a task → verify `outbound_sync_queue` row exists with correct entity type/action/payload
- Simulate worker processing → verify entity `syncStatus` transitions to `'synced'`
- Simulate adapter failure → verify retry scheduling and eventual `'failed'` status
- Verify `cancelPending` works when a second update arrives before the first is processed

### 12.3 E2E tests

- Task create → verify CW receives the task (via staging or nock stub)
- Quote publish → verify two-step CW flow completes and `externalReference` is set
- Invoice publish → verify CW invoice id appears in `sourceExternalReference`
- Failed sync → verify UI shows warning indicator and retry works

---

## 13. Configuration

No new environment variables. The existing outbound worker config applies:

```
OUTBOUND_ENABLED=true              # Kill switch
OUTBOUND_POLL_INTERVAL_MS=5000     # Worker poll interval
OUTBOUND_BATCH_SIZE=10             # Records per poll cycle
```

Max attempts (5) and backoff (exponential, max 5 min) are set on the queue row at enqueue time and are unchanged.

---

## 14. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| **Increased queue volume** — tasks and appointments create far more outbound events than jobs alone | Monitor queue depth in Phase 2; increase `OUTBOUND_BATCH_SIZE` if needed. The worker is I/O-bound (waiting on CW), not CPU-bound. |
| **Ordering** — two rapid task updates could arrive at CW out of order | Use `cancelPending()` + re-enqueue with the latest state. CW receives only the final state, not intermediate mutations. |
| **Quote publish partial failure** — CW create succeeds but status update fails | The adapter stores the CW id in the queue row payload on first success. Retry only performs step 2. Worker patches `externalReference` on final success. |
| **Invoice orphaned CW record** — same as quote | Same mitigation: store intermediate CW id in queue payload, retry only the failing step. |
| **User confusion** — publish returns immediately but CW hasn't confirmed yet | `SyncStatusIndicator` makes the async nature visible. Polling or WebSocket update resolves within seconds for the happy path. |
| **Backfill correctness** — existing `taskPayload.id` may not always be the CW id | Script validates UUID format and cross-references `external_links` for CW-originated records. Manual review for edge cases. |
| **Job create behaviour change** — callers currently rely on CW failure being thrown | Document the change. `syncStatus: 'failed'` on the job row replaces the thrown exception. Callers that need to know about CW failure should poll or check `syncStatus`. |

---

## 15. Out of Scope

- **OutboundEventsService (More0 events)** — remains fire-and-forget. Making playbook triggering reliable is a separate concern.
- **Inbound sync** — webhook projection pipeline is unaffected.
- **Cross-tenant pub/sub** — already uses the outbox (`enqueuePubsub`); no changes needed.
- **Message sync** — messages use `createMessage` inline; can be added in a future phase following the same Pattern A approach.
- **Report sync** — reports use `updateReport` inline; same future-phase candidate.
- **Attachment sync** — attachments use `createAttachment`/`updateAttachment` inline; same future-phase candidate.
