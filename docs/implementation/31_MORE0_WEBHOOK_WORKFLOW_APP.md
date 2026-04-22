# 31 — More0 Webhook Workflow App (HTTP Gateway Trigger + S3 Archive)

**Project:** Claims Manager
**Date:** 2026-04-21
**Scope:** Introduce a self-contained More0 **app** (definitions + workflow + tools) that, given only an `eventId`, loads the `inbound_webhook_events` row, extracts the provider entity type / id, fetches the full record from Crunchwork, archives the raw payload to MinIO (S3), and projects a normalized record into the target table. Replace the current in-process webhook pipeline with an HTTP-gateway call into this workflow. Retain the existing in-process path as a switchable fallback.

**Supersedes (partially):**
- `27e_MORE0_WORKFLOW_REFINEMENT.md` — workflow ASL is rewritten to accept only `eventId`.
- `29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md` — orchestrator route selection is preserved but the More0 branch now invokes via HTTP gateway instead of the registry SDK.

**Depends on:**
- `27a_WEBHOOK_RECEIPT_SIMPLIFICATION.md`, `27b_WEBHOOK_SWEEP_SERVICE.md`, `27c_MORE0_TOOL_ENDPOINTS.md`, `27d_ENTITY_MAPPER_SERVICE.md`, `27e_MORE0_WORKFLOW_REFINEMENT.md`, `27f_OBSERVABILITY_AND_RECOVERY.md`.

---

## 0. Problem

1. Today `WebhooksService.processEventAsync` fetches the full entity from Crunchwork and writes `external_objects` / `external_processing_log` rows **before** calling `WebhookOrchestratorService.finalize`. The orchestrator's More0 branch then invokes `workflow.claims-manager.process-webhook-event` with pre-resolved fields (`tenantId`, `connectionId`, `providerEntityId`, `processingLogId`, …).
2. The user wants a More0 workflow that is driven by a single **`eventId`** — the workflow itself is responsible for reading the `inbound_webhook_events` row, resolving entity type + id, calling CW, writing to S3, and writing the normalized record.
3. `More0Service.invokeWorkflow` POSTs to `MORE0_REGISTRY_URL/api/v1/workflows/invoke`. We need the HTTP-gateway flow shown in `apps/client-tests/stream-http-gateway/client.ts` (POST `${GATEWAY_URL}/api/v1/invoke` with `cap`, `method`, `params`, `x-organization-id`).
4. No raw-payload archive exists today. The schema stores the JSON in `inbound_webhook_events.raw_body_json` and (optionally) versioned copies in `external_object_versions`, but nothing writes to MinIO. We need a durable, bucket-scoped copy keyed by `tenantId / providerEntityType / providerEntityId / versionHash`.
5. The legacy in-process path (`InProcessProjectionService` + `WebhooksService.processEventAsync`) is still the safer default. It must remain enabled-by-default and be toggled off via a single env var once the More0 path has been exercised.

---

## 1. Desired Outcome

After this plan is executed:

1. A new More0 app `claims-manager-webhook` lives under `apps/api/more0/` with the directory structure used by `apps/client-tests/*` (app.json + nested `tools/`, `workflows/` subfolders with per-capability folders).
2. A workflow `workflow.claims-manager-webhook.process-inbound-event` accepts a single input — `{ eventId }` — plus the standard context. It drives the entire pipeline.
3. Five tool capabilities back the workflow:
   - `tool.claims-manager-webhook.webhook-event-read` — SELECT from `inbound_webhook_events` by id, return a normalized projection.
   - `tool.claims-manager-webhook.crunchwork-fetch` — unchanged behavior (wraps existing `tool.claims-manager.crunchwork-fetch` endpoint, renamed for clarity).
   - `tool.claims-manager-webhook.payload-archive` — writes the full CW payload to MinIO under a deterministic key, returns the object URL + etag.
   - `tool.claims-manager-webhook.external-object-upsert` — thin adapter over today's `external-objects/upsert` endpoint, adding `archiveObjectUri`.
   - `tool.claims-manager-webhook.entity-mapper` — thin adapter over today's `mappers/:entityType`, unchanged semantics.
4. Webhook processing is redirected: `WebhookOrchestratorService` routes to More0 by calling the HTTP gateway (`POST ${MORE0_GATEWAY_URL}/api/v1/invoke`) with just `{ eventId }`.
5. A single env var `WEBHOOK_PROCESSING_MODE=more0|inproc` selects the path. `inproc` is the default for the first release; `more0` activates the new workflow. Legacy `MORE0_ENABLED` continues to gate the client itself (no-op when the mode is `inproc`).
6. `docs/implementation/31_*` replaces the older More0 workflow doc fragments for future maintenance; existing 27e definitions are superseded but left in place for history.

