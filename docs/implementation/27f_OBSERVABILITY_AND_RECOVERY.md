# 27f — Observability & Recovery

**Date:** 2026-04-09
**Status:** Implementation Plan
**Depends on:** [27b](27b_WEBHOOK_SWEEP_SERVICE.md), [27e](27e_MORE0_WORKFLOW_REFINEMENT.md)

---

## 0. Purpose

Define the monitoring, alerting, dead-letter handling, and manual recovery strategies for the v2 webhook pipeline. The pipeline is designed for automatic recovery via the sweep service and More0 retries — this document covers what to do when automatic recovery is exhausted and how to maintain operational visibility.

---

## 1. Health Metrics

### 1.1 Pipeline Throughput Metrics

Expose these metrics via structured logging (and optionally a `/metrics` Prometheus endpoint):

| Metric | Source | Description |
|--------|--------|-------------|
| `webhook.received.count` | Controller | Total webhook events received (including duplicates) |
| `webhook.persisted.count` | Controller | Events successfully inserted (deduplicated) |
| `webhook.dispatched.count` | `dispatchToMore0` | Events sent to More0 |
| `webhook.dispatch_failed.count` | `dispatchToMore0` | Events where More0 invocation failed |
| `webhook.sweep.run.count` | Sweep service | Sweep cycles executed |
| `webhook.sweep.redispatched.count` | Sweep service | Events re-dispatched by sweep |
| `webhook.completed.count` | Processing log | Events fully processed (status = completed) |
| `webhook.failed.count` | Processing log | Events that exhausted retries |

### 1.2 Pipeline Lag Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `webhook.pending.age_max_seconds` | Age of oldest event at `pending` status | > 120s |
| `webhook.pending.count` | Count of events at `pending` | > 100 |
| `webhook.dispatched.age_max_seconds` | Age of oldest event at `dispatched` | > 300s |
| `webhook.failed.count_24h` | Failed events in last 24 hours | > 10 |
| `webhook.sweep.stale_count` | Events found per sweep cycle | > 20 (sustained) |

### 1.3 How to Collect

Add a scheduled metrics reporter (every 60s) that runs summary queries:

```typescript
@Injectable()
export class WebhookMetricsService {
  private readonly logger = new Logger('WebhookMetricsService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Interval(60_000)
  async reportMetrics(): Promise<void> {
    const logPrefix = 'WebhookMetricsService.reportMetrics';

    const result = await this.db.execute(sql`
      SELECT
        processing_status,
        COUNT(*)::int AS count,
        EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::int AS oldest_age_seconds
      FROM inbound_webhook_events
      WHERE processing_status IN ('pending', 'dispatched', 'fetched')
      GROUP BY processing_status
    `);

    for (const row of result.rows ?? []) {
      this.logger.log(
        `${logPrefix} — status=${row.processing_status} count=${row.count} oldest_age=${row.oldest_age_seconds}s`,
      );
    }

    const failedResult = await this.db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM inbound_webhook_events
      WHERE processing_status IN ('fetch_failed', 'projection_failed', 'upsert_failed')
        AND updated_at > NOW() - INTERVAL '24 hours'
    `);

    const failedCount = failedResult.rows?.[0]?.count ?? 0;
    if (failedCount > 0) {
      this.logger.warn(
        `${logPrefix} — ${failedCount} failed events in last 24h`,
      );
    }
  }
}
```

---

## 2. Alerting Rules

### 2.1 Critical Alerts (Page)

| Condition | Action |
|-----------|--------|
| `webhook.pending.count > 100` sustained for 5 min | More0 likely down or unreachable. Check More0 service health. |
| `webhook.pending.age_max_seconds > 300` | Sweep not running or More0 rejecting all invocations. Check sweep logs and More0 API. |
| `webhook.failed.count_24h > 50` | Systematic failure. Check CW API health, mapper errors, DB connectivity. |

### 2.2 Warning Alerts (Notify)

| Condition | Action |
|-----------|--------|
| `webhook.sweep.stale_count > 10` sustained for 5 min | Elevated failure rate. Review More0 workflow runs for error patterns. |
| `webhook.dispatched.age_max_seconds > 600` | Workflow running but slow or stuck. Check More0 execution history. |
| Any event with `retry_count >= 8` | Approaching retry cap. Manual review recommended before event is abandoned. |

---

## 3. Dead-Letter Handling

### 3.1 Definition

An event is considered **dead-lettered** when:

- `retry_count >= 10` (sweep exhausted), **or**
- `processing_status` is `fetch_failed`, `upsert_failed`, or `projection_failed` (More0 workflow exhausted retries and routed to a failure state)

### 3.2 Dead-Letter Query

```sql
SELECT
  id, external_event_id, event_type, processing_status,
  processing_error, retry_count, created_at, updated_at
