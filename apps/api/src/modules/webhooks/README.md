# Webhook Pipeline — Transaction Boundaries

This document codifies the transactional contracts governing the webhook
ingestion pipeline. All durable state transitions go through PostgreSQL.
More0 handles orchestration; NestJS owns the data layer.

---

## Transaction A — Webhook Receipt + Fetch

**Owner:** `WebhooksService.processEventAsync`

```
1. INSERT inbound_webhook_events       — raw event receipt (own statement)
   COMMIT

2. HTTP call: fetch entity from Crunchwork API (outside any transaction)

3. BEGIN
     UPSERT external_objects           — latest provider snapshot
     INSERT external_object_versions   — if payload hash changed
     INSERT external_processing_log    — status = 'pending'
     UPDATE inbound_webhook_events     — processing_status → 'fetched'
   COMMIT
```

**Crash recovery:** If the process crashes after step 1 but before step 3,
the event has `processing_status = 'pending'` and can be picked up by the
backfill endpoint or a sweep query.

---

## Transaction B — More0 Workflow Invocation

**Owner:** `WebhooksService.processEventAsync` (after Transaction A commits)

```
4. HTTP call: invoke More0 workflow (outside any transaction)

5. UPDATE external_processing_log      — status → 'processing', workflow_run_id set
   UPDATE inbound_webhook_events       — processing_status → 'dispatched'
```

Steps 5 are individual updates (not wrapped in a single transaction).

**Crash recovery:** If workflow invocation fails, the processing log has
`status = 'pending'` and the event has `processing_status = 'fetched'`.
The backfill endpoint can re-trigger the workflow.

---

## Transaction C — Internal Projection (More0 step)

**Owner:** More0 tool endpoint → entity mapper

```
BEGIN
  UPSERT claims / jobs / quotes / …    — internal business records
  UPSERT external_links                 — mapping rows
  UPDATE external_processing_log        — status → 'completed'
COMMIT
```

**Crash recovery:** More0 retries the step. Projection logic must be
idempotent — mappers use upsert semantics keyed on `externalReference`.

---

## Key Invariants

- Webhook receipt and fetch-job creation are **not** atomic (More0 replaces
  the durable job queue). The processing log + backfill endpoint close the
  crash window.
- External object writes and version rows are always in the **same**
  transaction.
- Internal projection writes and external link rows are always in the
  **same** transaction.
- JetStream / NATS are **not** used for correctness — only as optional
  dispatch accelerators after commit.
- More0 owns retry policy, backoff, and execution history. NestJS does
  **not** run its own polling loop.