---

## 2. High-Level Architecture

```
Crunchwork  ── HTTP POST ─▶  /webhooks/crunchwork  (WebhooksController)
                                     │
                                     ▼                                  (HMAC + persist in TX-1)
                              inbound_webhook_events   ─── row created, processing_status='pending'
                                     │
                                     ▼
                          WebhookOrchestratorService
                           │              │
              mode=more0   │              │ mode=inproc (fallback)
                           ▼              ▼
          POST ${GATEWAY}/api/v1/invoke   WebhooksService.processEventAsync
           cap: workflow.claims-manager-      (existing CW fetch + upsert +
                webhook.process-inbound-       InProcessProjectionService)
                event
           method: execute
           params: { eventId }
                           │
                           ▼
            ┌──────────────────────────────────────────────┐
            │  workflow.claims-manager-webhook             │
            │        .process-inbound-event                │
            │                                              │
            │  1. read-event           (tool)              │
            │  2. fetch-external       (tool, retry 3×)    │
            │  3. archive-payload      (tool, S3/minio)    │
            │  4. upsert-external-obj  (tool, TX-2)        │
            │  5. map-entity           (tool, TX-3)        │
            │  6. mark-fetch-failed    (catch)             │
            │     mark-upsert-failed   (catch)             │
            │     mark-projection-fail (catch)             │
            └──────────────────────────────────────────────┘
```

Each workflow step is an HTTP round-trip to the Claims Manager API under `/api/v1/tools/*`, guarded by `ToolAuthGuard` (`x-tool-secret` → `MORE0_TOOL_SECRET`). The existing tool endpoints are reused; the new `webhook-event-read` and `payload-archive` endpoints are added.

---

## 3. File Plan

### 3.1 More0 App Definitions (new layout, under `apps/api/more0/`)

The existing flat `definitions/*.json` layout is replaced with the client-tests-style nested structure:

```
apps/api/more0/
├── README.md                         (existing; update section references to this plan)
├── definitions/
│   ├── app.json                     (renamed app_key to "claims-manager-webhook")
│   ├── tools/
│   │   ├── webhook-event-read/
│   │   │   └── tool.json
│   │   ├── crunchwork-fetch/
│   │   │   └── tool.json
│   │   ├── payload-archive/
│   │   │   └── tool.json
│   │   ├── external-object-upsert/
│   │   │   └── tool.json
│   │   └── entity-mapper/
│   │       └── tool.json
│   └── workflows/
│       └── process-inbound-event/
│           ├── workflow.json
│           └── asl.json
```

Rationale: the `capabilities/apps/client-tests/workflow-simple` structure (app.json at top, sibling `workflows/<domain>/<name>/{workflow.json, asl.json}` and `tools/<name>/tool.json`) is the convention the More0 registry importer understands. We keep tool schema files 1-per-capability to make registry conflict resolution precise.

The old files (`apps/api/more0/definitions/crunchwork-fetch.json`, `external-object-upsert.json`, `entity-mapper.json`, `processing-log-update.json`, `apps/api/more0/workflows/process-webhook-event.json`) are **deleted** in this plan — they are superseded by the new layout. A migration note is added to `apps/api/more0/README.md` pointing at this doc.

### 3.2 Claims Manager API (backend changes)

New / changed files under `apps/api/src`:

| Path | Change |
|---|---|
| `common/s3/s3.module.ts` | **NEW** — exports `S3Service` based on `@aws-sdk/client-s3`. |
| `common/s3/s3.service.ts` | **NEW** — thin wrapper: `putObject`, `getSignedUrl`, `keyFor`. |
| `config/s3.config.ts` | **NEW** — registers `s3.*` config (`endpoint`, `region`, `bucket`, `accessKeyId`, `secretAccessKey`, `forcePathStyle`). |
| `config/more0.config.ts` | Add `gatewayUrl`, `organizationId`, `processingMode`. Keep existing fields. |
| `config/env.validation.ts` | Add validators for `MORE0_GATEWAY_URL`, `MORE0_ORGANIZATION_ID`, `WEBHOOK_PROCESSING_MODE`, `S3_*` / `MINIO_*`. |
| `modules/external/tools/external-tools.controller.ts` | Add endpoints: `POST /api/v1/tools/webhook-events/read`, `POST /api/v1/tools/payloads/archive`. Update `external-objects/upsert` to accept optional `archiveObjectUri` (write through to `external_object_versions.archive_object_uri`). |
| `modules/external/tools/external-tools.module.ts` | Import `S3Module` and `WebhooksModule` (for repo). |
| `modules/webhooks/webhook-orchestrator.service.ts` | `runMore0` reworked to call HTTP gateway with only `{ eventId }`. |
| `more0/more0.service.ts` | Add `invokeViaGateway({ cap, method, params, organizationId })`. Keep legacy `invokeWorkflow` for backfill (doc 19/21), mark deprecated in JSDoc. |
| `modules/webhooks/webhooks.service.ts` | Split `processEventAsync` into `processEventInProc` (existing body) and `processEventMore0` (no pre-fetch, just dispatches to orchestrator). The orchestrator now owns the branch. |
| `database/schema/index.ts` | Add column `archive_object_uri text` to `externalObjectVersions` (nullable). |
| `database/migrations-drizzle/NNNN_external_version_archive_uri.sql` | **NEW** — `ALTER TABLE external_object_versions ADD COLUMN archive_object_uri text;`. |

### 3.3 Infra / deploy

| Path | Change |
|---|---|
| `infra/env.example` | Add `MORE0_GATEWAY_URL`, `MORE0_ORGANIZATION_ID`, `WEBHOOK_PROCESSING_MODE`, `S3_BUCKET_PAYLOADS`, `S3_ARCHIVE_PREFIX`. |
| `deploy/terraform/environments/staging/*.tfvars` | Add new variables. |
| `deploy/terraform/modules/api/variables.tf` & `main.tf` | Pass new env vars into API service. |

### 3.4 Docs

| Path | Change |
|---|---|
| `docs/implementation/31_MORE0_WEBHOOK_WORKFLOW_APP.md` | **THIS PLAN.** |
| `apps/api/more0/README.md` | Update to describe new directory layout and env vars; link to this plan. |
| `docs/implementation/00_PLAN_OVERVIEW.md` | Add a bullet referencing doc 31 under the webhook pipeline section. |

---

## 4. Sequential Implementation Steps

Each step is independently landable and leaves the system in a runnable state. Unless noted, numbered steps are intended to be separate PRs.

### Step 1 — Add S3 Module

**Goal:** Centralized MinIO/S3 client for the API.

1.1 Add dependency: `pnpm --filter @claims-manager/api add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.

1.2 Create `apps/api/src/config/s3.config.ts`:
```ts
export default registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:3230',
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET_PAYLOADS || 'claims-manager',
  accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.MINIO_ROOT_USER || 'sail',
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.MINIO_ROOT_PASSWORD || 'password',
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'true') === 'true',
  archivePrefix: process.env.S3_ARCHIVE_PREFIX || 'webhooks/payloads',
}));
```

1.3 Create `apps/api/src/common/s3/s3.service.ts` with methods:
   - `putJson({ key, body, contentType = 'application/json', metadata }) → { etag, versionId? }`
   - `getSignedUrl({ key, expiresIn }) → string`
   - `keyForPayload({ tenantId, providerEntityType, providerEntityId, hash }) → string` returning `${archivePrefix}/${tenantId}/${providerEntityType}/${providerEntityId}/${hash}.json`.
   - All methods log with prefix `S3Service.<method>`.

1.4 Add `common/s3/s3.module.ts` exporting `S3Service`. Register in `app.module.ts` imports.

1.5 Register `s3.config.ts` under `ConfigModule.forRoot({ load: [...] })`.

**Exit criteria:** `S3Service` is injectable, a smoke-test controller (or `npm run test` unit) can PUT and GET a dummy JSON in the `claims-manager` MinIO bucket.

---

### Step 2 — Add `archive_object_uri` Column

**Goal:** Persist the S3 location of the archived payload alongside the existing version row.

2.1 Edit `apps/api/src/database/schema/index.ts`, add to `externalObjectVersions` pgTable:
```ts
archiveObjectUri: text('archive_object_uri'),
```

2.2 Generate drizzle migration: `pnpm --filter @claims-manager/api db:generate`. Rename to `000X_external_version_archive_uri.sql`. Verify SQL contains only `ALTER TABLE ... ADD COLUMN`.

2.3 Apply in dev: `pnpm --filter @claims-manager/api db:migrate`.

**Exit criteria:** migration runs cleanly; column visible via `\d external_object_versions`.

---

### Step 3 — Add New Tool Endpoints in `ExternalToolsController`

**Goal:** HTTP endpoints for the new workflow steps. Guarded by `ToolAuthGuard` like the existing endpoints (doc 27c).

3.1 `POST /api/v1/tools/webhook-events/read` — body `{ eventId }`, response:
```ts
{
  eventId: string;
  externalEventId: string;
  tenantId: string;
  connectionId: string;
  providerCode: string;
  providerEntityType: string;  // resolved via ExternalToolsController.resolveEntityType
  providerEntityId: string;
  eventType: string;
  eventTimestamp: string;
  rawPayload: Record<string, unknown>;
}
```
Implementation: `InboundWebhookEventsRepository.findById({ id })` → map fields → throw `BadRequestException` if the row is unresolved (missing `connectionId`, `tenantId`, or `payloadEntityId`) with an explicit `code` (`EVENT_UNRESOLVED`, `EVENT_UNSUPPORTED_TYPE`). Do **not** mutate state here.

3.2 `POST /api/v1/tools/payloads/archive` — body:
```ts
{ tenantId: string; providerEntityType: string; providerEntityId: string; payload: Record<string, unknown>; hash?: string; }
```
Response: `{ archiveObjectUri: string; bucket: string; key: string; etag: string; bytes: number; sha256: string; }`.

Implementation:
- Compute sha256 over canonical-JSON of payload (reuse existing `ExternalObjectService.canonicalHash` helper if present).
- `key = S3Service.keyForPayload({ ... })`.
- `S3Service.putJson({ key, body: JSON.stringify(payload), metadata: { tenantId, entityType, entityId, sha256 } })`.
- `archiveObjectUri = s3://${bucket}/${key}`.