FROM inbound_webhook_events
WHERE (
  retry_count >= 10
  OR processing_status IN ('fetch_failed', 'upsert_failed', 'projection_failed')
)
ORDER BY created_at DESC;
```

### 3.3 Dead-Letter Admin Endpoint

Add an admin endpoint for viewing and replaying dead-lettered events:

```
GET  /api/v1/admin/webhook-events/dead-letter    — list dead-lettered events
POST /api/v1/admin/webhook-events/:id/replay     — reset status to 'pending', zero retry_count
POST /api/v1/admin/webhook-events/replay-all     — replay all dead-lettered events
```

**Replay logic:**

```typescript
async replayEvent(params: { eventId: string }): Promise<void> {
  await this.webhookRepo.update({
    id: params.eventId,
    data: {
      processingStatus: 'pending',
      retryCount: 0,
      processingError: null,
    },
  });
  // Sweep will pick it up on next cycle
}
```

Replay resets the event to `pending` with `retry_count = 0`. The sweep service picks it up on the next cycle. This is safer than directly invoking More0 from the admin endpoint because it goes through the normal pipeline.

### 3.4 Bulk Replay with Filters

```
POST /api/v1/admin/webhook-events/replay-all
Body: {
  "status": "fetch_failed",       // optional: filter by specific failure status
  "olderThan": "2026-04-08",      // optional: only events before this date
  "eventType": "NEW_JOB",         // optional: filter by event type
  "limit": 100                    // optional: max events to replay
}
```

---

## 4. Diagnostic Endpoints

### 4.1 Pipeline Status Dashboard

```
GET /api/v1/admin/webhook-pipeline/status
```

Returns:

```json
{
  "summary": {
    "pending": 3,
    "dispatched": 12,
    "fetched": 2,
    "completed_24h": 847,
    "failed_24h": 1,
    "dead_lettered": 0
  },
  "oldest_pending": {
    "id": "...",
    "event_type": "NEW_JOB",
    "age_seconds": 45,
    "retry_count": 2
  },
  "sweep": {
    "enabled": true,
    "interval_ms": 30000,
    "last_run": "2026-04-09T10:30:00Z",
    "last_stale_count": 0
  },
  "more0": {
    "mode": "live",
    "registry_url": "http://more0:3200",
    "last_invocation": "2026-04-09T10:29:55Z",
    "last_invocation_status": "success"
  }
}
```

### 4.2 Event Detail

The existing `GET /api/v1/external/events/:id` endpoint should be enhanced to show the full processing history:

```json
{
  "event": { /* inbound_webhook_events row */ },
  "processingLogs": [ /* all processing_log entries for this event */ ],
  "externalObject": { /* if created */ },
  "externalObjectVersions": [ /* version history */ ],
  "externalLinks": [ /* mappings to internal entities */ ],
  "internalEntities": {
    "claim": { "id": "...", "claimNumber": "CLM-001" },
    "job": { "id": "...", "externalReference": "..." }
  }
}
```

---

## 5. Structured Logging Standards

All pipeline components must use consistent structured log fields:

```typescript
this.logger.log(
  `WebhooksService.dispatchToMore0 — dispatched event ${eventId} as More0 run ${runId}`,
);
```

**Required fields in log messages:**

| Field | Example | Purpose |
|-------|---------|---------|
| Component.method prefix | `WebhookSweepService.sweep` | Trace source |
| `eventId` | `event abc-123` | Correlate across pipeline steps |
| `runId` | `More0 run xyz-789` | Correlate with More0 execution history |
| Status transition | `pending → dispatched` | Track progress |
| Error detail | `CW fetch failed: 503 Service Unavailable` | Debug failures |

**Log levels:**

| Level | Usage |
|-------|-------|
| `log` | Normal pipeline operations (received, dispatched, completed) |
| `warn` | Recoverable issues (dispatch failed, unknown event type, sweep found stale events) |
| `error` | Unrecoverable errors (unexpected exceptions, DB connection failures) |
| `debug` | Detailed state (payload hashes, version numbers, mapper decisions) |

---

## 6. Manual Recovery Runbook

### 6.1 More0 is Down

**Symptoms:** `pending` count rising, sweep logs show repeated dispatch failures.

**Steps:**
1. Check More0 service health: `curl http://more0:3200/health`
2. Check More0 API key is configured: verify `MORE0_API_KEY` env var
3. If More0 is recovering, wait — sweep will automatically re-dispatch once More0 is back
4. If More0 will be down for extended period, events accumulate safely at `pending`. No data is lost.

