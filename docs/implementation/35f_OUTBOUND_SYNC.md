# 35f — Outbound Sync: Transactional Outbox & Async Workers

**Parent:** [35 — Domain Layer Architecture](./35_DOMAIN_LAYER_ARCHITECTURE.md)
**Phase:** 5

---

## 0. Purpose

EnsureOS is the system of record. When domain operations produce changes that external systems need to know about (e.g., Crunchwork), those changes are captured in a **transactional outbox table** — written atomically within the same database transaction as the domain operation. A separate async worker polls the outbox and pushes payloads to external APIs.

This pattern guarantees:
- **No lost messages** — if the domain TX commits, the outbound record exists
- **No ghost messages** — if the domain TX rolls back, no outbound record was written
- **Decoupled from external availability** — domain operations never fail due to Crunchwork being down
- **Retry safety** — failed pushes are retried without re-executing domain logic

---

## 1. Outbound Queue Schema

```sql
CREATE TABLE outbound_sync_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES organizations(id),
  connection_id   UUID NOT NULL REFERENCES integration_connections(id),

  -- What to sync
  entity_type     TEXT NOT NULL,       -- 'job', 'invoice', 'purchase_order', etc.
  entity_id       UUID NOT NULL,
  action          TEXT NOT NULL,       -- 'create', 'update', 'status_change', 'issue', 'delete'
  payload         JSONB NOT NULL,      -- Snapshot of what to send (adapter transforms to external format)

  -- Processing state
  status          TEXT NOT NULL DEFAULT 'pending',
  priority        INTEGER NOT NULL DEFAULT 0,    -- Higher = process first
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  last_error      TEXT,
  last_attempted_at TIMESTAMPTZ,

  -- Scheduling
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Earliest time to process
  not_before      TIMESTAMPTZ,          -- Delay (e.g., debounce rapid updates)

  -- Correlation
  source_event    TEXT,                 -- What triggered this (e.g., 'workflow:issue', 'api:update')
  idempotency_key TEXT,                 -- Prevents duplicate pushes for the same operation

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,

  CONSTRAINT chk_outbound_status CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'))
);

CREATE INDEX idx_outbound_poll ON outbound_sync_queue(status, scheduled_at, priority DESC)
  WHERE status = 'pending';
CREATE INDEX idx_outbound_entity ON outbound_sync_queue(tenant_id, entity_type, entity_id);
CREATE INDEX idx_outbound_connection ON outbound_sync_queue(connection_id, status);
CREATE UNIQUE INDEX UQ_outbound_idempotency ON outbound_sync_queue(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status != 'cancelled';
```

---

## 2. OutboundSyncService

Written to by domain services and use cases within a transaction.

```typescript
// apps/api/src/modules/domain/outbound/outbound-sync.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../database/drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../../../database/drizzle.module';

@Injectable()
export class OutboundSyncService {
  private readonly logger = new Logger('OutboundSyncService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Enqueue an outbound sync record within the current transaction.
   * Returns the queue entry ID.
   */
  async enqueue(params: {
    tenantId: string;
    connectionId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown>;
    sourceEvent?: string;
    idempotencyKey?: string;
    priority?: number;
    scheduledAt?: Date;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const db = params.tx;
    const [row] = await db
      .insert(outboundSyncQueue)
      .values({
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        payload: params.payload,
        sourceEvent: params.sourceEvent,
        idempotencyKey: params.idempotencyKey,
        priority: params.priority ?? 0,
        scheduledAt: params.scheduledAt ?? new Date(),
        status: 'pending',
      })
      .onConflictDoNothing()  // Idempotency key dedup
      .returning();

    if (row) {
      this.logger.debug(
        `OutboundSyncService.enqueue — queued ${params.entityType}:${params.entityId} action=${params.action} id=${row.id}`,
      );
    }
    return row?.id ?? '';
  }

  /**
   * Convenience: only enqueue if the entity's tenant has an active connection
   * for the relevant provider. Avoids queuing for tenants without integrations.
   */
  async enqueueIfConnected(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown>;
    sourceEvent?: string;
    tx: DrizzleDbOrTx;
  }): Promise<string | null> {
    // 1. Find active connection for tenant + provider (e.g., 'crunchwork')
    // 2. If no connection, return null (nothing to sync)
    // 3. If connected, call this.enqueue() with the connectionId
    return null; // placeholder
  }

  /**
   * Cancel pending outbound records for an entity (e.g., if entity was deleted
   * or a newer update supersedes a pending one).
   */
  async cancelPending(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<number> {
    // UPDATE outbound_sync_queue SET status = 'cancelled'
    // WHERE entity_type = :type AND entity_id = :id AND status = 'pending'
    return 0;
  }
}
```

---

## 3. Outbound Worker

A background service that polls the queue and dispatches to adapters.