3.3 Extend `POST /api/v1/tools/external-objects/upsert`:
- Add optional body field `archiveObjectUri: string`.
- Pass through to `ExternalObjectService.upsertFromFetch({ ..., archiveObjectUri })`.

3.4 Extend `ExternalObjectService.upsertFromFetch` to stamp `archiveObjectUri` on the new version row (only when provided; idempotent — same uri on the existing row is a no-op, a change triggers a new version following existing hash logic).

3.5 Unit tests:
- `webhook-events/read` returns all fields for a happy-path row; returns 400 `EVENT_UNSUPPORTED_TYPE` for unknown event types.
- `payloads/archive` writes the expected key and returns a canonical URI.

**Exit criteria:** Endpoints respond 200 with the documented bodies in Postman against a dev DB. `ToolAuthGuard` rejects without the header in non-dev mode.

---

### Step 4 — Rewrite More0 App Definitions to New Layout

**Goal:** Replace the flat definitions directory with the nested client-tests-style structure.

4.1 Delete the old files listed in §3.1. Create the new directories.

4.2 `apps/api/more0/definitions/app.json`:
```json
{
  "name": "claims-manager-webhook",
  "display_name": "Claims Manager Webhook",
  "type": "application",
  "version": "2.0.0",
  "description": "Webhook ingestion pipeline: event lookup → CW fetch → payload archive → external upsert → projection",
  "tags": ["claims-manager", "webhook", "crunchwork"],
  "app_key": "claims-manager-webhook",
  "exposure": {
    "publish": [
      { "match": "workflow.claims-manager-webhook.*" },
      { "match": "tool.claims-manager-webhook.*" }
    ]
  },
  "methods": {
    "info": {
      "description": "Application metadata",
      "semantics": "query",
      "channels": ["sync"],
      "output": { "type": "object", "properties": { "name": {"type":"string"}, "version": {"type":"string"}, "app_key": {"type":"string"} } }
    }
  }
}
```

4.3 For each tool, create `tools/<name>/tool.json`. Pattern follows `apps/client-tests/tool-operations/definitions/tool.math.operations.json` and the existing `claims-manager.crunchwork-fetch` manifest (implementation.kind = `http`, `entrypoint` = `{CLAIMS_MANAGER_BASE_URL}/api/v1/tools/...`, headers include `X-Tool-Secret`). Define each tool with a single `execute` method.

Expected tool names:
- `tool.claims-manager-webhook.webhook-event-read` → `POST {CLAIMS_MANAGER_BASE_URL}/api/v1/tools/webhook-events/read`. Input: `{ eventId }`.
- `tool.claims-manager-webhook.crunchwork-fetch` → `POST .../tools/crunchwork/fetch`. Input: `{ connectionId, providerEntityType, providerEntityId }`.
- `tool.claims-manager-webhook.payload-archive` → `POST .../tools/payloads/archive`.
- `tool.claims-manager-webhook.external-object-upsert` → `POST .../tools/external-objects/upsert`.
- `tool.claims-manager-webhook.entity-mapper` → `POST .../tools/mappers/{entityType}` (templated URL, see existing `entity-mapper.json` example).