### 6.2 Crunchwork API is Down

**Symptoms:** Events dispatched to More0 but workflow fails at `fetch-external-entity`. Processing logs show `fetch_failed`.

**Steps:**
1. Check CW API health via the connection's base URL
2. More0 retries 3x with backoff (30s, 60s, 120s) — total ~3.5 minutes of retry window
3. If CW is down longer, events land at `fetch_failed`
4. Once CW recovers, use bulk replay: `POST /api/v1/admin/webhook-events/replay-all { "status": "fetch_failed" }`

### 6.3 Mapper Errors

**Symptoms:** Events at `projection_failed`. External objects exist but internal records were not created.

**Steps:**
1. Check processing logs for error messages: `GET /api/v1/external/processing-log?status=failed`
2. Common causes: missing required fields in payload, FK constraint violations (e.g. claim not yet created when job arrives)
3. Fix the mapper code if it's a bug
4. Replay: `POST /api/v1/admin/webhook-events/replay-all { "status": "projection_failed" }`
5. For ordering issues (job before claim), the `NestedEntityExtractor` should auto-create the claim. If it didn't, check the job payload for embedded claim data.

### 6.4 Duplicate Internal Records

**Symptoms:** Two internal records (e.g. two claims) for the same external entity.

**Steps:**
1. Query `external_links` for the external object ID — there should be exactly one link per entity type
2. If duplicates exist, the unique constraint on `external_links(external_object_id, internal_entity_type)` was not enforced (check schema)
3. Manually merge or delete the duplicate, keeping the one linked in `external_links`

### 6.5 Full Pipeline Reset (Nuclear Option)

If the pipeline is in an inconsistent state and you need to reprocess everything:

```sql
-- Reset all non-completed events to pending
UPDATE inbound_webhook_events
SET processing_status = 'pending',
    retry_count = 0,
    processing_error = NULL,
    updated_at = NOW()
WHERE processing_status NOT IN ('completed', 'unrecognized');
```

The sweep will pick them all up (50 per cycle, so a backlog of 500 events takes ~5 minutes to fully dispatch).

---

## 7. File Changes Summary

| File | Change |
|------|--------|
| `src/modules/webhooks/webhook-metrics.service.ts` | **NEW** — periodic metrics reporter |
| `src/modules/admin/admin.controller.ts` | **NEW** or **MODIFIED** — dead-letter endpoints |
| `src/modules/admin/admin.module.ts` | **NEW** or **MODIFIED** — admin module registration |
| `src/modules/external/external.controller.ts` | Enhanced event detail endpoint |
| `src/modules/webhooks/webhooks.module.ts` | Register `WebhookMetricsService` |

---

## Acceptance Criteria

- [ ] `WebhookMetricsService` reports pipeline counts and ages every 60s
- [ ] Structured log messages follow the component.method prefix convention
- [ ] Dead-letter query identifies events with exhausted retries or terminal failure statuses
- [ ] `GET /api/v1/admin/webhook-events/dead-letter` returns dead-lettered events
- [ ] `POST /api/v1/admin/webhook-events/:id/replay` resets event to `pending`
- [ ] `POST /api/v1/admin/webhook-events/replay-all` supports status/date/type filters
- [ ] `GET /api/v1/admin/webhook-pipeline/status` returns summary dashboard data
- [ ] Admin endpoints are auth-protected (require admin role)
- [ ] Event detail endpoint shows full processing history chain
- [ ] Runbook covers More0 down, CW down, mapper errors, duplicates, and full reset
