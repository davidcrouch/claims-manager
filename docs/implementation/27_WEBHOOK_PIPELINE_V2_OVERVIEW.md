# 27 — Webhook Pipeline v2: More0-Orchestrated Processing

**Date:** 2026-04-09
**Status:** Implementation Plan
**Depends on:** [19](19_WEBHOOKS_MODULE.md) (landed), [26](26_INTEGRATION_SCHEMA_HARDENING.md) (landed)
**Origin:** Design discussion on transaction safety, queue strategy, and More0 integration for zero-data-loss webhook processing.

---

## 0. Purpose

Evolve the webhook ingestion pipeline from a fire-and-forget model to a **More0-orchestrated, transactionally safe** architecture. The v1 pipeline (doc 19) processes events inline within the NestJS process. This v2 design moves the heavy lifting — external fetch, external object storage, and internal projection — into a More0 ASL workflow, with a PostgreSQL-based outbox sweep as a durability safety net.

**Goals:**

1. **Zero data loss** — every persisted webhook event reaches completion or is retried automatically.
2. **Clear transaction boundaries** — each durable state transition is atomic and documented.
3. **More0 as orchestrator** — retry, backoff, step routing, and execution history are owned by the workflow engine.
4. **Minimal NestJS responsibility** — the API persists the event, dispatches to More0, and provides tool endpoints. It does not run long processing chains in-process.

---

## 1. Architecture Overview

```
                                    ┌─────────────────────────────────────────────┐
  Crunchwork                        │              NestJS API                     │
  ───────────                       │                                             │
  POST /webhooks/crunchwork ──────▶ │  Controller                                │
                                    │    ├─ deduplicate (external_event_id)       │
                                    │    ├─ INSERT event (status = 'pending')     │
                                    │    ├─ try: invokeWorkflow ──────────────────┼──▶ More0
                                    │    │    success → status = 'dispatched'     │
                                    │    │    fail    → stays 'pending'           │
                                    │    └─ return 200 OK                         │
                                    │                                             │
                                    │  Sweep Timer (@Interval 30s)               │
                                    │    ├─ SELECT pending/fetched > 30s old      │
                                    │    │  FOR UPDATE SKIP LOCKED                │
                                    │    └─ invokeWorkflow for each ──────────────┼──▶ More0
                                    │                                             │
                                    │  Tool Endpoints (called BY More0)          │
                                    │    ├─ crunchwork-fetch                      │
                                    │    ├─ external-object-upsert               │
                                    │    ├─ entity-mapper                        │
                                    │    └─ processing-log-update                │
                                    └─────────────────────────────────────────────┘

                                    ┌─────────────────────────────────────────────┐
                                    │              More0 Workflow Engine          │
                                    │                                             │
                                    │  process-webhook-event (ASL)               │
                                    │    ├─ fetch-external-entity                │
                                    │    │    Retry: 3x, 30s base, 2x backoff   │
                                    │    ├─ upsert-external-object               │
                                    │    ├─ project-to-internal                  │
                                    │    ├─ mark-completed                       │
                                    │    └─ (on error) mark-failed              │
                                    └─────────────────────────────────────────────┘
```

---

## 2. Data Flow — Step by Step

| Step | Actor | Action | Transaction | On Failure |
|------|-------|--------|-------------|------------|
| 1 | Controller | Deduplicate by `external_event_id` | Read | Return 200 (already received) |
| 2 | Controller | Resolve connection, verify HMAC | Read | Persist anyway (unresolved) |
| 3 | Controller | `INSERT inbound_webhook_events` (status = `pending`) | **TX-1** | Return 500 (CW will retry) |
| 4 | Controller | Return `200 OK` | — | — |
| 5 | Controller | `More0Service.invokeWorkflow` (fire-and-forget) | HTTP call | Event stays `pending`; sweep recovers |
| 6 | Controller | Update status → `dispatched` | Single UPDATE | If fails, sweep recovers |
| 7 | More0 | Call `crunchwork-fetch` tool endpoint | HTTP call | More0 retries (3x, backoff) |
| 8 | More0 | Call `external-object-upsert` tool endpoint | **TX-2** | More0 retries |
| 9 | More0 | Call `entity-mapper` tool endpoint | **TX-3** | More0 retries |
| 10 | More0 | Call `processing-log-update` (status = `completed`) | Single UPDATE | More0 retries |

---

## 3. Transaction Boundaries

### TX-1: Webhook Receipt

**Owner:** `WebhooksController`
**Scope:** Single INSERT

```
INSERT INTO inbound_webhook_events (
  external_event_id, event_type, event_timestamp,
  payload_entity_id, raw_body_json, raw_body_text,
  processing_status = 'pending', ...
)
```

The event is now durable. The HTTP response (200) is sent. Everything after this point is recoverable.

### TX-2: External Object Storage

**Owner:** More0 tool endpoint `external-object-upsert`
**Scope:** Atomic transaction