4.4 Workflow files:

`workflows/process-inbound-event/workflow.json`:
```json
{
  "name": "workflow.claims-manager-webhook.process-inbound-event",
  "display_name": "Process Inbound Webhook Event",
  "type": "workflow",
  "version": "2.0.0",
  "description": "Given an inbound_webhook_events id, drive the full CW fetch → archive → upsert → projection pipeline.",
  "tags": ["claims-manager", "webhook", "crunchwork"],
  "methods": {
    "execute": {
      "description": "Execute the webhook processing pipeline",
      "input": {
        "type": "object",
        "properties": { "eventId": { "type": "string", "description": "inbound_webhook_events row id" } },
        "required": ["eventId"]
      },
      "output": {
        "type": "object",
        "properties": {
          "externalObjectId": { "type": "string" },
          "internalEntityType": { "type": "string" },
          "internalEntityId": { "type": "string" },
          "archiveObjectUri": { "type": "string" }
        }
      },
      "semantics": "work",
      "channels": ["async"]
    }
  },
  "dependencies": {
    "tools": [
      "tool.claims-manager-webhook.webhook-event-read",
      "tool.claims-manager-webhook.crunchwork-fetch",
      "tool.claims-manager-webhook.payload-archive",
      "tool.claims-manager-webhook.external-object-upsert",
      "tool.claims-manager-webhook.entity-mapper"
    ]
  },
  "implementation": {
    "kind": "workflow-asl",
    "entrypoint": "asl.json",
    "execution": { "kind": "workflow-engine", "config": { "adapter": "checkpoint-database" } }
  }
}
```

`workflows/process-inbound-event/asl.json` (summary — full JSON in the PR):
- `StartAt: "read-event"`.
- `read-event` — Task, `Resource: tool.claims-manager-webhook.webhook-event-read`, `Parameters: { method: "execute", params: { eventId.$: "$.eventId" } }`, `ResultPath: $.event`, no retry (DB read), `Catch → mark-read-failed`.
- `fetch-external` — Task, `Resource: tool.claims-manager-webhook.crunchwork-fetch`, `Parameters: method=execute, params: { connectionId.$:"$.event.connectionId", providerEntityType.$:"$.event.providerEntityType", providerEntityId.$:"$.event.providerEntityId" }`, `ResultPath: $.fetch`, `Retry: [{ ErrorEquals: ["States.TaskFailed"], MaxAttempts: 3, IntervalSeconds: 30, BackoffRate: 2 }]`, `Catch → mark-fetch-failed`.
- `archive-payload` — Task, `Resource: tool.claims-manager-webhook.payload-archive`, pulls `tenantId`, `providerEntityType`, `providerEntityId` from `$.event` and `payload` from `$.fetch.payload`. `ResultPath: $.archive`. Retry 2×, `Catch → mark-archive-failed`.
- `upsert-external-object` — Task, `Resource: tool.claims-manager-webhook.external-object-upsert`, parameters from `$.event` + `payload.$: "$.fetch.payload"` + `archiveObjectUri.$: "$.archive.archiveObjectUri"` + `eventId.$: "$.event.eventId"`. Retry 2×. Catch → `mark-upsert-failed`.
- `project-to-internal` — Task, `Resource: tool.claims-manager-webhook.entity-mapper`, parameters from `$.upsert.externalObject.id`, `$.event.tenantId`, `$.event.connectionId`, `$.event.providerEntityType`, `$.upsert.processingLogId`. Retry 2×. Catch → `mark-projection-failed`.
- `format-output` — Pass, emits the final `{ externalObjectId, internalEntityType, internalEntityId, archiveObjectUri }`. `End: true`.
- Four `mark-*-failed` states: each is a Task on `tool.claims-manager-webhook.external-object-upsert` only for `mark-upsert-failed` (to flip log row), the others go to a new `POST /api/v1/tools/processing-log/update` passing `eventId`, `eventStatus`, and `errorMessage.$: "$.error.Cause"`. This endpoint is added in Step 3.6 below.

3.6 **Addendum to Step 3:** retain `POST /api/v1/tools/processing-log/update` as described in doc 27c (optional `eventId` + `eventStatus`). If it is not already implemented with those fields, add them.

