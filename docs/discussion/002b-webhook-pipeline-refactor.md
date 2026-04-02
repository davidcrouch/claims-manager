# 002b — Webhook Ingest & More0 Integration

**Date:** 2026-03-25 (revised)
**Status:** Implementation Plan
**Parent:** [002 — Master Index](./002-implementation-plan.md)
**Depends on:** [002a — Schema & Migrations](./002a-schema-and-migrations.md)

---

## 0. Scope

This sub-plan covers:
1. Streamlining the webhook HTTP handler to **ingest only** (persist + invoke More0).
2. Integrating the `@more0ai/client` SDK into NestJS to invoke More0 workflows.
3. Defining the More0 workflow for webhook processing.
4. Creating NestJS HTTP tool endpoints that More0 calls back into for each processing step.
5. Creating the `ExternalObjectService` that the tools use.
6. Creating the basic Job and Claim mappers (called by More0, not an in-process registry).

After this sub-plan, the flow is:
```
NestJS: webhook HTTP → persist event → invoke More0 workflow → return 200
More0:  workflow runs → calls NestJS tools → fetch, upsert, project → done
```

---

## 1. Architecture: NestJS ↔ More0 Boundary

### What NestJS does (synchronous, in webhook handler)

1. Receive HTTP POST.
2. HMAC verify.
3. Dedup by `externalEventId`.
4. Resolve `connectionId` from payload.
5. Persist `inbound_webhook_events` row.
6. Create `external_processing_log` row (status=`pending`).
7. Invoke More0 workflow `claims-manager.process-webhook-event` via SDK, passing the event context.
8. Return `{ received: true }`.

### What More0 does (durable workflow)

The More0 workflow `claims-manager.process-webhook-event` runs asynchronously with built-in retries, backoff, and checkpointing:

```
Step 1: resolve-entity-type     → Determine CW entity type from event type
Step 2: fetch-external-entity   → Call NestJS tool: GET /api/v1/tools/crunchwork/fetch
Step 3: upsert-external-object  → Call NestJS tool: POST /api/v1/tools/external-objects/upsert
Step 4: project-to-internal     → Call NestJS tool: POST /api/v1/tools/mappers/{entityType}
Step 5: update-processing-log   → Call NestJS tool: POST /api/v1/tools/processing-log/complete

On failure at any step → More0 retries with backoff (configured in workflow definition)
On terminal failure → Call NestJS tool: POST /api/v1/tools/processing-log/fail
```

### Why this split

| Concern | Where | Why |
|---------|-------|-----|
| HTTP endpoint + HMAC | NestJS | NestJS is the HTTP server; More0 does not receive webhooks |
| Event persistence | NestJS | NestJS owns the database |
| Orchestration, retries, failure handling | More0 | That's More0's purpose — durable workflow execution |
| CW API calls | NestJS (tool, invoked by More0) | NestJS has the CrunchworkService HTTP client |
| Entity mapping | NestJS (tool, invoked by More0) | NestJS has the repositories and domain logic |
| Downstream business actions | More0 (future workflow steps) | Approvals, notifications, escalations are workflow concerns |

---

## 2. Work Items

### 2.1 — Install and configure `@more0ai/client` SDK

