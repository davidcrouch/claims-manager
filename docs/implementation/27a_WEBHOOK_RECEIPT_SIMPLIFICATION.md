# 27a — Webhook Receipt Simplification

**Date:** 2026-04-09
**Status:** Implementation Plan
**Depends on:** [27](27_WEBHOOK_PIPELINE_V2_OVERVIEW.md)

---

## 0. Purpose

Simplify `WebhooksController` and `WebhooksService` so the HTTP handler does the absolute minimum: deduplicate, persist the raw event, attempt a More0 dispatch, and return 200. The CW fetch and external object upsert that currently live in `processEventAsync` move to More0 tool endpoints (doc 27c).

---

## 1. Scope of Changes

### 1.1 Files Modified

| File | Change |
|------|--------|
| `apps/api/src/modules/webhooks/webhooks.controller.ts` | Minor — call simplified `dispatchToMore0` instead of `processEventAsync` |
| `apps/api/src/modules/webhooks/webhooks.service.ts` | Major — remove `processEventAsync` body, replace with thin `dispatchToMore0` |
| `apps/api/src/modules/webhooks/webhook-alias.controller.ts` | Mirror changes from primary controller |

### 1.2 Files Removed

None. The existing handlers directory (`handlers/`) is retained — entity-specific logic moves to the mapper service (doc 27d).

---

## 2. Controller Changes

The controller flow stays almost identical. The only change is calling `dispatchToMore0` instead of `processEventAsync`:

```typescript
@Post('crunchwork')
@Public()
@HttpCode(HttpStatus.OK)
async handleWebhook(
  @Headers('event-signature') signature: string,
  @Req() req: RawBodyRequest,
): Promise<{ received: true }> {
  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body || {}));
  const rawBodyText = rawBody.toString();

  const payload = typeof req.body === 'object' ? req.body : JSON.parse(rawBodyText);
  const existing = await this.webhooksService.webhookRepo.findByExternalEventId({
    externalEventId: payload.id,
  });
  if (existing) {
    return { received: true };
  }

  const connection = await this.webhooksService.resolveConnection({
    payloadTenantId: payload.payload?.tenantId ?? '',
    payloadClient: payload.payload?.client ?? '',
  });

  const hmacSecret = connection
    ? await this.webhooksService.getWebhookSecret({ connectionId: connection.connectionId })
    : '';

  const hmacVerified = signature
    ? this.hmacService.verify({ rawBody, signature, hmacSecret })
    : false;

  const event = await this.webhooksService.persistEvent({
    rawBody: rawBodyText,
    rawHeaders: req.headers as Record<string, string>,
    signature: signature || '',
    hmacVerified,
    connectionId: connection?.connectionId,
    providerCode: connection?.providerCode,
    providerId: connection?.providerId,
  });

  // Fire-and-forget dispatch — sweep service (27b) recovers failures
  if (hmacVerified && connection) {
    this.webhooksService
      .dispatchToMore0({
        eventId: event.id,
        tenantId: event.payloadTenantId ?? '',
        connectionId: connection.connectionId,
        providerId: connection.providerId,
        eventType: event.eventType,
        providerEntityId: event.payloadEntityId ?? '',
        eventTimestamp: event.eventTimestamp,
      })
      .catch(() => {});
  }

  return { received: true };
}
```

---

## 3. Service Changes

### 3.1 Remove `processEventAsync`

The current `processEventAsync` method (lines 106–226 of `webhooks.service.ts`) does three things:

1. Fetches the full entity from Crunchwork
2. Runs a DB transaction (external objects + processing log + event status)
3. Invokes More0

In v2, steps 1 and 2 are owned by More0 workflow steps. Replace the entire method with a thin dispatcher:

### 3.2 New `dispatchToMore0` Method