**Exit criteria:** `node apps/registry/cli/dist/main.js import --input apps/api/more0/definitions --target immutable --version 2.0.0 --conflict overwrite` (or the compose-driven equivalent) succeeds against the dev registry.

---

### Step 5 — Add HTTP Gateway Invocation Path to `More0Service`

**Goal:** Switch from the registry SDK endpoint to the HTTP gateway shown in `stream-http-gateway/client.ts`.

5.1 Extend `apps/api/src/config/more0.config.ts`:
```ts
export default registerAs('more0', () => ({
  registryUrl: process.env.MORE0_REGISTRY_URL || 'http://localhost:3201',
  gatewayUrl: process.env.MORE0_GATEWAY_URL || 'http://localhost:3205',
  organizationId: process.env.MORE0_ORGANIZATION_ID || 'claims-manager',
  appKey: process.env.MORE0_APP_KEY || 'claims-manager-webhook',
  apiKey: process.env.MORE0_API_KEY || '',
  toolSecret: process.env.MORE0_TOOL_SECRET || '',
  enabled: parseBool(process.env.MORE0_ENABLED, false),
}));
```

5.2 Add `invokeViaGateway` to `More0Service`:
```ts
async invokeViaGateway(params: {
  cap: string;        // e.g. "claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event"
  method: string;     // "execute"
  params: Record<string, unknown>;
  organizationId?: string;
  timeoutMs?: number;
}): Promise<{ runId?: string; status?: string; data?: unknown }>
```
Behavior:
- POST `${gatewayUrl}/api/v1/invoke`, `Content-Type: application/json`, `Accept: application/json`, `x-organization-id: ${organizationId || this.organizationId}`, `Authorization: Bearer ${apiKey}` when present.
- Body `{ cap, method, params }`.
- On non-2xx throw `Error("More0Service.invokeViaGateway — HTTP ${status}: ${bodyText}")`.
- Returns parsed JSON. The gateway replies with `{ runId, status }` for async workflows.
- Keep `invokeWorkflow`/`invokeWorkflowSync` in place for the backfill / ad-hoc paths (doc 19/21) but mark `@deprecated` in JSDoc; planned removal tracked as a follow-up.

5.3 Mock-mode behavior unchanged: when `mockMode` is true, log + return `{ runId: "mock-${uuid}", status: "mocked" }`.

**Exit criteria:** `More0Service.invokeViaGateway` reaches a running gateway in dev and receives a `runId`. Unit test covers the 4xx / 5xx paths.

---

### Step 6 — Rework `WebhookOrchestratorService` to Route via Gateway with Only `eventId`

**Goal:** The orchestrator's More0 branch hands the workflow a single `{ eventId }`. The old in-process branch is preserved for backup.

6.1 Add env var and config key: `WEBHOOK_PROCESSING_MODE` → `webhook.processingMode` (`'more0' | 'inproc'`, default `'inproc'`).

6.2 Update `WebhookOrchestratorService.resolveRoute` to prefer the explicit mode:
```ts
private resolveRoute(): OrchestratorRoute {
  const mode = this.configService.get<string>('webhook.processingMode', 'inproc');
  if (mode === 'more0' && this.shouldUseMore0()) return 'more0';
  if (this.configService.get<boolean>('webhook.inProcMappingEnabled', true)) return 'inproc';
  return 'none';
}
```
Keep `shouldUseMore0()` requiring `more0.enabled && more0.apiKey`.

6.3 Replace the body of `runMore0`:
```ts
const cap = `claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event`;
const { runId } = await this.more0Service.invokeViaGateway({
  cap,
  method: 'execute',
  params: { eventId: params.eventId },
});
await this.processingLogRepo.updateStatus({
  id: params.processingLogId,
  status: 'processing',
  workflowRunId: runId ?? null,
  metadata: { orchestratorRoute: 'more0', workflowRunId: runId },
});
await this.webhookRepo.updateProcessingStatus({ id: params.eventId, processingStatus: 'dispatched' });
```

6.4 Important sequencing change: in `WebhooksService.processEventAsync`, when mode is `more0`, we **must not** pre-fetch the CW entity. Refactor:
- Split `processEventAsync` into two private methods:
  - `processEventInProc(params)` — today's full body.
  - `processEventMore0(params)` — creates a `processingLogId` row with `status='pending'` and `action='webhook_process'`, then calls `orchestrator.finalize` with a placeholder `externalObjectId: null` and `providerEntityType` resolved from `eventType` only (used solely for logging); the workflow itself will build the external object row via `external-objects/upsert`.