```
BEGIN
  UPSERT external_objects        (latest_payload, payload_hash, fetch_status)
  INSERT external_object_versions (if payload hash changed)
  INSERT external_processing_log  (status = 'pending')
  UPDATE inbound_webhook_events   (processing_status → 'fetched')
COMMIT
```

If this transaction fails, More0 retries the step. The event remains at `pending` or `dispatched` and the sweep will re-dispatch if More0 itself has issues.

### TX-3: Internal Projection

**Owner:** More0 tool endpoint `entity-mapper`
**Scope:** Atomic transaction

```
BEGIN
  UPSERT claims / jobs / quotes / ...  (keyed on external reference)
  UPSERT external_links                (mapping external → internal IDs)
  UPDATE external_processing_log       (status → 'completed')
COMMIT
```

Idempotent by design — mappers use upsert semantics so replays are safe.

---

## 4. Crash Recovery Matrix

| Failure Point | Event Status | Recovery Mechanism |
|---|---|---|
| Process crash before INSERT (step 3) | No record | Crunchwork retries the webhook |
| Process crash after INSERT, before More0 call | `pending` | Sweep timer picks up after 30s |
| More0 unreachable | `pending` | Sweep timer retries every 30s |
| More0 accepts but CW fetch fails (step 7) | `dispatched` | More0 ASL retries 3x with backoff |
| More0 CW fetch exhausts retries | `dispatched` | ASL routes to `mark-failed`; manual backfill or re-dispatch |
| External object upsert fails (step 8) | `dispatched` | More0 ASL retries |
| Entity mapper fails (step 9) | `fetched` | More0 ASL retries; processing log shows last good step |
| More0 workflow engine down entirely | `pending` or `dispatched` | Sweep timer retries; admin alerts on age threshold |

---

## 5. What Changes from v1

| Aspect | v1 (Current) | v2 (This Plan) |
|--------|-------------|----------------|
| CW fetch location | `processEventAsync` in NestJS | More0 workflow step (`fetch-external-entity`) |
| External object upsert | `processEventAsync` in NestJS (in-process TX) | More0 workflow step (`upsert-external-object`) via tool endpoint |
| Internal projection | More0 workflow step | More0 workflow step (unchanged) |
| Retry for CW fetch | None (single attempt, `fetch_failed` on error) | More0 ASL retry: 3x, 30s base, 2x backoff |
| Crash recovery | Manual backfill endpoint only | Automatic sweep timer + backfill endpoint |
| `processEventAsync` | CW fetch + TX + More0 invoke | More0 invoke only (thin dispatcher) |
| Fire-and-forget gap | ~seconds between INSERT and More0 call, no recovery | Sweep closes the gap automatically |

---

## 6. Sub-Plans

| # | Document | Title | Scope |
|---|----------|-------|-------|
| 27a | `27a_WEBHOOK_RECEIPT_SIMPLIFICATION.md` | Webhook Receipt Simplification | Slim down controller and service to persist + dispatch |
| 27b | `27b_WEBHOOK_SWEEP_SERVICE.md` | Webhook Sweep Service | Outbox poller for automatic crash recovery |
| 27c | `27c_MORE0_TOOL_ENDPOINTS.md` | More0 Tool Endpoints | Callback API that More0 workflow steps invoke |
| 27d | `27d_ENTITY_MAPPER_SERVICE.md` | Entity Mapper Service | Projection logic from external objects to internal tables |
| 27e | `27e_MORE0_WORKFLOW_REFINEMENT.md` | More0 Workflow Refinement | Updated ASL definition and capability registration |
| 27f | `27f_OBSERVABILITY_AND_RECOVERY.md` | Observability & Recovery | Monitoring, alerting, dead-letter handling, runbook |

---

## 7. Implementation Order

The sub-plans should be implemented in this sequence due to dependencies:

```
27a (receipt simplification)
 └──▶ 27b (sweep service) — depends on simplified receipt
       └──▶ 27c (tool endpoints) — More0 needs these to call back
             └──▶ 27d (entity mapper) — the projection tool endpoint
                   └──▶ 27e (workflow ASL) — wires everything together
                         └──▶ 27f (observability) — monitoring layer on top
```

Each sub-plan can be developed and tested independently against mock mode, but the full end-to-end flow requires all pieces in place.

---

## 8. Key Design Decisions

**Why not BullMQ?**
More0 already provides retry, backoff, step orchestration, and execution history. Adding BullMQ would create two competing retry layers and add Redis as a hard infrastructure dependency. The PostgreSQL outbox (sweep) provides the same durability guarantee without new infrastructure.

**Why not pure outbox (no More0)?**
The outbox pattern alone would require building retry logic, step routing, error handling, and execution history in NestJS — all of which More0 provides natively. The outbox serves only as a safety net for the dispatch step.

**Why fire-and-forget from the controller?**
The webhook sender (Crunchwork) expects a fast 200 response. Any processing delay risks timeout and retry storms. The INSERT is the only synchronous work; everything else is async.

**Why `FOR UPDATE SKIP LOCKED` in the sweep?**
Multiple API replicas may run the sweep concurrently. `SKIP LOCKED` ensures each event is picked up by exactly one replica without blocking.