```typescript
async dispatchToMore0(params: {
  eventId: string;
  tenantId: string;
  connectionId: string;
  providerId: string;
  eventType: string;
  providerEntityId: string;
  eventTimestamp?: Date;
}): Promise<void> {
  const logPrefix = 'WebhooksService.dispatchToMore0';

  try {
    const entityType = this.resolveEntityType(params.eventType);
    if (!entityType) {
      this.logger.warn(`${logPrefix} — unknown event type: ${params.eventType}`);
      await this.webhookRepo.updateProcessingStatus({
        id: params.eventId,
        processingStatus: 'unrecognized',
        processingError: `Unknown event type: ${params.eventType}`,
      });
      return;
    }

    const { runId } = await this.more0Service.invokeWorkflow({
      workflowName: 'process-webhook-event',
      input: {
        eventId: params.eventId,
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        providerId: params.providerId,
        eventType: params.eventType,
        providerEntityType: entityType,
        providerEntityId: params.providerEntityId,
        eventTimestamp: params.eventTimestamp?.toISOString(),
      },
      context: { tenantId: params.tenantId },
    });

    await this.webhookRepo.updateProcessingStatus({
      id: params.eventId,
      processingStatus: 'dispatched',
    });

    this.logger.log(
      `${logPrefix} — dispatched event ${params.eventId} as More0 run ${runId}`,
    );
  } catch (error) {
    const msg = (error as Error).message;
    this.logger.error(`${logPrefix} — dispatch failed for event ${params.eventId}: ${msg}`);
    // Event stays 'pending' — sweep service (27b) will retry
  }
}
```

### 3.3 Removed Dependencies

After this change, `WebhooksService` no longer needs:

| Dependency | Reason for Removal |
|---|---|
| `CrunchworkService` | Fetch moves to More0 tool endpoint |
| `ExternalObjectService` | Upsert moves to More0 tool endpoint |
| `ExternalProcessingLogRepository` | Log creation moves to More0 tool endpoint |
| `@Inject(DRIZZLE) db: DrizzleDB` | No more in-process transactions |

The constructor shrinks to:

```typescript
constructor(
  public readonly webhookRepo: InboundWebhookEventsRepository,
  private readonly connectionsRepo: IntegrationConnectionsRepository,
  private readonly more0Service: More0Service,
  private readonly connectionResolver: ConnectionResolverService,
  private readonly cipher: CredentialsCipher,
) {}
```

The `onModuleInit` hook that calls `crunchworkService.setConnectionResolver` also moves to the tool endpoints module (27c), since the CrunchworkService is now used there.

### 3.4 Retained Methods

| Method | Status |
|---|---|
| `resolveConnection` | Retained — used by controller |
| `getWebhookSecret` | Retained — used by controller |
| `persistEvent` | Retained — unchanged |
| `resolveEntityType` | Retained — used by `dispatchToMore0` |

---

## 4. Processing Status Lifecycle

The `processing_status` column on `inbound_webhook_events` tracks progress through the pipeline. The v2 lifecycle:

```
pending ──▶ dispatched ──▶ fetched ──▶ completed
   │              │            │
   │              │            └──▶ projection_failed
   │              └──▶ fetch_failed (after More0 retries exhausted)
   └──▶ unrecognized (unknown event type)
```

| Status | Set By | Meaning |
|---|---|---|
| `pending` | Controller (INSERT) | Event persisted, not yet dispatched to More0 |
| `dispatched` | `dispatchToMore0` or sweep | More0 has accepted the workflow invocation |
| `fetched` | More0 tool `external-object-upsert` | CW entity fetched and external object stored |
| `completed` | More0 tool `processing-log-update` | Internal projection done |
| `fetch_failed` | More0 `mark-failed` step | CW fetch failed after all retries |
| `projection_failed` | More0 `mark-failed` step | Entity mapper failed |
| `unrecognized` | `dispatchToMore0` | Event type not mapped to any entity type |

---

## 5. Backward Compatibility

- The backfill endpoint (`POST /api/external/backfill`) continues to work — it calls `More0Service.invokeWorkflow` directly, bypassing the receipt flow.
- Events already processed by v1 (status = `completed` or `dispatched`) are not affected.
- Events stuck at `pending` from v1 will be picked up by the new sweep service (27b).

---

## Acceptance Criteria

- [ ] Controller calls `dispatchToMore0` instead of `processEventAsync`
- [ ] `processEventAsync` is removed from `WebhooksService`
- [ ] `WebhooksService` constructor no longer injects `CrunchworkService`, `ExternalObjectService`, `ExternalProcessingLogRepository`, or `DrizzleDB`
- [ ] `dispatchToMore0` invokes More0 workflow with full input payload
- [ ] Failed dispatch leaves event at `pending` (no error status written)
- [ ] Successful dispatch updates event to `dispatched`
- [ ] Unrecognized event types are marked `unrecognized`
- [ ] Alias controller mirrors the same behavior
- [ ] Existing backfill endpoint still works
- [ ] All existing unit tests updated or replaced
