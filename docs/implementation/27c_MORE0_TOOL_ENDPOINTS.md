# 27c — More0 Tool Endpoints

**Date:** 2026-04-09
**Status:** Implementation Plan
**Depends on:** [27a](27a_WEBHOOK_RECEIPT_SIMPLIFICATION.md), [27b](27b_WEBHOOK_SWEEP_SERVICE.md)

---

## 0. Purpose

Document and harden the HTTP tool endpoints that the More0 workflow engine calls back into during the `process-webhook-event` workflow. These endpoints already exist in `ExternalToolsController` — this plan covers the changes needed to support v2 transaction boundaries and the additions required for full pipeline coverage.

---

## 1. Current State

The tool endpoints are already implemented in:

```
src/modules/external/tools/
├── external-tools.controller.ts   ← 4 endpoints, auth guard
└── tool-auth.guard.ts             ← shared secret validation
```

**Existing endpoints:**

| Endpoint | ASL Resource | Purpose |
|----------|-------------|---------|
| `POST /api/v1/tools/crunchwork/fetch` | `claims-manager.crunchwork-fetch` | Fetch full entity from CW API |
| `POST /api/v1/tools/external-objects/upsert` | `claims-manager.external-object-upsert` | Upsert external object + versions |
| `POST /api/v1/tools/mappers/:entityType` | `claims-manager.entity-mapper` | Project to internal tables |
| `POST /api/v1/tools/processing-log/update` | `claims-manager.processing-log-update` | Update processing log status |

**Authentication:** `ToolAuthGuard` checks `x-tool-secret` header against `more0.toolSecret` config. If no secret is configured, all requests are allowed (development mode).

---

## 2. Changes Required

### 2.1 Add Transaction Wrapper to `upsertExternalObject`

The current endpoint calls `externalObjectService.upsertFromFetch` without wrapping it in a transaction that also updates the webhook event status. In v2, the `upsert-external-object` workflow step must atomically:

1. Upsert external object + versions (already in `upsertFromFetch`)
2. Create processing log entry
3. Update `inbound_webhook_events.processing_status` → `fetched`

**Modified endpoint:**

```typescript
@Post('external-objects/upsert')
@HttpCode(HttpStatus.OK)
async upsertExternalObject(
  @Body()
  body: {
    tenantId: string;
    connectionId: string;
    providerId?: string;
    providerCode: string;
    providerEntityType: string;
    providerEntityId: string;
    normalizedEntityType?: string;
    payload: Record<string, unknown>;
    sourceEventId?: string;
    sourceEventType?: string;
    sourceEventTimestamp?: string;
    eventId: string;  // NEW — webhook event row ID
  },
): Promise<{
  externalObject: Record<string, unknown>;
  processingLogId: string;
  isNew: boolean;
  hashChanged: boolean;
}> {
  const logPrefix = 'ExternalToolsController.upsertExternalObject';
  this.logger.log(
    `${logPrefix} — ${body.providerEntityType}/${body.providerEntityId}`,
  );

  let result: { externalObject: any; isNew: boolean; hashChanged: boolean };
  let processingLogId: string;

  await this.db.transaction(async (tx) => {
    result = await this.externalObjectService.upsertFromFetch({
      tenantId: body.tenantId,
      connectionId: body.connectionId,
      providerId: body.providerId,
      providerCode: body.providerCode,
      providerEntityType: body.providerEntityType,
      providerEntityId: body.providerEntityId,
      normalizedEntityType: body.normalizedEntityType ?? body.providerEntityType,
      payload: body.payload,
      sourceEventId: body.sourceEventId,
      sourceEventType: body.sourceEventType,
      sourceEventTimestamp: body.sourceEventTimestamp
        ? new Date(body.sourceEventTimestamp)
        : undefined,
      tx,
    });

    const logEntry = await this.processingLogRepo.create({
      data: {
        tenantId: body.tenantId,
        connectionId: body.connectionId,
        eventId: body.eventId,
        providerEntityType: body.providerEntityType,
        providerEntityId: body.providerEntityId,
        action: 'webhook_process',
        status: 'pending',
        externalObjectId: result.externalObject.id,
      },
      tx,
    });
    processingLogId = logEntry.id;

    await this.webhookRepo.updateProcessingStatus({
      id: body.eventId,
      processingStatus: 'fetched',
      tx,
    });
  });

  return {
    externalObject: result!.externalObject as unknown as Record<string, unknown>,
    processingLogId: processingLogId!,
    isNew: result!.isNew,
    hashChanged: result!.hashChanged,
  };
}
```

This makes TX-2 from the overview (doc 27) fully atomic.

### 2.2 Add `InboundWebhookEventsRepository` to Controller Dependencies

The controller currently does not inject the webhook repo. Add it:

```typescript
constructor(
  private readonly crunchworkService: CrunchworkService,
  private readonly externalObjectService: ExternalObjectService,
  private readonly externalObjectsRepo: ExternalObjectsRepository,
  private readonly processingLogRepo: ExternalProcessingLogRepository,
  private readonly eventAttemptsRepo: ExternalEventAttemptsRepository,
  private readonly webhookRepo: InboundWebhookEventsRepository,  // NEW
  @Inject(DRIZZLE) private readonly db: DrizzleDB,               // NEW
  // ... mappers
) {}
```

### 2.3 Add Transaction Wrapper to `mapEntity`

The mapper endpoint should atomically project to internal tables **and** update the processing log. Currently, `mark-completed` is a separate workflow step. In v2, the mapper endpoint handles both to reduce the number of HTTP round-trips and keep the projection + status update atomic:

```typescript
@Post('mappers/:entityType')
@HttpCode(HttpStatus.OK)
async mapEntity(
  @Param('entityType') entityType: string,
  @Body()
  body: {
    externalObjectId: string;
    tenantId: string;
    connectionId: string;
    processingLogId?: string;  // NEW — optional, for status update
  },
): Promise<{ internalEntityId: string; internalEntityType: string }> {
  const logPrefix = 'ExternalToolsController.mapEntity';
  this.logger.log(
    `${logPrefix} — entityType=${entityType} externalObjectId=${body.externalObjectId}`,
  );

  const mapper = this.mappers[entityType];
  if (!mapper) {
    throw new BadRequestException(`No mapper registered for entity type: ${entityType}`);
  }

  const externalObject = await this.externalObjectsRepo.findById({
    id: body.externalObjectId,
  });
  if (!externalObject) {
    throw new BadRequestException(`External object not found: ${body.externalObjectId}`);
  }

  const mapResult = await mapper.map({
    externalObject: externalObject as unknown as Record<string, unknown>,
    tenantId: body.tenantId,
    connectionId: body.connectionId,
  });

  if (body.processingLogId) {
    await this.processingLogRepo.updateStatus({
      id: body.processingLogId,
      status: 'completed',
      completedAt: new Date(),
      externalObjectId: body.externalObjectId,
    });
  }

  return mapResult;
}
```

### 2.4 Enhance `updateProcessingLog` for Webhook Event Status

When the processing log is marked `failed`, the webhook event should also be updated. Add an optional `eventId` parameter:

```typescript
@Post('processing-log/update')
@HttpCode(HttpStatus.OK)
async updateProcessingLog(
  @Body()
  body: {
    processingLogId: string;
    status: string;
    externalObjectId?: string;
    errorMessage?: string;
    eventId?: string;          // NEW — update webhook event status too
    eventStatus?: string;      // NEW — e.g. 'fetch_failed', 'projection_failed'
  },
): Promise<{ success: boolean }> {
  const logPrefix = 'ExternalToolsController.updateProcessingLog';
  this.logger.log(
    `${logPrefix} — id=${body.processingLogId} status=${body.status}`,
  );

  await this.processingLogRepo.updateStatus({
    id: body.processingLogId,
    status: body.status,
    completedAt: body.status === 'completed' || body.status === 'failed'
      ? new Date()
      : undefined,
    externalObjectId: body.externalObjectId,
    errorMessage: body.errorMessage,
  });

  if (body.eventId && body.eventStatus) {
    await this.webhookRepo.updateProcessingStatus({
      id: body.eventId,
      processingStatus: body.eventStatus,
      processingError: body.errorMessage,
    });
  }

  return { success: true };
}
```

---

## 3. Endpoint Summary (v2)

| Endpoint | ASL Resource | TX Scope | Input Additions |
|----------|-------------|----------|-----------------|
| `POST /api/v1/tools/crunchwork/fetch` | `crunchwork-fetch` | None (HTTP call to CW) | — |
| `POST /api/v1/tools/external-objects/upsert` | `external-object-upsert` | **TX-2**: ext obj + versions + log + event status | `eventId` |
| `POST /api/v1/tools/mappers/:entityType` | `entity-mapper` | **TX-3**: internal upsert + links + log status | `processingLogId` |
| `POST /api/v1/tools/processing-log/update` | `processing-log-update` | Single UPDATE (or two UPDATEs) | `eventId`, `eventStatus` |

---

## 4. Error Handling

All tool endpoints follow the same error contract for More0:

- **2xx** — step succeeded, workflow proceeds to next state.
- **4xx** — client error (bad input, missing mapper). More0 routes to `Catch` block. No retry.
- **5xx** — server error (DB down, CW unreachable). More0 applies `Retry` policy.

Endpoints must not catch and suppress errors — let them propagate as HTTP status codes so the ASL retry/catch logic works correctly.

---

## 5. Security

The `ToolAuthGuard` remains the authentication mechanism. For production:

- `MORE0_TOOL_SECRET` must be set in the API environment.
- The same secret must be configured in the More0 worker that calls these endpoints (as a request header).
- In development/mock mode, the guard allows all requests when no secret is configured.

Consider adding rate limiting or IP allowlisting in production if the tool endpoints are network-accessible beyond the internal cluster.

---

## 6. More0 Capability Registration

Each tool endpoint corresponds to a More0 capability. These are registered either:

1. **Statically** — as capability manifests in `apps/api/more0/capabilities/` (JSON files describing the tool's name, methods, and HTTP endpoint).
2. **Dynamically** — via More0 registry API at startup.

See doc 27e for the full capability manifest definitions.

---

## Acceptance Criteria

- [ ] `upsertExternalObject` wraps ext obj + processing log + event status in a single DB transaction
- [ ] `mapEntity` accepts optional `processingLogId` and updates log status on success
- [ ] `updateProcessingLog` accepts optional `eventId`/`eventStatus` for webhook event updates
- [ ] `InboundWebhookEventsRepository` and `DrizzleDB` injected into controller
- [ ] All endpoints return appropriate HTTP status codes (2xx/4xx/5xx) for More0 retry logic
- [ ] `ToolAuthGuard` enforced on all endpoints
- [ ] No breaking changes to existing endpoint contracts (new fields are optional)
- [ ] Unit tests for transaction atomicity (commit and rollback paths)
- [ ] Integration test: call `upsert` endpoint, verify ext obj + log + event status all updated
