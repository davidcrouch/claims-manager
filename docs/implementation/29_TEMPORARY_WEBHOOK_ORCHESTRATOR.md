# 29 — Temporary In-Process Webhook Orchestrator (Crunchwork → External → Internal)

**Date:** 2026-04-17
**Status:** Implementation Plan — Temporary (to be retired when More0 workflow layer is live)
**Depends on:** [19](19_WEBHOOKS_MODULE.md), [26](26_INTEGRATION_SCHEMA_HARDENING.md), [27](27_WEBHOOK_PIPELINE_V2_OVERVIEW.md) (blocked), [27d](27d_ENTITY_MAPPER_SERVICE.md)
**CW Contract:** `docs/Insurance REST API-v17-20260304_100318.pdf` (v17, §2.2 Event contract, §3.2 Endpoints, §3.3 Entities)
**Mapping specs:** `docs/mapping/README.md` + `docs/mapping/claims.md` (additional entity docs to follow)

---

## 0. Purpose & Scope

`More0` (the agentic AI workflow layer at `/repos/capabilities`) is the intended orchestrator for the Crunchwork → local‑DB sync pipeline (see doc 27). Until More0 is wired in, the webhook pipeline dead-ends at `processing_status = 'fetched'` — the external object is persisted, but **nothing projects it into the internal tables** because the final mapper step is dispatched to a mocked workflow engine.

This plan specifies a **temporary, in-process orchestrator** that runs end-to-end inside the NestJS API, triggered directly by the Crunchwork webhook, so that:

1. A webhook is received and durably persisted (already done).
2. The event contract `type` (`NEW_JOB`, `NEW_QUOTE`, `UPDATE_PURCHASE_ORDER`, …) is resolved to a provider entity type (already done).
3. The full entity payload is fetched from Crunchwork using the provider entity id (already done).
4. The payload is upserted into `external_objects` / `external_object_versions` (already done).
5. **(NEW / GAP)** The payload is projected into the correct internal table via the existing `EntityMapper` registry and an `external_links` row is written.
6. `external_processing_log` is closed out (`completed` or `failed`) and `inbound_webhook_events.processing_status` transitions to a terminal state (`completed` / `failed`).

**Out of scope.** Multi-replica durability, long-running ASL retries, human-in-the-loop workflows. Those remain More0's job (doc 27 onwards). This plan is explicitly a **stop-gap** with a retirement path documented in §10.

**Non-goals.** We are **not** removing More0 code, not deleting tool endpoints (`/api/v1/tools/…`), and not changing the HTTP contract of `POST /webhooks/crunchwork`. Those remain valid and will reactivate when More0 goes live.

---

## 1. Current State vs Target State

### 1.1 What exists today

| Step | Actor | Status | Notes |
|---|---|---|---|
| Receive POST `/webhooks/crunchwork` | `WebhooksController.handleWebhook` | Implemented | Dedup by `external_event_id`; returns 200 OK |
| Resolve connection (`tenantId` + `client`) | `WebhooksService.resolveConnection` | Implemented | Looks up `integration_connections` |
| Verify HMAC (`event-signature`) | `WebhookHmacService.verify` | Implemented | Per-connection secret |
| Persist inbound event (`status = 'pending'`) | `WebhooksService.persistEvent` | Implemented | Stores `raw_body_text`, `raw_body_json`, verified flag |
| Resolve `event.type` → provider entity type | `ExternalToolsController.resolveEntityType` (static map) | Implemented | `EVENT_TYPE_TO_ENTITY` (see §2.1) |
| Fetch full entity from Crunchwork | `CrunchworkService.fetchEntityByType` | Implemented | Per-entity GET (§2.2) |
| Upsert `external_objects` + `external_object_versions` | `ExternalObjectService.upsertFromFetch` | Implemented | Hash-based version bump |
| Create `external_processing_log` row (`pending`) | `WebhooksService.processEventAsync` | Implemented | Inside the same TX as upsert |
| Set `inbound_webhook_events.processing_status = 'fetched'` | `WebhooksService.processEventAsync` | Implemented | Inside TX |
| **Invoke More0 workflow** | `More0Service.invokeWorkflow` | **Mocked (no-op)** | `MORE0_API_KEY` unset → logs only |
| **Project external object → internal table** | `ExternalToolsController.mapEntity` via `Crunchwork*Mapper` | **Not invoked from webhook path** | Only reachable via HTTP from More0 |
| Close `external_processing_log` (`completed`) | Tool endpoint `processing-log/update` | Not invoked |
| Close `inbound_webhook_events` | n/a | Not invoked — event stuck at `fetched` |