```typescript
// apps/api/src/modules/domain/outbound/outbound-worker.service.ts

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../database/drizzle.module';
import type { DrizzleDB } from '../../../database/drizzle.module';

@Injectable()
export class OutboundWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('OutboundWorker');
  private polling = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private adapters: Map<string, OutboundAdapter> = new Map();

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  registerAdapter(providerCode: string, adapter: OutboundAdapter): void {
    this.adapters.set(providerCode, adapter);
  }

  onModuleInit(): void {
    // Start polling (configurable interval, default 5s)
    const intervalMs = parseInt(process.env.OUTBOUND_POLL_INTERVAL_MS ?? '5000', 10);
    this.polling = true;
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
    this.logger.log(`OutboundWorker started — polling every ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    this.polling = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private async poll(): Promise<void> {
    if (!this.polling) return;

    try {
      // 1. Claim a batch of pending records (SELECT FOR UPDATE SKIP LOCKED)
      const batch = await this.claimBatch(10);
      if (batch.length === 0) return;

      // 2. Process each record
      for (const record of batch) {
        await this.processRecord(record);
      }
    } catch (err) {
      this.logger.error(`OutboundWorker.poll — unexpected error: ${err}`);
    }
  }

  private async claimBatch(limit: number): Promise<OutboundQueueRow[]> {
    // SELECT * FROM outbound_sync_queue
    // WHERE status = 'pending' AND scheduled_at <= now() AND attempts < max_attempts
    // ORDER BY priority DESC, scheduled_at ASC
    // LIMIT :limit
    // FOR UPDATE SKIP LOCKED
    //
    // UPDATE ... SET status = 'processing', last_attempted_at = now(), attempts = attempts + 1
    return [];
  }

  private async processRecord(record: OutboundQueueRow): Promise<void> {
    const logPrefix = `OutboundWorker.process[${record.id}]`;

    // Resolve the adapter based on connection's provider_code
    const connection = await this.getConnection(record.connectionId);
    if (!connection) {
      this.logger.error(`${logPrefix} — connection ${record.connectionId} not found`);
      await this.markFailed(record.id, 'Connection not found');
      return;
    }

    const adapter = this.adapters.get(connection.providerCode);
    if (!adapter) {
      this.logger.error(`${logPrefix} — no adapter for provider '${connection.providerCode}'`);
      await this.markFailed(record.id, `No adapter for ${connection.providerCode}`);
      return;
    }

    try {
      await adapter.push({
        connection,
        entityType: record.entityType,
        entityId: record.entityId,
        action: record.action,
        payload: record.payload,
      });

      await this.markSent(record.id);
      this.logger.log(`${logPrefix} — sent ${record.entityType}:${record.entityId} action=${record.action}`);
    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      this.logger.warn(`${logPrefix} — failed: ${errorMsg}`);

      if (record.attempts >= record.maxAttempts) {
        await this.markFailed(record.id, errorMsg);
      } else {
        // Schedule retry with exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, record.attempts), 300000); // Max 5min
        await this.scheduleRetry(record.id, backoffMs, errorMsg);
      }
    }
  }

  private async markSent(id: string): Promise<void> {
    // UPDATE SET status = 'sent', processed_at = now()
  }

  private async markFailed(id: string, error: string): Promise<void> {
    // UPDATE SET status = 'failed', last_error = :error
  }

  private async scheduleRetry(id: string, backoffMs: number, error: string): Promise<void> {
    // UPDATE SET status = 'pending', scheduled_at = now() + interval, last_error = :error
  }
}
```

---

## 4. Outbound Adapter Interface

Each external system has an adapter that transforms internal payloads into the external API format and pushes them.

```typescript
// apps/api/src/modules/domain/outbound/outbound-adapter.interface.ts