**Package addition:**
```
pnpm --filter api add @more0ai/client
```

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/config/more0.config.ts` | **Create** — More0 config registration |
| `apps/api/src/more0/more0.module.ts` | **Create** — Module providing More0 client |
| `apps/api/src/more0/more0.service.ts` | **Create** — Wrapper service for SDK calls |
| `apps/api/src/app.module.ts` | Import `More0Module` |

**Config (`more0.config.ts`):**
```typescript
export default registerAs('more0', () => ({
  registryUrl: process.env.MORE0_REGISTRY_URL || 'http://localhost:3200',
  appKey: process.env.MORE0_APP_KEY || 'claims-manager',
  apiKey: process.env.MORE0_API_KEY || '',
}));
```

**`More0Service` methods:**

#### `invokeWorkflow`
```typescript
async invokeWorkflow(params: {
  workflowName: string;
  input: Record<string, unknown>;
  context?: { tenantId: string; userId?: string };
}): Promise<{ runId: string }>
```
Wraps the `@more0ai/client` SDK invocation call. Returns the More0 workflow run ID.

#### `invokeWorkflowSync` (optional, for testing)
```typescript
async invokeWorkflowSync(params: {
  workflowName: string;
  input: Record<string, unknown>;
  context?: { tenantId: string };
  timeoutMs?: number;
}): Promise<Record<string, unknown>>
```
Waits for completion. Used in integration tests only.

---

### 2.2 — Define More0 workflow and tool capabilities

The workflow ASL definition, tool capability manifests, input/output schemas, retry configuration, and the full invocation flow are documented in detail in the master index:

> **See [002 — Master Index, Section 3: More0 Integration Model](./002-implementation-plan.md#3-more0-integration-model)**
>
> Key subsections:
> - **3.4** — Full ASL definition for `process-webhook-event` workflow
> - **3.5** — Tool capability definitions with input/output schemas
> - **3.6** — Retry responsibility split (CW HTTP retries vs More0 step retries)
> - **3.8** — Capability definition file locations

**Files to create:**

| File (relative to `apps/api/`) | Purpose |
|------|---------|
| `more0/app.json` | Application manifest (`app_key: claims-manager`) |
| `more0/workflows/process-webhook-event.json` | ASL workflow definition |
| `more0/definitions/crunchwork-fetch.json` | Tool capability manifest |
| `more0/definitions/external-object-upsert.json` | Tool capability manifest |
| `more0/definitions/entity-mapper.json` | Tool capability manifest |
| `more0/definitions/processing-log-update.json` | Tool capability manifest |

The exact JSON format conforms to More0's `docs/CAPABILITY_SCHEMA.md`. These files are imported into More0's registry via CLI or compose flows during deployment.

---

### 2.3 — Create NestJS Tool Endpoints Module

**Purpose:** HTTP endpoints that More0 workflows call back into. These are NestJS controllers exposed at `/api/v1/tools/*`, authenticated via More0 M2M token (not user JWT).

**File:** `apps/api/src/modules/external/tools/external-tools.module.ts` **(Create)**
**File:** `apps/api/src/modules/external/tools/external-tools.controller.ts` **(Create)**

**Endpoints:**

#### `POST /api/v1/tools/crunchwork/fetch`
Calls `CrunchworkService` to fetch an entity from the CW API.

**Input:**
```typescript
{
  connectionId: string;
  providerEntityType: string;   // 'job', 'claim', 'purchase_order', etc.
  providerEntityId: string;
}
```

**Logic:**
- Map `providerEntityType` to the correct `CrunchworkService` method (`getJob`, `getClaim`, `getPurchaseOrder`, `getInvoice`, `getTask`, `getMessage`, `getAttachment`, `getReport`).
- Call the CW API.
- Return the raw JSON response.

**Output:** `{ payload: Record<string, unknown> }`

#### `POST /api/v1/tools/external-objects/upsert`
Calls `ExternalObjectService.upsertFromFetch()`.

**Input:**
```typescript
{
  tenantId: string;
  connectionId: string;
  providerCode: string;
  providerEntityType: string;
  providerEntityId: string;
  normalizedEntityType: string;
  payload: Record<string, unknown>;
  sourceEventId?: string;
}
```

**Output:** `{ externalObject: ExternalObjectRow; isNew: boolean; hashChanged: boolean }`

#### `POST /api/v1/tools/mappers/{entityType}`
Calls the appropriate entity mapper.

**Input:**
```typescript
{
  externalObjectId: string;
  tenantId: string;
  connectionId: string;
}
```

**Logic:** Dispatches to the correct mapper based on `entityType` path param.

**Output:** `{ internalEntityId: string; internalEntityType: string }`

#### `POST /api/v1/tools/processing-log/complete`
Updates the processing log row.

#### `POST /api/v1/tools/processing-log/fail`
Updates the processing log row with error info.

**Auth for tool endpoints:** These endpoints must be callable by More0 workers but not by arbitrary users. Options:
- M2M API key in `Authorization` header (validated against More0's auth server).
- Shared secret in a custom header (simpler for MVP).
- Internal-only network access (if NestJS and More0 are co-located).

**Decision for MVP:** Shared secret via `X-Tool-Secret` header, configured in both NestJS env and More0 workflow config. A dedicated `@ToolAuth()` guard validates it.

---

### 2.4 — Create `ExternalObjectService`

**File:** `apps/api/src/modules/external/external-object.service.ts` **(Create)**

**Method: `upsertFromFetch`**
```typescript
async upsertFromFetch(params: {
  tenantId: string;
  connectionId: string;
  providerCode: string;
  providerEntityType: string;
  providerEntityId: string;
  normalizedEntityType: string;
  payload: Record<string, unknown>;
  sourceEventId?: string;
}): Promise<{ externalObject: ExternalObjectRow; isNew: boolean; hashChanged: boolean }>
```

**Logic:**
1. Compute `payloadHash` — SHA-256 of `JSON.stringify(payload)` (Node.js `crypto.createHash`).
2. Call `externalObjectsRepo.upsert()`.
3. If hash changed (or new row): create `external_object_versions` row with next version number.
4. Return the external object row, insertion flag, and hash-changed flag.

**Method: `resolveInternalEntityId`**
```typescript
async resolveInternalEntityId(params: {
  connectionId: string;
  providerEntityType: string;
  providerEntityId: string;
  internalEntityType: string;
}): Promise<string | null>
```
Looks up the external_object → external_link chain to find the internal entity UUID for a given CW entity.

**Dependencies:** `ExternalObjectsRepository`, `ExternalObjectVersionsRepository`, `ExternalLinksRepository`

---

### 2.5 — Create `CrunchworkJobMapper` (basic)

**File:** `apps/api/src/modules/external/mappers/crunchwork-job.mapper.ts` **(Create)**

**Logic:**
1. Receive `externalObject` (loaded by the tool endpoint).
2. Check `external_links` for an existing link from this external object to an internal job.
3. If linked: update the internal job's `apiPayload` + `externalReference`.
4. If not linked:
   a. Generate new internal UUID (not the CW ID).
   b. Resolve `claimId` — check if CW job's nested `claim.id` has a linked internal claim; if not, extract and create the claim (delegate to `CrunchworkClaimMapper`).
   c. Resolve `jobTypeLookupId` from `lookup_values`.
   d. Insert into `jobs`.
   e. Create `external_link` (externalObjectId → job, role=`source`).
5. Copy payload into `jobs.apiPayload`.

> Full field extraction is deferred to 002c. This basic mapper populates: `tenantId`, `claimId`, `externalReference`, `jobTypeLookupId`, `apiPayload`.

---

### 2.6 — Create `CrunchworkClaimMapper` (basic)

**File:** `apps/api/src/modules/external/mappers/crunchwork-claim.mapper.ts` **(Create)**

Same pattern as Job mapper. Basic fields: `tenantId`, `claimNumber`, `externalReference`, `apiPayload`.

---

### 2.7 — Create `NestedEntityExtractor`

**File:** `apps/api/src/modules/external/nested-entity-extractor.service.ts` **(Create)**

**Method: `extractFromJobPayload`**
```typescript
async extractFromJobPayload(params: {
  jobPayload: Record<string, unknown>;
  tenantId: string;
  connectionId: string;
  sourceEventId?: string;
}): Promise<{ claimId?: string; vendorId?: string }>
```

Extracts nested claim and vendor from a CW Job response, creating/updating the corresponding internal records.

> Contact and appointment extraction deferred to 002c.

---

### 2.8 — Refactor `WebhooksService`

**File:** `apps/api/src/modules/webhooks/webhooks.service.ts` **(Modify)**

**Changes:**

1. **Inject** `More0Service`, `IntegrationConnectionsRepository`, `ExternalProcessingLogRepository`.

2. **Add method** `resolveConnection`:
```typescript
async resolveConnection(params: {
  payloadTenantId: string;
  payloadClient: string;
}): Promise<{ connectionId: string; providerCode: string } | null>
```

3. **Modify** `persistEvent` — accept optional `connectionId` and `providerCode`.

4. **Replace** `processEventAsync` with `triggerWorkflow`:
```typescript
async triggerWorkflow(params: {
  eventId: string;
  tenantId: string;
  connectionId: string;
  eventType: string;
  providerEntityId: string;
}): Promise<{ processingLogId: string; workflowRunId: string }>
```
Logic:
- Create `external_processing_log` row (status=`pending`).
- Invoke More0 workflow `claims-manager.process-webhook-event` via `More0Service.invokeWorkflow()`, passing event context.
- Update processing log with `workflowRunId`.
- Return both IDs.

5. **Add** event type → entity type mapping (unchanged from original 002b):
```typescript
private resolveEntityType(eventType: string): string | null
```

---

### 2.9 — Refactor `WebhooksController` (and alias)

**File:** `apps/api/src/modules/webhooks/webhooks.controller.ts` **(Modify)**
**File:** `apps/api/src/modules/webhooks/webhook-alias.controller.ts` **(Modify)**

**Updated flow:**
```typescript
async handleWebhook(@Headers('event-signature') signature, @Req() req) {
  // 1. Parse + dedup (unchanged)
  // 2. Resolve connection
  const connection = await this.webhooksService.resolveConnection({...});
  // 3. HMAC verify
  const hmacVerified = signature ? this.hmacService.verify({...}) : false;
  // 4. Persist event (with connectionId)
  const event = await this.webhooksService.persistEvent({...});
  // 5. Trigger More0 workflow (replaces processEventAsync)
  if (hmacVerified && connection) {
    await this.webhooksService.triggerWorkflow({
      eventId: event.id,
      tenantId: event.payloadTenantId,
      connectionId: connection.connectionId,
      eventType: event.eventType,
      providerEntityId: event.payloadEntityId,
    });
  }
  return { received: true };
}
```

The controller is now purely an ingest endpoint. All processing is delegated to More0.

---

### 2.10 — Remove `WebhookProcessorService`

**File:** `apps/api/src/modules/webhooks/webhook-processor.service.ts` **(Delete or gut)**

This file contained the old `processEvent` → `handleJobEvent` / `handleClaimEvent` logic. With More0 orchestrating and NestJS tool endpoints doing the actual work, this service is no longer needed.

**Options:**
- **Delete entirely** — clean break.
- **Keep as thin facade** — if there's value in having a NestJS-side entry point for testing that bypasses More0.

**Recommendation:** Delete. The tool endpoints (`/api/v1/tools/...`) are the new entry points, and they can be tested directly.

---

### 2.11 — Create `ExternalModule`

**File:** `apps/api/src/modules/external/external.module.ts` **(Create)**

**Provides:**
- `ExternalObjectService`
- `CrunchworkJobMapper`
- `CrunchworkClaimMapper`
- `NestedEntityExtractor`

**Imports:** `DatabaseModule`, `CrunchworkModule`

**Exports:** `ExternalObjectService` (used by tool endpoints)

---

### 2.12 — Create `ExternalToolsModule`

**File:** `apps/api/src/modules/external/tools/external-tools.module.ts` **(Create)**

**Controllers:** `ExternalToolsController`

**Imports:** `ExternalModule`, `CrunchworkModule`, `DatabaseModule`

**Guards:** `ToolAuthGuard` (validates `X-Tool-Secret` header)

---

### 2.13 — Update `WebhooksModule`

**File:** `apps/api/src/modules/webhooks/webhooks.module.ts` **(Modify)**

- Remove `WebhookProcessorService` from providers.
- Add `More0Module` to imports.
- Remove `CrunchworkModule` import (no longer needed — CW calls go through tool endpoints).

---

### 2.14 — Update `AppModule`

**File:** `apps/api/src/app.module.ts` **(Modify)**

- Add `More0Module` to imports.
- Add `ExternalModule` to imports.
- Add `ExternalToolsModule` to imports.

---

## 3. More0 Capability Registrations

> Full definitions, schemas, retry config, and ASL: see [002 — Master Index, Section 3.4–3.5](./002-implementation-plan.md#3-more0-integration-model)

| FQCN | Type | Backed By |
|------|------|-----------|
| `claims-manager.process-webhook-event` | workflow | ASL definition in `more0/workflows/process-webhook-event.json` |
| `claims-manager.crunchwork-fetch` | tool | `POST /api/v1/tools/crunchwork/fetch` |
| `claims-manager.external-object-upsert` | tool | `POST /api/v1/tools/external-objects/upsert` |
| `claims-manager.entity-mapper` | tool | `POST /api/v1/tools/mappers/{entityType}` |
| `claims-manager.processing-log-update` | tool | `POST /api/v1/tools/processing-log/update` |

Manifests live in `apps/api/more0/definitions/` and are imported into More0's registry via CLI or compose flows during deployment.

---

## 4. New Files Summary

| # | File (relative to `apps/api/src/`) | Purpose |
|---|-----|---------|
| 1 | `config/more0.config.ts` | More0 SDK configuration |
| 2 | `more0/more0.module.ts` | NestJS module providing More0 client |
| 3 | `more0/more0.service.ts` | Wrapper for `@more0ai/client` SDK |
| 4 | `modules/external/external.module.ts` | NestJS module for external gateway logic |
| 5 | `modules/external/external-object.service.ts` | External object upsert + versioning |
| 6 | `modules/external/nested-entity-extractor.service.ts` | Extract nested entities from CW responses |
| 7 | `modules/external/mappers/crunchwork-job.mapper.ts` | CW Job → internal jobs (basic) |
| 8 | `modules/external/mappers/crunchwork-claim.mapper.ts` | CW Claim → internal claims (basic) |
| 9 | `modules/external/tools/external-tools.module.ts` | Module for tool endpoints |
| 10 | `modules/external/tools/external-tools.controller.ts` | HTTP endpoints More0 calls |
| 11 | `modules/external/tools/tool-auth.guard.ts` | Auth guard for More0→NestJS calls |

**More0 definition files (outside NestJS src):**

| # | File (relative to `apps/api/`) | Purpose |
|---|-----|---------|
| 1 | `more0/workflows/process-webhook-event.json` | Workflow ASL definition |
| 2 | `more0/definitions/crunchwork-fetch.json` | Tool capability manifest |
| 3 | `more0/definitions/external-object-upsert.json` | Tool capability manifest |
| 4 | `more0/definitions/entity-mapper.json` | Tool capability manifest |
| 5 | `more0/definitions/processing-log-update.json` | Tool capability manifest |

## 5. Modified Files Summary

| # | File | Change |
|---|------|--------|
| 1 | `modules/webhooks/webhooks.service.ts` | Replace `processEventAsync` with `triggerWorkflow` |
| 2 | `modules/webhooks/webhooks.controller.ts` | Call `triggerWorkflow` instead of `processEventAsync` |
| 3 | `modules/webhooks/webhook-alias.controller.ts` | Same |
| 4 | `modules/webhooks/webhooks.module.ts` | Remove processor, add More0Module import |
| 5 | `modules/webhooks/webhook-processor.service.ts` | **Delete** |
| 6 | `app.module.ts` | Import More0Module, ExternalModule, ExternalToolsModule |

---

## 6. CW IDs vs Internal IDs (unchanged from original)

Internal records use auto-generated UUIDs. The CW ID goes in `externalReference`. The `external_links` table connects them.

---

## 7. Test Strategy

| Test | Scope |
|------|-------|
| `More0Service` unit test | Mock SDK; verify `invokeWorkflow` passes correct params and returns runId. |
| `ExternalObjectService` unit test | Mock repos; verify upsert creates version when hash changes. |
| `CrunchworkJobMapper` unit test | Mock repos; verify new UUID generation, external_link creation. |
| Tool endpoint integration test | Call `POST /api/v1/tools/crunchwork/fetch` directly; verify CW service called and response returned. |
| Webhook E2E test | POST to webhook endpoint → verify event persisted, processing log created, More0 workflow invoked. |
| More0 workflow E2E test | Invoke workflow in More0 test mode → verify all steps execute → verify external_object + internal record + external_link created. |

---

## 8. Estimated Effort

| Item | Estimate |
|------|----------|
| More0 SDK integration (config, module, service) | 2 hours |
| More0 workflow definition + capability manifests | 3 hours |
| Tool endpoints controller + guard | 3 hours |
| ExternalObjectService | 2 hours |
| CrunchworkJobMapper (basic) | 2 hours |
| CrunchworkClaimMapper (basic) | 1.5 hours |
| NestedEntityExtractor | 1.5 hours |
| WebhooksService refactor | 1.5 hours |
| WebhooksController refactor (both) | 1 hour |
| Module wiring + cleanup | 1 hour |
| Unit tests | 3 hours |
| Integration tests | 2 hours |
| **Total** | **~3 days** |