### 1.2 Target state (this plan)

Insert a **new orchestration step** inside `WebhooksService.processEventAsync` (and the sweep path, §7) that, after the external-object TX commits, invokes the in-process `EntityMapper` for the resolved entity type and then finalises both the processing log and the webhook event status. More0 continues to be invoked **only if `MORE0_API_KEY` is configured**; otherwise the in-process mapper runs instead.

---

## 2. Crunchwork Event Contract — Reference

All details in this section come from `docs/Insurance REST API-v17-20260304_100318.pdf` §2.2 and §3.2. This section exists so the orchestrator's behaviour can be audited against the contract without reopening the PDF.

### 2.1 Event body shape (PDF §2.2.3)

```json
{
  "id": "messageId",
  "type": "NEW_JOB",
  "timestamp": "2025-01-10T00:30:00.681Z",
  "payload": {
    "id": "UUID",
    "teamIds": ["UUID"],
    "tenantId": "UUID",
    "client": "ABCD",
    "projectExternalReference": "12345"
  }
}
```

### 2.2 Event type → provider entity → fetch endpoint

The existing `EVENT_TYPE_TO_ENTITY` map in `ExternalToolsController` covers every event listed in PDF §2.2.2. The table below is the authoritative mapping **this orchestrator relies on**; it MUST stay in sync with both the PDF §2.2.2 and `CrunchworkService.ENTITY_FETCH_MAP`.

| Event type (`event.type`) | Provider entity type | Fetch method on `CrunchworkService` | CW endpoint | Has mapper today? |
|---|---|---|---|---|
| `NEW_JOB` | `job` | `getJob({ jobId })` | `GET /jobs/{id}` | Yes |
| `UPDATE_JOB` | `job` | `getJob` | `GET /jobs/{id}` | Yes |
| `NEW_CLAIM` | `claim` | `getClaim({ claimId })` | `GET /claims/{id}` (Phase 3) | Yes (thin) |
| `UPDATE_CLAIM` | `claim` | `getClaim` | `GET /claims/{id}` | Yes |
| `NEW_PURCHASE_ORDER` | `purchase_order` | `getPurchaseOrder` | `GET /purchase-orders/{id}` | Yes |
| `UPDATE_PURCHASE_ORDER` | `purchase_order` | `getPurchaseOrder` | `GET /purchase-orders/{id}` | Yes |
| `NEW_INVOICE` | `invoice` | `getInvoice` | `GET /invoices/{id}` | Yes |
| `UPDATE_INVOICE` | `invoice` | `getInvoice` | `GET /invoices/{id}` | Yes |
| `NEW_MESSAGE` | `message` | `getMessage` | `GET /messages/{id}` | Yes |
| `NEW_TASK` | `task` | `getTask` | `GET /tasks/{id}` | Yes |
| `UPDATE_TASK` | `task` | `getTask` | `GET /tasks/{id}` | Yes |
| `NEW_QUOTE` | `quote` | `getQuote` | `GET /quotes/{id}` (Phase 2) | **NO — to add** (see §6) |
| `UPDATE_QUOTE` | `quote` | `getQuote` | `GET /quotes/{id}` | **NO — to add** |
| `NEW_REPORT` | `report` | `getReport` | `GET /reports/{id}` (Phase 2) | **NO — to add** |
| `UPDATE_REPORT` | `report` | `getReport` | `GET /reports/{id}` | **NO — to add** |
| `NEW_APPOINTMENT` | `appointment` | `getAppointment` | `GET /appointments/{id}` (Phase 3) | **NO — to add** |
| `UPDATE_APPOINTMENT` | `appointment` | `getAppointment` | `GET /appointments/{id}` | **NO — to add** |
| `NEW_ATTACHMENT` | `attachment` | `fetchAttachmentWithScopedId` | `GET /attachments/{scopedId}` | Yes |
| `UPDATE_ATTACHMENT` | `attachment` | `fetchAttachmentWithScopedId` | `GET /attachments/{scopedId}` | Yes |

Phase 2/3 endpoints are gated in the current doc 00 plan. Any event whose fetch endpoint is not yet available will be reported as `fetch_failed` in `inbound_webhook_events.processing_error`; the sweep service (doc 27b) will re-dispatch when the endpoint comes online.

---

## 3. Architecture Overview

