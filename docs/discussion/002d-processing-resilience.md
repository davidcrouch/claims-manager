# 002d — Admin Visibility & Audit

**Date:** 2026-03-25 (revised)
**Status:** Implementation Plan
**Parent:** [002 — Master Index](./002-implementation-plan.md)
**Depends on:** [002a](./002a-schema-and-migrations.md), [002b](./002b-webhook-pipeline-refactor.md)

---

## 0. Scope

With More0 handling orchestration, retries, and failure recovery, this sub-plan is **dramatically slimmer** than its original version. It covers:

1. Admin API endpoints for viewing processing status from the claims-manager database.
2. A backfill trigger endpoint that creates More0 workflow invocations for re-processing.
3. Ensuring the More0 workflow steps write to `external_processing_log` and `external_event_attempts` for claims-manager–side observability.

**What is NOT in scope (More0 handles this):**
- Polling workers
- Retry loops with exponential backoff
- Work queue management
- Concurrency guards

---

## 1. What More0 Already Provides

| Concern | More0 Capability |
|---------|-----------------|
| Retry with backoff | Workflow step `retry` config: `maxAttempts`, `backoffRate`, `intervalSeconds` |
| Failure handling | Workflow `catch` blocks route to failure steps |
| Execution history | More0 tracks every workflow run, step status, duration, errors |
| Concurrency | More0 worker pool manages parallel execution |
| Durable state | Workflow engine checkpoints between steps |

Claims-manager does not need to replicate any of this. It only needs:
- A way to **see** what happened (admin endpoints querying local tables).
- A way to **trigger** re-processing (backfill invocations into More0).

---

## 2. Work Items

### 2.1 — Admin Status Endpoints

**File:** `apps/api/src/modules/external/external.controller.ts` **(Create)**

| Method | Path | Purpose |
|--------|------|---------|
| `GET /api/v1/external/processing-log` | List processing log entries with filtering |
| `GET /api/v1/external/processing-log/:id` | Single log entry with event attempts |
| `GET /api/v1/external/objects` | List external objects with filtering |
| `GET /api/v1/external/objects/:id` | Single external object with versions and links |
| `GET /api/v1/external/objects/:id/versions` | Version history for an external object |
| `GET /api/v1/external/links` | List external links with filtering |
| `GET /api/v1/external/events` | List webhook events with processing status |

All endpoints are authenticated (not `@Public`), tenant-scoped.

**Query parameters (where applicable):**
- `status` — filter by processing status
- `providerEntityType` — filter by entity type
- `page`, `limit` — pagination
- `from`, `to` — date range

---

### 2.2 — Backfill Trigger Endpoint

**File:** `apps/api/src/modules/external/external.controller.ts` **(same file)**

| Method | Path | Purpose |
|--------|------|---------|
| `POST /api/v1/external/backfill` | Trigger re-processing for a specific entity |
| `POST /api/v1/external/backfill/bulk` | Trigger re-processing for multiple entities |

#### `POST /api/v1/external/backfill`

**Input:**
```typescript
{
  connectionId: string;
  providerEntityType: string;
  providerEntityId: string;
}
```

**Logic:**
1. Create `external_processing_log` row (action=`backfill`, status=`pending`).
2. Invoke More0 workflow `claims-manager.process-webhook-event` with the entity context and a null `eventId` (backfills have no originating event).
3. Update processing log with `workflowRunId`.
4. Return the processing log entry.

#### `POST /api/v1/external/backfill/bulk`

**Input:**
```typescript
{
  connectionId: string;
  providerEntityType: string;
  providerEntityIds: string[];
}
```

Creates one More0 workflow invocation per entity ID. Returns count of invocations created.

---

### 2.3 — Ensure Workflow Steps Write Audit Data

The More0 workflow's tool endpoints (created in 002b) must write to `external_event_attempts` at the appropriate points. This is handled by the tool endpoint logic, not a separate service.

**In `POST /api/v1/tools/crunchwork/fetch`:**
- Before calling CW API: create `external_event_attempts` row (status=`processing`, startedAt=now).
- On success: update to `succeeded`, set `completedAt`.
- On failure: update to `failed`, set `errorMessage`, `errorStack`, `completedAt`.

> The attempt number comes from the More0 workflow context (More0 tracks which retry attempt it is). If not available from context, default to `1` and rely on More0's execution history for retry tracking.

**In `POST /api/v1/tools/processing-log/complete` and `/fail`:**
- Update the `external_processing_log` row with final status, `completedAt`, and `externalObjectId` (on success) or `errorMessage` (on failure).

---

### 2.4 — Dashboard Summary Endpoint (optional)

**File:** `apps/api/src/modules/external/external.controller.ts` **(same file)**

| Method | Path | Purpose |
|--------|------|---------|
| `GET /api/v1/external/summary` | Processing summary stats |

Returns:
```typescript
{
  totalEvents: number;
  pendingProcessing: number;
  completedProcessing: number;
  failedProcessing: number;
  externalObjectCount: number;
  lastEventAt: string;
}
```

Useful for a dashboard widget showing integration health.

---

## 3. New Files Summary

| # | File (relative to `apps/api/src/`) | Purpose |
|---|-----|---------|
| 1 | `modules/external/external.controller.ts` | Admin status + backfill endpoints |

## 4. Modified Files Summary

| # | File | Change |
|---|------|--------|
| 1 | `modules/external/external.module.ts` | Add controller |
| 2 | `modules/external/tools/external-tools.controller.ts` | Add event attempt writes to fetch tool endpoint |

---

## 5. Test Strategy

| Test | Scope |
|------|-------|
| Admin endpoint integration test | Verify processing log listing, filtering, pagination. |
| Backfill endpoint test | Verify processing log created, More0 workflow invoked, runId stored. |
| Event attempt write test | Verify tool endpoint creates/updates attempt rows on success and failure. |

---

## 6. Estimated Effort

| Item | Estimate |
|------|----------|
| Admin status endpoints (6 routes) | 3 hours |
| Backfill trigger endpoints | 1.5 hours |
| Event attempt writes in tool endpoints | 1 hour |
| Dashboard summary endpoint | 1 hour |
| Module wiring | 30 min |
| Unit/integration tests | 2 hours |
| **Total** | **~1 day** |
