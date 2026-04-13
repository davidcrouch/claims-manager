# 27b — Webhook Sweep Service

**Date:** 2026-04-09
**Status:** Implementation Plan
**Depends on:** [27a](27a_WEBHOOK_RECEIPT_SIMPLIFICATION.md)

---

## 0. Purpose

Implement a lightweight polling service that automatically recovers webhook events stuck at `pending` or `dispatched` due to process crashes, More0 unavailability, or transient errors. This is the **safety net** that closes the durability gap between the INSERT (TX-1) and More0 workflow invocation.

---

## 1. Module Structure

```
src/modules/webhooks/
├── ...existing files...
├── webhook-sweep.service.ts       ← NEW
└── webhook-sweep.service.spec.ts  ← NEW
```

The sweep service is registered in the existing `WebhooksModule` — no new module needed.

---

## 2. Sweep Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { inboundWebhookEvents } from '../../database/schema';
import { More0Service } from '../../more0/more0.service';
import { and, lt, inArray, sql } from 'drizzle-orm';

@Injectable()
export class WebhookSweepService {
  private readonly logger = new Logger('WebhookSweepService');
  private sweeping = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly more0Service: More0Service,
  ) {}

  @Interval(30_000)
  async sweep(): Promise<void> {
    if (this.sweeping) {
      return; // previous sweep still running
    }

    this.sweeping = true;
    const logPrefix = 'WebhookSweepService.sweep';

    try {
      const staleThreshold = new Date(Date.now() - 30_000); // 30 seconds ago

      const staleEvents = await this.db.execute(sql`
        SELECT id, event_type, payload_entity_id, payload_tenant_id,
               connection_id, provider_id, processing_status, event_timestamp
        FROM inbound_webhook_events
        WHERE processing_status IN ('pending', 'dispatched')
          AND connection_id IS NOT NULL
          AND hmac_verified = true
          AND created_at < ${staleThreshold}
          AND retry_count < 10
        ORDER BY created_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `);

      if (!staleEvents.rows?.length) {
        return;
      }

      this.logger.log(
        `${logPrefix} — found ${staleEvents.rows.length} stale events to re-dispatch`,
      );

      for (const row of staleEvents.rows) {
        await this.redispatch({ event: row });
      }
    } catch (error) {
      this.logger.error(
        `${logPrefix} — sweep failed: ${(error as Error).message}`,
      );
    } finally {
      this.sweeping = false;
    }
  }

  private async redispatch(params: { event: any }): Promise<void> {
    const logPrefix = 'WebhookSweepService.redispatch';
    const event = params.event;

    try {
      const entityType = this.resolveEntityType(event.event_type);
      if (!entityType) {
        return;
      }

      const { runId } = await this.more0Service.invokeWorkflow({
        workflowName: 'process-webhook-event',
        input: {
          eventId: event.id,
          tenantId: event.payload_tenant_id,
          connectionId: event.connection_id,
          providerId: event.provider_id,
          eventType: event.event_type,
          providerEntityType: entityType,
          providerEntityId: event.payload_entity_id,
          eventTimestamp: event.event_timestamp,
          isRetry: true,
        },
        context: { tenantId: event.payload_tenant_id },
      });

      await this.db.execute(sql`
        UPDATE inbound_webhook_events
        SET processing_status = 'dispatched',
            retry_count = retry_count + 1,
            updated_at = NOW()
        WHERE id = ${event.id}
      `);

      this.logger.log(
        `${logPrefix} — re-dispatched event ${event.id} as More0 run ${runId} (retry #${event.retry_count + 1})`,
      );
    } catch (error) {
      this.logger.warn(
        `${logPrefix} — failed to re-dispatch event ${event.id}: ${(error as Error).message}`,
      );

      await this.db.execute(sql`
        UPDATE inbound_webhook_events
        SET retry_count = retry_count + 1,
            updated_at = NOW()
        WHERE id = ${event.id}
      `);
    }
  }

  private resolveEntityType(eventType: string): string | null {
    // Reuse same mapping as WebhooksService / ExternalToolsController
    const map: Record<string, string> = {
      NEW_JOB: 'job', UPDATE_JOB: 'job',
      NEW_QUOTE: 'quote',
      NEW_PURCHASE_ORDER: 'purchaseOrder', UPDATE_PURCHASE_ORDER: 'purchaseOrder',
      NEW_INVOICE: 'invoice', UPDATE_INVOICE: 'invoice',
      NEW_MESSAGE: 'message',
      NEW_TASK: 'task', UPDATE_TASK: 'task',
      NEW_REPORT: 'report',
      NEW_ATTACHMENT: 'attachment', UPDATE_ATTACHMENT: 'attachment',
    };
    return map[eventType] ?? null;
  }
}
```

---

## 3. Design Decisions

### 3.1 Polling Interval: 30 seconds

A 30-second interval balances latency against database load. Under normal operation, events are dispatched inline by the controller within milliseconds — the sweep only fires for events that missed the inline dispatch. The interval is configurable via environment variable if needed.

### 3.2 Stale Threshold: 30 seconds

Events younger than 30 seconds are skipped. This avoids racing with the controller's inline dispatch — if the controller is about to dispatch the event, the sweep should not duplicate it. More0's deduplication (by `eventId` in the workflow input) provides a second layer of protection.

### 3.3 `FOR UPDATE SKIP LOCKED`

This is the critical concurrency primitive. If multiple API replicas run the sweep simultaneously:

- `FOR UPDATE` locks the selected rows so no other replica can select the same events.
- `SKIP LOCKED` skips rows already locked by another replica instead of waiting.

This gives safe, non-blocking, at-most-once-per-sweep-cycle dispatch without coordination.

### 3.4 Retry Cap: 10 attempts

Events that fail dispatch 10 times are left at `pending` or `dispatched` with `retry_count = 10`. The observability layer (doc 27f) will alert on these. Manual intervention via the backfill endpoint can re-trigger them.

### 3.5 Batch Size: 50

Limits the number of events processed per sweep cycle to avoid long-running transactions and excessive More0 invocations. Under burst conditions, the sweep processes 50 events per cycle (100/minute), with the remainder picked up in subsequent cycles.

### 3.6 Re-entrancy Guard

The `sweeping` boolean prevents overlapping sweep cycles. If a sweep takes longer than 30 seconds (e.g., More0 is slow to respond), the next interval is skipped. This is a simple in-process guard — acceptable because `SKIP LOCKED` handles cross-replica safety.

### 3.7 `dispatched` Re-dispatch

Events at `dispatched` status are included in the sweep. This handles the case where More0 accepted the workflow invocation but then failed before completing any steps — the event is "dispatched" but nothing happened. Re-dispatching is safe because:

- More0 tracks workflow runs by `eventId` and can deduplicate.
- The tool endpoints use idempotent operations (upserts).
- The `isRetry: true` flag in the input lets the workflow distinguish first-run from retry if needed.

---

## 4. Schema Prerequisite

The `retry_count` column already exists on `inbound_webhook_events` (added in the initial migration). If it does not have a default value, add one:

```sql
ALTER TABLE inbound_webhook_events
  ALTER COLUMN retry_count SET DEFAULT 0;