```
  Crunchwork
  ───────────
  POST /webhooks/crunchwork ──────▶ WebhooksController
                                      ├─ dedup (external_event_id)
                                      ├─ resolve connection + HMAC
                                      ├─ TX-1: INSERT inbound_webhook_events ('pending')
                                      ├─ return 200 OK ───────────────────────────▶ Crunchwork
                                      └─ fire-and-forget: WebhooksService.processEventAsync(...)

                                    WebhooksService.processEventAsync
                                      ├─ resolve entity type (map in §2.2)
                                      ├─ CrunchworkService.fetchEntityByType
                                      │   └─ on fail → status='fetch_failed', log, STOP
                                      ├─ TX-2: ExternalObjectService.upsertFromFetch
                                      │       + processingLogRepo.create('pending')
                                      │       + webhookRepo.updateProcessingStatus('fetched')
                                      │
                                      ├─ ┌──────────────────────────────────────────┐
                                      │  │ NEW: WebhookOrchestratorService          │
                                      │  │   ├─ if MORE0_ENABLED:                   │
                                      │  │   │    More0Service.invokeWorkflow       │
                                      │  │   │    status → 'dispatched'             │
                                      │  │   └─ else (default, today):              │
                                      │  │        InProcessProjectionService.run()  │
                                      │  │          └─ TX-3: mapper + processing log│
                                      │  │            update + webhook status update│
                                      │  └──────────────────────────────────────────┘
                                      └─ on any error → log + status='failed'
```

The controller contract is unchanged. Only the work performed inside `processEventAsync` changes, and it is now governed by a feature flag so the pipeline can hot-swap to More0 once available.

---

## 4. Feature Flag & Configuration

A single flag decides which final step runs. Add to `apps/api/src/config/more0.config.ts` (or the equivalent config namespace already holding More0 settings):

| Env variable | Default | Purpose |
|---|---|---|
| `MORE0_ENABLED` | `false` | If `true`, the orchestrator dispatches to More0; if `false`, it runs the in-process projection. |
| `MORE0_API_KEY` | `""` | Existing. Required when `MORE0_ENABLED=true`. |
| `WEBHOOK_INPROC_MAPPING_ENABLED` | `true` | Kill switch for the in-process mapper step (e.g. to disable during schema migrations). |

Resolution logic (`WebhookOrchestratorService.shouldUseMore0()`):

```
if MORE0_ENABLED && MORE0_API_KEY present:
    route = "more0"
elif WEBHOOK_INPROC_MAPPING_ENABLED:
    route = "inproc"
else:
    route = "none"        # event stays at 'fetched' and sweep will retry
```

This replaces the current implicit "mock mode" behaviour in `More0Service` with an explicit, auditable decision recorded in the processing log's `metadata` column (`{ "orchestratorRoute": "inproc" }`).

---

## 5. Implementation Steps — Sequential

The steps below are numbered as they must be delivered. Each step is independently shippable; the whole plan does not need to land in one PR.

### Step 1 — Add configuration surface

**File:** `apps/api/src/config/more0.config.ts` (extend).

- Add `enabled: boolean` reading `MORE0_ENABLED`.
- Add a new config namespace `webhook` (or extend the existing one) with `inProcMappingEnabled: boolean` reading `WEBHOOK_INPROC_MAPPING_ENABLED` (default `true`).
- Register in `env.validation.ts`.

**Acceptance:** `ConfigService.get('more0.enabled')` and `ConfigService.get('webhook.inProcMappingEnabled')` both resolve with correct defaults; `.env.example` updated.

---

### Step 2 — Introduce `WebhookOrchestratorService`

**File:** `apps/api/src/modules/webhooks/webhook-orchestrator.service.ts` (new).

Owns only the orchestration decision and the final-step dispatch. Does **not** talk to Crunchwork directly and does **not** upsert external objects — those stay in `WebhooksService`.

Skeleton (all log prefixes follow the project rule `WebhookOrchestratorService.<method>`):

```ts
@Injectable()
export class WebhookOrchestratorService {
  private readonly logger = new Logger('WebhookOrchestratorService');

  constructor(
    private readonly configService: ConfigService,
    private readonly more0Service: More0Service,
    private readonly inProcProjection: InProcessProjectionService, // step 3
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly webhookRepo: InboundWebhookEventsRepository,
  ) {}

  async finalize(params: {
    eventId: string;
    tenantId: string;
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string;
    externalObjectId: string;
    processingLogId: string;
    eventType: string;
  }): Promise<{ route: 'more0' | 'inproc' | 'none'; ok: boolean }> { ... }

  private shouldUseMore0(): boolean { ... }
}
```

