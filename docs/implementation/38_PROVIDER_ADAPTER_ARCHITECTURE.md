# 38 — Provider Adapter Architecture (Async Outbound)

**Date:** 2026-06-21
**Status:** Implemented
**Depends on:** Provider Registry (plan 30), Domain Layer Architecture (plan 35), Jobs Module (plan 09), Outbound Sync (plan 35f)

---

## Objective

Decouple the Jobs (and future entity) service layer from hardcoded Crunchwork dependency using a **full-async outbound pattern**: services write domain data locally, then enqueue to `outbound_sync_queue`. The existing `OutboundWorkerService` dispatches to provider adapters asynchronously and patches back external references on success.

This supports:

- **Crunchwork** — existing external API proxy, pushed asynchronously via outbound worker
- **Direct** — local-only job creation with no external API call, no enqueue
- **Future providers** — new integrations slot in by implementing the `OutboundAdapter` interface and registering in the worker

---

## Context

### Previous Design (Superseded)

The original plan 38 proposed synchronous in-process adapters (`JobProviderAdapter` interface + `CrunchworkJobAdapter` + `DirectJobAdapter` + `JobAdapterRegistry`). This was replaced with the async pattern because:

1. **All outbound pushes are notifications/submissions** — CW is the destination, not the source of truth for locally-created entities
2. **Provider outages shouldn't block users** — jobs, tasks, appointments, quotes should always be creatable locally
3. **The outbound queue infrastructure already existed** (plan 35f) — no need for a parallel dispatch mechanism
4. **Simpler architecture** — one adapter registry in the worker, not two (sync + async)

### Current State

- [`outbound-sync.service.ts`](../../apps/api/src/modules/domain/outbound/outbound-sync.service.ts) — enqueue to `outbound_sync_queue` within a transaction
- [`outbound-worker.service.ts`](../../apps/api/src/modules/domain/outbound/outbound-worker.service.ts) — polls, claims, dispatches to adapter, patches entity on success
- [`outbound-adapter.interface.ts`](../../apps/api/src/modules/domain/outbound/outbound-adapter.interface.ts) — `OutboundAdapter` interface with `OutboundPushResult` return type
- [`crunchwork-outbound.adapter.ts`](../../apps/api/src/modules/domain/outbound/adapters/crunchwork-outbound.adapter.ts) — handles all entity types including job `create`
- [`provider-registry.ts`](../../apps/api/src/modules/providers/provider-registry.ts) — includes `direct` provider entry
- The `jobs` table has `sync_status` column: `null` | `'pending'` | `'synced'` | `'failed'`

---

## Architecture

```
                        ┌─────────────────────────┐
                        │    JobsController        │
                        │  POST /jobs              │
                        │  POST /jobs/:id          │
                        └───────────┬─────────────┘
                                    │
                        ┌───────────▼─────────────┐
                        │     JobsService          │
                        │  resolves providerCode   │
                        │  writes locally          │
                        │  enqueues if needed      │
                        └───────────┬─────────────┘
                                    │
                        ┌───────────▼─────────────┐
                        │    DB Transaction        │
                        │  1. INSERT jobs          │
                        │  2. INSERT outbound_sync │
                        │     (if providerCode     │
                        │      !== 'direct')       │
                        └───────────┬─────────────┘
                                    │
                                    │ (async, polled)
                                    │
                        ┌───────────▼─────────────┐
                        │  OutboundWorkerService   │
                        │  poll → claim → dispatch │
                        └───────────┬─────────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                                  │
         ┌─────────▼──────────┐             ┌────────▼─────────┐
         │CrunchworkOutbound  │             │ FutureOutbound    │
         │Adapter             │             │ Adapter           │
         │(calls CW API,      │             │(new provider)     │
         │ returns extRef)    │             │                   │
         └─────────┬──────────┘             └──────────────────┘
                   │
                   ▼
         ┌───────────────────┐
         │  Patch-back       │
         │  externalReference│
         │  syncStatus=synced│
         └───────────────────┘
```

---

## Data Flow: Create Job

### External Provider (Crunchwork)

1. `POST /jobs` → `JobsService.create()`
2. Resolves provider via `ConnectionResolverService` → `{ providerCode: 'crunchwork', connectionId }`
3. **Transaction:**
   - INSERT into `jobs` with `syncStatus = 'pending'`, `externalReference = null`
   - INSERT into `outbound_sync_queue` with `action = 'create'`, `idempotencyKey = 'create:job:{id}'`