```

---

## 5. NestJS Schedule Module

The `@Interval` decorator requires `@nestjs/schedule`. Verify it is installed and `ScheduleModule.forRoot()` is imported in `AppModule`:

```typescript
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ...
  ],
})
export class AppModule {}
```

If not already present, add `@nestjs/schedule` to `apps/api/package.json`.

---

## 6. Configuration

| Env Variable | Default | Description |
|---|---|---|
| `WEBHOOK_SWEEP_INTERVAL_MS` | `30000` | Polling interval in milliseconds |
| `WEBHOOK_SWEEP_STALE_THRESHOLD_MS` | `30000` | Minimum age before an event is considered stale |
| `WEBHOOK_SWEEP_BATCH_SIZE` | `50` | Max events per sweep cycle |
| `WEBHOOK_SWEEP_MAX_RETRIES` | `10` | Max dispatch attempts before giving up |
| `WEBHOOK_SWEEP_ENABLED` | `true` | Kill switch — set to `false` to disable sweep |

These are read via `ConfigService` and can be overridden per environment. The sweep should be disabled in test environments to avoid interfering with test isolation.

---

## Acceptance Criteria

- [ ] `WebhookSweepService` is registered in `WebhooksModule`
- [ ] `@nestjs/schedule` is installed and `ScheduleModule.forRoot()` is imported
- [ ] Sweep runs every 30s (configurable) and picks up `pending`/`dispatched` events older than 30s
- [ ] Uses `FOR UPDATE SKIP LOCKED` for safe multi-replica operation
- [ ] Re-entrancy guard prevents overlapping sweeps within a single process
- [ ] Retry count is incremented on each dispatch attempt
- [ ] Events with `retry_count >= 10` are skipped
- [ ] Sweep can be disabled via environment variable
- [ ] Unit tests cover: normal dispatch, retry increment, max retry skip, re-entrancy, empty result set
- [ ] Integration test: insert a `pending` event, wait for sweep, verify it moves to `dispatched`