Behaviour matrix:

| Route | Action on success | Action on failure |
|---|---|---|
| `more0` | Invoke workflow, set webhook status `dispatched`, set processing log `processing` (workflow handles the rest). | Log; leave webhook status `fetched`; sweep picks up. |
| `inproc` | Call `InProcessProjectionService.run(...)` (step 3). On success, webhook status `completed`, log `completed`. | Webhook status `failed` or `mapper_failed`; processing log `failed` with `errorMessage`. |
| `none` | Warn; leave at `fetched` for sweep or manual replay. | n/a |

**Acceptance:** unit tests cover the three branches; route is recorded in `external_processing_log.metadata`.

---

### Step 3 — Introduce `InProcessProjectionService`

**File:** `apps/api/src/modules/external/in-process-projection.service.ts` (new, inside `ExternalModule`).

Collapses, in one atomic TX, the work that More0's workflow would otherwise do via the `/api/v1/tools/mappers/:entityType` and `/api/v1/tools/processing-log/update` tool endpoints. Reuses the existing `EntityMapper` registry rather than duplicating logic.

Contract:

```ts
async run(params: {
  tenantId: string;
  connectionId: string;
  providerEntityType: string;   // 'job' | 'claim' | 'purchase_order' | ...
  externalObjectId: string;
  processingLogId: string;
  webhookEventId: string;
}): Promise<{
  internalEntityType: string;
  internalEntityId: string;
}>;
```

Implementation outline:

1. Load the external object row by id (must exist — this service runs after TX-2).
2. Look up the mapper from the registry (injected via `ExternalToolsController.mappers` or, preferably, a new `EntityMapperRegistry` provider — see step 4).
3. If no mapper for `providerEntityType`, mark processing log `skipped_no_mapper` and webhook `completed_unmapped`. Do NOT throw — some event types (e.g. `quote` today) are intentionally unmapped until §6 lands.
4. Open a single DB transaction and inside it:
   - Call `mapper.map({ externalObject, tenantId, connectionId, tx })` (see step 5 re: `tx` parameter).
   - `processingLogRepo.updateStatus({ id, status: 'completed', completedAt, externalObjectId, tx })`.
   - `webhookRepo.updateProcessingStatus({ id: webhookEventId, processingStatus: 'completed', processedAt: now, tx })`.
5. On any exception in the TX, the caller (`WebhookOrchestratorService`) marks processing log `failed` and webhook `mapper_failed` with the error message.

**Acceptance:** happy-path unit test (job webhook → row in `jobs` + `external_links`); unknown-type path writes `skipped_no_mapper`; thrown mapper error rolls the TX back and leaves `jobs` unchanged.

---

### Step 4 — Promote the mapper registry to its own provider

Today the `mappers` record lives as a private field on `ExternalToolsController` and is only populated in `onModuleInit`. That's fine for HTTP, but makes it awkward for `InProcessProjectionService` to consume. Extract it.

**File:** `apps/api/src/modules/external/entity-mapper.registry.ts` (new).

```ts
@Injectable()
export class EntityMapperRegistry implements OnModuleInit {
  private mappers: Record<string, EntityMapper> = {};

  constructor(
    @Optional() private readonly jobMapper?: CrunchworkJobMapper,
    @Optional() private readonly claimMapper?: CrunchworkClaimMapper,
    // ...all existing + new mappers from §6
  ) {}

  onModuleInit(): void { /* register all non-null mappers keyed by entity type */ }

  get(params: { entityType: string }): EntityMapper | undefined {
    return this.mappers[params.entityType];
  }
}
```

`ExternalToolsController` switches to consuming `EntityMapperRegistry` instead of holding its own dictionary. Export the registry from `ExternalModule`.

**Acceptance:** no behaviour change for the existing tool endpoints; `InProcessProjectionService` receives `EntityMapperRegistry` in its constructor.

---

### Step 5 — Add optional `tx` parameter to `EntityMapper`

The in-process orchestrator needs the mapper + external link + processing log + webhook status update to commit atomically. Doc 27d already calls for this change (and is currently blocked on More0). Land it now as part of this temporary plan because the in-process path benefits the same way.

Scope (file-level):