4. Return job immediately to user (with `syncStatus: 'pending'`)
5. **Worker (async):** polls → claims row → `CrunchworkOutboundAdapter.push()` → CW API `POST /jobs`
6. On success: patches `jobs.external_reference`, `jobs.sync_status = 'synced'`, `jobs.api_payload`
7. On failure (retries exhausted): sets `jobs.sync_status = 'failed'`

### Direct Provider

1. `POST /jobs?provider=direct` → `JobsService.create()`
2. Resolves provider → `{ providerCode: 'direct', connectionId: tenantId }`
3. INSERT into `jobs` with `syncStatus = null` — no enqueue
4. Return job immediately

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/modules/jobs/jobs.service.ts` | Write locally + enqueue |
| `apps/api/src/modules/jobs/jobs.controller.ts` | `?provider` query param |
| `apps/api/src/modules/jobs/jobs.module.ts` | Imports OutboundModule + ExternalModule |
| `apps/api/src/modules/jobs/dto/create-job.dto.ts` | Local validation DTO for direct |
| `apps/api/src/modules/domain/outbound/outbound-adapter.interface.ts` | `OutboundAdapter` + `OutboundPushResult` |
| `apps/api/src/modules/domain/outbound/outbound-worker.service.ts` | Poll + dispatch + patch-back |
| `apps/api/src/modules/domain/outbound/outbound-sync.service.ts` | Transactional enqueue |
| `apps/api/src/modules/domain/outbound/adapters/crunchwork-outbound.adapter.ts` | CW API calls |
| `apps/api/src/modules/providers/provider-registry.ts` | `direct` + `crunchwork` entries |
| `apps/api/src/database/schema/index.ts` | `syncStatus` column on jobs |

---

## sync_status Lifecycle

| Value | Meaning |
|-------|---------|
| `null` | No sync needed (direct provider, or inbound-created jobs from webhooks) |
| `'pending'` | Enqueued for outbound push |
| `'synced'` | Successfully pushed, externalReference populated |
| `'failed'` | Exhausted retries, needs user attention |

---

## Adding a New Provider

1. Add entry to `PROVIDER_REGISTRY` in `provider-registry.ts`
2. Implement `OutboundAdapter` interface (handle relevant entity types)
3. Register in `OutboundModule.onModuleInit()` via `worker.registerAdapter()`
4. No service-layer or controller changes needed

---

## Entity Lifecycle Patterns

Once proven on jobs, the same pattern applies to all outbound entities:

- **Quotes/Invoices:** User drafts locally (`syncStatus = null`) then explicitly "submits" (`syncStatus = 'pending'`, enqueue). Natural two-phase.
- **Tasks/Appointments:** Created with `syncStatus = 'pending'`, enqueued immediately. Informational push.
- **Direct provider:** `syncStatus` stays `null`, no enqueue. Purely local.

---

## Acceptance Criteria

- [x] `POST /jobs` with a Crunchwork connection stores locally and enqueues (does not block on CW API)
- [x] `POST /jobs` with a "direct" connection stores the job locally without enqueue
- [x] Direct jobs have `externalReference = NULL`, `syncStatus = NULL`
- [x] Outbound worker pushes to CW and patches back `externalReference` + `syncStatus = 'synced'`
- [x] Failed pushes (retries exhausted) set `syncStatus = 'failed'`
- [x] Adding a new provider requires: (1) registry entry, (2) outbound adapter, (3) register in worker — no service changes
- [x] Existing webhook → mapper → projection pipeline is unaffected (inbound flow unchanged)
- [x] `OutboundAdapter.push()` returns `OutboundPushResult` with optional `externalReference`

---

## Future Considerations

- **Frontend sync status UX:** Badge/indicator for pending/synced/failed states; "Failed syncs" admin view
- **Circuit breaker:** After N consecutive CW failures, fast-path to async (skip timeout penalty)
- **Generalize sync_status:** Add to quotes, invoices, tasks tables when those services adopt the pattern
- **Idempotency unique index:** Add `UNIQUE(idempotency_key)` to `outbound_sync_queue` to make `onConflictDoNothing()` effective
- **Multi-provider tenants:** Routing rules to select provider per entity type or business rule