- The orchestrator's `runMore0` should accept `externalObjectId?: string | null` and pass through. `runInProc` keeps its current required contract.
- The decision happens once at the top of `processEventAsync` based on `WEBHOOK_PROCESSING_MODE`:
```ts
if (this.config.get<string>('webhook.processingMode') === 'more0' && this.more0Service.isEnabled()) {
  return this.processEventMore0(params);
}
return this.processEventInProc(params);
```

6.5 When mode=`more0` the log row is created **before** the gateway call so we have a `processingLogId` to record `workflowRunId` into. The workflow does NOT create a log row; it receives the existing id via the `webhook-events/read` tool, which must now also return `processingLogId` (add it to the response). Update Step 3.1 contract accordingly.

**Exit criteria:**
- With `WEBHOOK_PROCESSING_MODE=inproc`, existing tests/behavior pass unchanged.
- With `WEBHOOK_PROCESSING_MODE=more0` and mock More0 (`MORE0_ENABLED=false`), logs show `[MOCK] invokeViaGateway — claims-manager-webhook/workflow...` and the event stays at `processing_status=pending`.
- With `WEBHOOK_PROCESSING_MODE=more0` + `MORE0_ENABLED=true` pointed at a running gateway, the workflow runs end-to-end against a seeded `inbound_webhook_events` row.

---

### Step 7 — Client Test (mirrors `client-tests/stream-http-gateway`)

**Goal:** An end-to-end script that developers can run to confirm the gateway path works from the host.

7.1 Add `apps/api/more0/client-test/client.ts` with:
- A small helper that reads an `eventId` from `process.argv[2]` (or inserts a seed row via psql beforehand).
- Calls `POST ${GATEWAY_URL}/api/v1/invoke` with `{ cap: "claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event", method: "execute", params: { eventId } }`, `x-organization-id: claims-manager-webhook`, `Accept: application/json`. Pattern: copy from `apps/client-tests/stream-http-gateway/client.ts`.
- Prints `runId` on success, polls (optional) the registry's runs endpoint, and exits non-zero on failure.

7.2 Add a pnpm script in `apps/api/package.json`: `"test:more0-webhook": "tsx apps/api/more0/client-test/client.ts"`.

7.3 Document in `apps/api/more0/README.md` how to: (a) import definitions, (b) seed an event, (c) run the client.

**Exit criteria:** Running the script against a dev stack (MinIO + registry + gateway + API + workers up) drives the row to `processing_status=dispatched` and creates a `completed` processing-log entry plus an object in MinIO under `claims-manager/webhooks/payloads/...`.

---

### Step 8 — Env + Compose + Terraform Wiring

**Goal:** Make the new vars available in all environments.

8.1 `infra/env.example` — add:
```
WEBHOOK_PROCESSING_MODE=inproc
MORE0_GATEWAY_URL=http://localhost:3205
MORE0_ORGANIZATION_ID=claims-manager-webhook
S3_ENDPOINT=http://localhost:3230
S3_BUCKET_PAYLOADS=claims-manager
S3_ARCHIVE_PREFIX=webhooks/payloads
S3_ACCESS_KEY_ID=sail
S3_SECRET_ACCESS_KEY=password
S3_FORCE_PATH_STYLE=true
```

8.2 `docker-compose.yml` for the API service — forward the same envs.

8.3 `deploy/terraform/modules/api` — add variables + pass through to the container env.

8.4 `deploy/terraform/environments/staging/*.tfvars` — default `webhook_processing_mode = "inproc"` initially; flip to `"more0"` only after manual validation in staging.

**Exit criteria:** `docker compose up` in dev with `WEBHOOK_PROCESSING_MODE=more0` boots cleanly and the API logs confirm the More0 route is active.

---

### Step 9 — Tests

**Unit tests (mock-heavy, no infra):**
- `More0Service.invokeViaGateway` — happy path, 4xx error path, 5xx retry semantics (if added), mock mode.
- `WebhookOrchestratorService.resolveRoute` — matrix over `processingMode` ∈ {more0, inproc, unset} × `more0.enabled` ∈ {t,f} × `apiKey` ∈ {t,f} × `inProcMappingEnabled` ∈ {t,f}.
- `ExternalToolsController.readWebhookEvent` — returns full projection, rejects unknown event types.
- `ExternalToolsController.archivePayload` — builds deterministic key, propagates etag.