| File | Change |
|---|---|
| `apps/api/src/modules/external/tools/external-tools.controller.ts` (interface declaration) | Add `tx?: DrizzleDbOrTx` to `EntityMapper.map` params. |
| `apps/api/src/modules/external/mappers/crunchwork-job.mapper.ts` | Pass `tx` through to `jobsRepo.update/create`, `externalLinksRepo.upsert`, and into `NestedEntityExtractor.extractFromJobPayload`. |
| `apps/api/src/modules/external/mappers/crunchwork-claim.mapper.ts` | Pass `tx` through. |
| `apps/api/src/modules/external/mappers/crunchwork-purchase-order.mapper.ts` | Use `tx ?? this.db` consistently for all `this.db.insert/.update/.delete` calls. |
| `apps/api/src/modules/external/mappers/crunchwork-invoice.mapper.ts` | Same pattern. |
| `apps/api/src/modules/external/mappers/crunchwork-task.mapper.ts` | Same pattern. |
| `apps/api/src/modules/external/mappers/crunchwork-message.mapper.ts` | Same pattern. |
| `apps/api/src/modules/external/mappers/crunchwork-attachment.mapper.ts` | Same pattern. |
| `apps/api/src/modules/external/nested-entity-extractor.service.ts` | Accept and pass `tx`. |
| Repositories used by mappers | Verify each already accepts an optional `tx` (most already do — confirm during implementation). |

**Acceptance:** all existing unit tests still pass; each mapper has a new test that passes a dummy tx and asserts every DB call goes through it.

---

### Step 6 — Add the three missing mappers

Event types `NEW_QUOTE`, `UPDATE_QUOTE`, `NEW_REPORT`, `UPDATE_REPORT`, `NEW_APPOINTMENT`, `UPDATE_APPOINTMENT` arrive via webhook today and are successfully fetched + stored in `external_objects`, but there is no mapper so they never reach the internal tables. Add minimal mappers that follow the same pattern as `CrunchworkClaimMapper` / `CrunchworkInvoiceMapper` (enough to satisfy the idempotency contract in doc 27d §4; deep field coverage can follow in per-entity mapping docs — see §8).

New files:

- `apps/api/src/modules/external/mappers/crunchwork-quote.mapper.ts`
  - Target: `quotes` table. Parent: resolve `jobId` via `ExternalObjectService.resolveInternalEntityId` from `payload.job.id`.
  - Minimum fields: `tenantId`, `jobId`, `externalReference = payload.id`, `quoteNumber`, `name`, `note`, `apiPayload: payload`.
- `apps/api/src/modules/external/mappers/crunchwork-report.mapper.ts`
  - Target: `reports` table. Parent: resolve `jobId` from `payload.job?.id`, `claimId` from `payload.claim?.id`.
  - Minimum fields: `tenantId`, `jobId/claimId`, `title`, `reportData: payload`, `apiPayload: payload`.
- `apps/api/src/modules/external/mappers/crunchwork-appointment.mapper.ts`
  - Target: `appointments` table (NB: `job_id` is `notNull`). Resolve job via `payload.job?.id`; if unresolved, the mapper writes `skipped_no_parent` to the processing log (do **not** insert with a zero UUID).
  - Minimum fields: `tenantId`, `jobId`, `name`, `location`, `startDate`, `endDate`, `status`, `appointmentPayload: payload`.

Register all three in `ExternalModule` and in `EntityMapperRegistry` (step 4).

**Acceptance:** each mapper has a unit test and an integration test inserting a realistic payload; the controller tool endpoint `POST /api/v1/tools/mappers/{quote|report|appointment}` succeeds end-to-end; entity types appear in `EVENT_TYPE_TO_ENTITY` already (they do).

---

### Step 7 — Refactor `WebhooksService.processEventAsync`

Remove the direct call to `more0Service.invokeWorkflow`. Delegate to the new orchestrator.

Diff intent (pseudocode, not literal patch):

```ts
// BEFORE (current)
await this.more0Service.invokeWorkflow({ workflowName: 'process-webhook-event', input: {...} });
await this.webhookRepo.updateProcessingStatus({ id, processingStatus: 'dispatched' });

// AFTER (this plan)
const result = await this.orchestrator.finalize({
  eventId: params.eventId,
  tenantId: params.tenantId,
  connectionId: params.connectionId,
  providerEntityType: entityType,
  providerEntityId: params.providerEntityId,
  externalObjectId: externalObjectId!,
  processingLogId: processingLogId!,
  eventType: params.eventType,
});
// Orchestrator has already set webhook + log status. No further action here.
```