export interface OutboundAdapter {
  push(params: {
    connection: IntegrationConnectionRow;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}
```

---

## 5. Crunchwork Outbound Adapter

```typescript
// apps/api/src/modules/domain/outbound/adapters/crunchwork-outbound.adapter.ts

import { Injectable, Logger } from '@nestjs/common';
import type { OutboundAdapter } from '../outbound-adapter.interface';
import { CrunchworkService } from '../../../crunchwork/crunchwork.service';

@Injectable()
export class CrunchworkOutboundAdapter implements OutboundAdapter {
  private readonly logger = new Logger('CrunchworkOutboundAdapter');

  constructor(private readonly crunchwork: CrunchworkService) {}

  async push(params: {
    connection: IntegrationConnectionRow;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const { connection, entityType, action, payload } = params;

    // Transform internal payload → CW API format
    const cwPayload = this.transformToCrunchwork(entityType, action, payload);

    // Determine CW API endpoint based on entity type + action
    const endpoint = this.resolveEndpoint(entityType, action);

    // Make authenticated API call
    await this.crunchwork.authenticatedRequest({
      connection,
      method: this.resolveMethod(action),
      path: endpoint,
      body: cwPayload,
    });
  }

  private transformToCrunchwork(
    entityType: string,
    action: string,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    // Reverse transformation: Ensure shape → CW API shape
    // This is the inverse of the inbound transformers
    // Each entity type has its own mapping logic
    switch (entityType) {
      case 'job':
        return this.transformJob(action, payload);
      case 'invoice':
        return this.transformInvoice(action, payload);
      case 'quote':
        return this.transformQuote(action, payload);
      default:
        return payload;
    }
  }

  private resolveEndpoint(entityType: string, action: string): string {
    // Map entity type + action to CW API path
    const endpoints: Record<string, string> = {
      'job:status_change': '/jobs/{id}/status',
      'job:update': '/jobs/{id}',
      'invoice:create': '/invoices',
      'invoice:issue': '/invoices/{id}/submit',
      'quote:create': '/quotes',
      'quote:issue': '/quotes/{id}/submit',
    };
    return endpoints[`${entityType}:${action}`] ?? `/${entityType}s`;
  }

  private resolveMethod(action: string): 'POST' | 'PUT' | 'PATCH' {
    if (action === 'create') return 'POST';
    if (action === 'update' || action === 'status_change') return 'PATCH';
    return 'POST'; // issue, submit, etc.
  }

  private transformJob(action: string, payload: Record<string, unknown>): Record<string, unknown> {
    // Job-specific reverse transformation
    return payload;
  }

  private transformInvoice(action: string, payload: Record<string, unknown>): Record<string, unknown> {
    // Invoice-specific reverse transformation
    return payload;
  }

  private transformQuote(action: string, payload: Record<string, unknown>): Record<string, unknown> {
    // Quote-specific reverse transformation
    return payload;
  }
}
```

---

## 6. Debouncing Rapid Updates

If a user edits an entity multiple times in quick succession, we don't want to send N separate updates to Crunchwork. The outbound service supports debouncing:

```typescript
// When enqueuing with debounce:
await this.outboundSync.enqueue({
  ...params,
  idempotencyKey: `${entityType}:${entityId}:update`,  // Same key = only one pending
  scheduledAt: new Date(Date.now() + 5000),            // Delay 5s for debounce
});
```

If a second update comes within 5s, the idempotency key prevents a duplicate. The existing pending record's payload can be updated (or the old one cancelled and a new one created with the latest state).

---

## 7. Monitoring & Observability

The outbound queue provides natural observability:

```sql
-- Pending backlog
SELECT connection_id, entity_type, COUNT(*) as pending
FROM outbound_sync_queue WHERE status = 'pending'
GROUP BY connection_id, entity_type;

-- Failed records needing attention
SELECT * FROM outbound_sync_queue
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Average processing time
SELECT entity_type, AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_seconds
FROM outbound_sync_queue WHERE status = 'sent'
GROUP BY entity_type;
```

A health check endpoint can expose queue depth and error rates.

---

## 8. Configuration

```typescript
// Environment variables:
OUTBOUND_POLL_INTERVAL_MS=5000     // How often worker polls
OUTBOUND_BATCH_SIZE=10             // Records per poll cycle
OUTBOUND_MAX_ATTEMPTS=5            // Retries before marking failed
OUTBOUND_ENABLED=true              // Kill switch
```

In development/testing, `OUTBOUND_ENABLED=false` disables the worker entirely — records accumulate in the queue but are never processed.

---

## 9. Integration Points

### From Workflow Hooks

```typescript
// The 'syncOutbound' hook (see 35e):
async execute(context: WorkflowContext): Promise<void> {
  await this.outboundSync.enqueueIfConnected({
    tenantId: context.tenantId,
    entityType: context.entityType,
    entityId: context.entityId,
    action: 'status_change',
    payload: { step: context.targetStep, entity: context.entity },
    sourceEvent: `workflow:${context.action}`,
    tx: context.tx,
  });
}
```

### From Use Cases (Direct Writes)

```typescript
// In a use case that updates an entity:
await this.outboundSync.enqueue({
  tenantId,
  connectionId,
  entityType: 'job',
  entityId: jobId,
  action: 'update',
  payload: { ...updatedFields },
  idempotencyKey: `job:${jobId}:update`,
  scheduledAt: new Date(Date.now() + 3000),  // 3s debounce
  tx,
});
```

### From Document Issuance

```typescript
// In DocumentIssuanceService when recipient is off-platform:
await this.outboundSync.enqueue({
  tenantId,
  connectionId: recipientConnectionId,
  entityType: 'invoice',
  entityId: invoiceId,
  action: 'issue',
  payload: { versionNumber, entity, lineItems },
  sourceEvent: 'workflow:issue',
  tx,
});
```