**Integration tests:**
- API boots with `WEBHOOK_PROCESSING_MODE=more0` and `MORE0_ENABLED=true` pointed at a mock gateway (supertest + nock or msw) — invoking the webhook endpoint POSTs to the mock gateway with the right body.
- `POST /api/v1/tools/payloads/archive` against local MinIO writes and reads back the object.

**End-to-end (manual, scripted in the README):**
- Seed an `inbound_webhook_events` row → run Step 7 client script → verify MinIO object + `external_objects` row + `external_processing_log` row + projection.

**Exit criteria:** CI green; manual E2E documented and reproducible.

---

### Step 10 — Documentation & Rollout

10.1 Update `apps/api/more0/README.md` and `docs/implementation/00_PLAN_OVERVIEW.md`.

10.2 Add a CHANGELOG-style note under `docs/discussion/` describing the switch.

10.3 Rollout plan:
- (a) Deploy with `WEBHOOK_PROCESSING_MODE=inproc` (no behavior change).
- (b) In staging only: set `WEBHOOK_PROCESSING_MODE=more0`, `MORE0_ENABLED=true`, send a synthetic webhook, verify MinIO + DB.
- (c) In prod: same, with a single-tenant canary via a feature-flag header (out of scope for this plan; document only).
- (d) After a week without regressions, make `more0` the default in `infra/env.example`.

10.4 Rollback: flip the env var back to `inproc`, restart the API. No DB changes needed beyond the additive column in Step 2.

---

## 5. Open Questions / Assumptions

1. **Organization header value** — the `stream-http-gateway` example uses `x-organization-id: client-test-stream-http-gateway` (matches `app_key`). This plan uses `claims-manager-webhook`. If the gateway requires the caller's *own* organization (not the target app's), confirm and adjust `MORE0_ORGANIZATION_ID`.
2. **Workflow sync vs async** — the plan assumes async invocation (`runId` returned immediately). If the gateway route is strictly SSE (method=stream) for workflows, Step 5 must be adapted to the SSE reader from `stream-http-gateway/client.ts` and Step 6 must await the terminal event. Confirm against the gateway OpenAPI before coding.
3. **`processingLogId` ownership** — this plan moves log-row creation into `processEventMore0` (API side, pre-dispatch) and drops workflow-side log creation. Alternative: let `webhook-events/read` create it. Keeping it API-side simplifies failure handling when the gateway call itself fails.
4. **Deleting old definitions** — the old `workflow.claims-manager.process-webhook-event` + sibling tools are still referenced by `ExternalController.triggerBackfill` via `More0Service.invokeWorkflow`. Step 4 should either (a) keep the old names registered alongside the new ones for the backfill path, or (b) migrate backfill to the new cap in the same PR. Prefer (a) for minimal blast radius; schedule (b) as a follow-up.
5. **MinIO bucket** — `infra/init.sh` already creates `claims-manager`. If a dedicated `claims-manager-payloads` bucket is preferred for lifecycle policies, add it to `init.sh` and set `S3_BUCKET_PAYLOADS` accordingly.

---

## 6. Acceptance Criteria (Roll-up)

- [ ] `apps/api/more0/definitions/` matches the client-tests layout with `app.json`, `tools/*/tool.json`, `workflows/process-inbound-event/{workflow.json, asl.json}`.
- [ ] All five tool endpoints respond under `/api/v1/tools/*` with `ToolAuthGuard`.
- [ ] `POST /api/v1/tools/payloads/archive` writes to MinIO and returns a deterministic `archiveObjectUri`.
- [ ] `external_object_versions.archive_object_uri` persists the URI for each new version.
- [ ] `WEBHOOK_PROCESSING_MODE=inproc` preserves current behavior (no regression).
- [ ] `WEBHOOK_PROCESSING_MODE=more0` causes `WebhookOrchestratorService` to invoke the workflow via `POST ${MORE0_GATEWAY_URL}/api/v1/invoke` with `{ cap, method: "execute", params: { eventId } }` and no other fields.
- [ ] Workflow run executes all six states in order and ends in `completed` for a happy-path event; `mark-*-failed` paths update `inbound_webhook_events.processing_status` with the correct granular code.
- [ ] `MORE0_API_KEY` / `MORE0_TOOL_SECRET` are plumbed end-to-end in dev + staging.
- [ ] Client test under `apps/api/more0/client-test/` runs green.
- [ ] Runbook entries in `apps/api/more0/README.md` cover import, seed, run, rollback.