The "CW fetch failed" (`fetch_failed`) and "CW returned but upsert TX failed" paths are unchanged — they still live in `WebhooksService` because they happen before orchestration.

**Acceptance:** `processEventAsync` no longer imports `More0Service` directly (it does still exist in `webhooks.module.ts` so the orchestrator can reach it); existing integration test covering the happy path passes with route `inproc`; a new integration test with `MORE0_ENABLED=true` + `MORE0_API_KEY=test` + stubbed workflow asserts route `more0` is taken.

---

### Step 8 — Update the webhook sweep service (doc 27b)

`WebhookSweepService.redispatch` today only invokes More0. When `MORE0_ENABLED=false`, it must run the in-process orchestrator instead, reusing the same decision logic.

Change: inject `WebhookOrchestratorService` into the sweep, and for each stale event:

1. Re-run `CrunchworkService.fetchEntityByType` only if the event is still at `pending` (i.e. never reached TX-2).
   - If it's already at `fetched`, skip the fetch — the external object exists — and jump straight to `orchestrator.finalize(...)` using the existing `external_object` and `external_processing_log` rows (look up by `event_id`).
2. Call `orchestrator.finalize(...)`.
3. Increment `retry_count` on any exception.

**Acceptance:** unit test for each branch (pending → full run; fetched → mapping only); integration test that manually inserts a `fetched` event row and verifies the next sweep completes it.

---

### Step 9 — Status value catalogue

To keep downstream dashboards (doc 21) and the providers UI (doc 28) honest, pin down the status enums we are now writing to.

`inbound_webhook_events.processing_status`:

| Value | Set by | Meaning |
|---|---|---|
| `pending` | controller | Persisted, not yet dispatched. |
| `fetch_failed` | `processEventAsync` | CW fetch gave up (4xx/5xx after retries). |
| `fetched` | `processEventAsync` | External object upserted; awaiting projection. |
| `dispatched` | orchestrator (more0 route) | Workflow invocation accepted by More0. |
| `completed` | orchestrator (inproc route) | Internal projection succeeded. |
| `completed_unmapped` | orchestrator (inproc route) | External object stored, no mapper registered. |
| `mapper_failed` | orchestrator (inproc route) | Mapper threw; processing log has the reason. |
| `failed` | any | Unexpected error outside of the above paths. |

`external_processing_log.status`:

| Value | Meaning |
|---|---|
| `pending` | Row created during TX-2. |
| `processing` | More0 workflow in flight (more0 route only). |
| `completed` | Projection succeeded. |
| `failed` | Projection threw; `error_message` populated. |
| `skipped_no_mapper` | No mapper registered for this entity type. |
| `skipped_no_parent` | Mapper refused to insert because a required parent entity wasn't yet linked. |
| `workflow_invoke_failed` | More0 `invokeWorkflow` threw. |

Document these in `docs/implementation/27f_OBSERVABILITY_AND_RECOVERY.md` (extend — do not duplicate).

**Acceptance:** a DB `CHECK` constraint or a validation helper enforces the whitelist; every code path that writes a status uses one of these values.

---

### Step 10 — Observability

Minimum additions (surfaced via existing logger + the providers monitoring UI, doc 28):

- Log line on each route choice: `WebhookOrchestratorService.finalize — eventId=… route=inproc entity=job`.
- Prometheus-style counters (or at minimum structured log fields) for `webhook_events_total{route,status}` so success/failure of the inproc route is visible before More0 lands.
- A 1-query admin endpoint `GET /api/v1/admin/webhooks/summary` returning counts by `processing_status` for the last 24h. (Extends doc 28's webhook monitor.)

**Acceptance:** running the app locally with the mock webhook fixture moves an event from `pending` → `fetched` → `completed` and each transition shows up in the log.

---

### Step 11 — Tests & validation

Required automated tests before merge:

1. **Unit — `WebhookOrchestratorService`**: three branches (more0 enabled / disabled / projection disabled).
2. **Unit — `InProcessProjectionService`**: happy path, unknown entity type, mapper throws, TX rolls back.
3. **Unit — each new mapper** (quote, report, appointment): create path, update path, missing parent path.
4. **Integration — webhook → DB**: for each of `NEW_JOB`, `NEW_CLAIM`, `NEW_PURCHASE_ORDER`, `NEW_INVOICE`, `NEW_MESSAGE`, `NEW_TASK`, `NEW_QUOTE`, `NEW_REPORT`, `NEW_APPOINTMENT`, `NEW_ATTACHMENT`, post a fixture webhook against the local app (CW calls stubbed with `nock` or equivalent) and assert:
   - A row exists in the correct internal table.
   - A row exists in `external_objects` with the right `provider_entity_type`.
   - A row exists in `external_links` joining the two.
   - `inbound_webhook_events.processing_status = 'completed'`.
   - `external_processing_log.status = 'completed'`.
5. **Integration — sweep recovery**: insert a `fetched` row pointing at a real `external_objects` row, wait one sweep cycle, assert the event completes.
6. **Integration — feature flag**: with `MORE0_ENABLED=true` + stubbed workflow endpoint, assert webhook status moves to `dispatched` and that no internal-table row is written (because More0 owns that path).

Manual validation checklist (documented in the PR):

- [ ] Post a `NEW_JOB` webhook; claim + job + external_object + external_link all land.
- [ ] Post a duplicate (same `event.id`); the controller returns 200 with no DB change.
- [ ] Post a `NEW_ATTACHMENT` with an unresolvable `scopedId`; event goes to `fetch_failed`; sweep retries; after manual CW fix, completes.
- [ ] Toggle `WEBHOOK_INPROC_MAPPING_ENABLED=false`; webhook stops at `fetched`; sweep skips it; toggling back on resumes.

---

## 6. Data Model Impact

No schema migrations are required beyond what already exists. All writes use existing tables:

- `inbound_webhook_events` (status transitions only; no new columns).
- `external_objects`, `external_object_versions` (no change — `upsertFromFetch` is already transaction-aware).
- `external_links` (upserted by mappers).
- `external_processing_log` (new status values added per §Step 9 — if a `CHECK` constraint is introduced for the first time, that is a net-new migration; otherwise it's informal).
- Internal entity tables (`claims`, `jobs`, `quotes`, `purchase_orders`, `invoices`, `messages`, `tasks`, `reports`, `appointments`, `attachments`) — writes governed by the mappers; no schema change.

If step 9's `CHECK` constraint is adopted, add a single Drizzle migration `drizzle/XXXX_processing_status_whitelist.sql` that enforces the enum on both tables.

---

## 7. Failure & Recovery Matrix (in-process route)

| Failure point | Resulting status | Recovery |
|---|---|---|
| HMAC invalid | `persistEvent` still runs (with `hmac_verified=false`); orchestration is skipped | Manual: fix secret, replay via sweep or admin replay endpoint |
| CW fetch 4xx | `fetch_failed` with error body | Sweep retries until `retry_count >= 10`, then manual |
| CW fetch 5xx | CW service retries 3× internally; final error → `fetch_failed` | Same as above |
| TX-2 (external object upsert) fails | Event stays `pending`; no partial row | Sweep re-drives from step 1 |
| Mapper throws | Webhook `mapper_failed`; log `failed` with message; internal table untouched (TX rolled back) | Fix mapper/data, then admin replay or sweep |
| Orchestrator process crash between TX-2 and TX-3 | Event stays `fetched`; external_object present; internal missing | Sweep path (§Step 8) picks it up and runs projection only |
| `MORE0_ENABLED=true` but More0 down | `dispatched` (no actual run) | Sweep re-dispatches; or flip flag to fall back to in-process |

---

## 8. Documentation updates

To keep the mapping docs (the canonical spec) honest, add stub files for the new mappers so they follow the `docs/mapping/claims.md` pattern:

- `docs/mapping/jobs.md`
- `docs/mapping/purchase_orders.md`
- `docs/mapping/invoices.md`
- `docs/mapping/quotes.md` (new entity)
- `docs/mapping/reports.md` (new entity)
- `docs/mapping/appointments.md` (new entity)
- `docs/mapping/tasks.md`
- `docs/mapping/messages.md`
- `docs/mapping/attachments.md`

Each should start by listing the fields the minimum mapper covers and explicitly flagging everything else as "stored in `api_payload` only". These are the backlog anchors for bringing mappers up to full field coverage.

Update `docs/mapping/README.md` to list all new files.

Update `docs/implementation/00_PLAN_OVERVIEW.md` to add this doc (29) in the table.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| In-process mapping amplifies webhook-handler latency, risking CW retry storms | Work remains off the HTTP response path (`processEventAsync` is fire-and-forget after the 200 OK). |
| Minimum mappers silently drop CW fields a future consumer needs | `api_payload` / `latestPayload` preserves the full response; mapping docs (§8) are the spec; diff tooling can compare versions via `external_object_versions`. |
| Cascading parent lookups fail (job arrives before claim, appointment before job) | Mappers return `skipped_no_parent` rather than inserting stubs; sweep re-drives when the parent lands. |
| Orchestrator and More0 both run during transition | Route is exclusive per env; the More0 workflow, when it ships, must itself be idempotent against a `completed` event (it already is — tool endpoints use upserts). |
| Partial-writes if `tx` plumbing is missed in any mapper | Step 5 integration test asserts every DB call goes through the provided `tx`. Code review gates this. |

---

## 10. Retirement Plan (when More0 lands)

1. Set `MORE0_ENABLED=true` in non-production, point it at the real registry.
2. Compare `inbound_webhook_events` dashboards: the `route` metadata should flip from `inproc` to `more0` on new events while historical rows stay `inproc`.
3. Once More0 has processed a representative sample (>1 000 events, <0.1% error), flip production.
4. Keep `InProcessProjectionService` and the in-process route in the codebase for 2 release cycles as a fallback. Retire by deleting `WebhookOrchestratorService`, `InProcessProjectionService`, and the feature flags, and reverting `WebhooksService.processEventAsync` to the straight More0 invocation described in doc 27a.

At that point the entity mappers and `EntityMapperRegistry` stay — they're still called by More0 via `/api/v1/tools/mappers/:entityType`.

---

## 11. Implementation Order Summary

| # | Deliverable | File(s) | Depends on |
|---|---|---|---|
| 1 | Config flags (`MORE0_ENABLED`, `WEBHOOK_INPROC_MAPPING_ENABLED`) | `config/more0.config.ts`, `config/env.validation.ts` | — |
| 2 | `WebhookOrchestratorService` scaffold | `modules/webhooks/webhook-orchestrator.service.ts`, `webhooks.module.ts` | 1 |
| 3 | `InProcessProjectionService` | `modules/external/in-process-projection.service.ts`, `external.module.ts` | 2, 4, 5 |
| 4 | `EntityMapperRegistry` | `modules/external/entity-mapper.registry.ts` | — |
| 5 | `tx` parameter across all mappers + `NestedEntityExtractor` | All `mappers/*.mapper.ts`, `nested-entity-extractor.service.ts` | — |
| 6 | Quote, Report, Appointment mappers | `mappers/crunchwork-quote.mapper.ts`, `…-report.mapper.ts`, `…-appointment.mapper.ts` | 4, 5 |
| 7 | Rewire `WebhooksService.processEventAsync` | `modules/webhooks/webhooks.service.ts` | 2, 3 |
| 8 | Sweep service uses orchestrator | `modules/webhooks/webhook-sweep.service.ts` (extend doc 27b) | 2, 3 |
| 9 | Status value catalogue + (optional) CHECK migration | `drizzle/XXXX_processing_status_whitelist.sql`, docs | 7, 8 |
| 10 | Observability (logs, counters, summary endpoint) | `modules/webhooks/*`, `modules/dashboard/*` | 7 |
| 11 | Tests (unit + integration) | `*.spec.ts` across touched files | all above |
| 12 | Mapping doc stubs + `README` / `00_PLAN_OVERVIEW` updates | `docs/mapping/*.md`, `docs/implementation/00_PLAN_OVERVIEW.md` | 6 |

Each row maps to a single PR; the whole plan is deliverable in 12 focused changes with no intermediate broken state — every step leaves the app runnable because the previous in-flight behaviour (More0 mock) is only replaced in step 7, after its replacement is ready.

---

## 12. Acceptance Criteria (whole plan)

- [ ] `MORE0_ENABLED=false` is the production default and `POST /webhooks/crunchwork` successfully drives every event type in §2.2 to `processing_status='completed'` with a row in the correct internal table.
- [ ] All seven existing mappers accept an optional `tx` and use it for every DB call.
- [ ] Quote, Report, Appointment mappers exist, are registered, and are covered by tests.
- [ ] `WebhookOrchestratorService` is the single decision point between More0 and the in-process route; no other file talks to `More0Service` from the webhook path.
- [ ] Sweep service recovers stale events in both `pending` and `fetched` states.
- [ ] Flipping `MORE0_ENABLED=true` in a dev environment reverts the pipeline to the doc 27 design with zero code change.
- [ ] Status value catalogue (§Step 9) is documented and enforced.
- [ ] `docs/mapping/` has a stub for every entity this plan touches.
