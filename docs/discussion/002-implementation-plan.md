# 002 — Implementation Plan: Master Index

**Date:** 2026-03-25 (revised)
**Status:** Implementation Plan — ready for review
**Depends on:** [001 — PRD2 Gap Analysis / Design Plan](./001-prd2-gap-analysis.md)

---

## 0. Purpose

This is the **master index** for the implementation plan derived from the design plan in `001-prd2-gap-analysis.md`. The work is split into five sequential sub-plans, each independently reviewable, estimable, and deliverable.

### Orchestration — More0

This system uses **More0** as its workflow, orchestration, and business-logic layer (see [More0 Platform Description](./more0-platform-description-for-saas-scope.md)). The architectural boundary is:

| NestJS Owns | More0 Owns |
|-------------|------------|
| HTTP webhook endpoint, HMAC verification | Orchestration of all post-ingest processing |
| Persist `inbound_webhook_events` | Step sequencing (fetch → upsert → project → downstream) |
| Data layer: all repos, Drizzle schema, migrations | Retry / backoff / failure handling |
| CW API client (exposed as a More0 tool) | Workflow state and execution history |
| Entity mappers (exposed as More0 tools) | Branching, checkpointing, escalation |
| Invoke More0 workflow after event ingest | Downstream business actions (notifications, approvals, etc.) |

NestJS does **not** contain its own polling worker, retry loop, or dispatch registry. Once a webhook event is persisted, NestJS invokes a More0 workflow and the platform takes over.

---

## 1. Sub-Plan Index

| Doc | Title | Scope | Depends On |
|-----|-------|-------|------------|
| [002a](./002a-schema-and-migrations.md) | Schema & Migrations | New tables, column additions, Drizzle schema, migration sequencing | — |
| [002b](./002b-webhook-pipeline-refactor.md) | Webhook Ingest & More0 Integration | Ingest handler, More0 SDK integration, workflow definition, NestJS tools for More0 | 002a |
| [002c](./002c-entity-mappers.md) | Entity Mappers (More0 Tools) | Per-entity CW→internal mappers for all event types, registered as More0 tools | 002a, 002b |
| [002d](./002d-processing-resilience.md) | Admin Visibility & Audit | Processing log table, admin status endpoints, backfill trigger | 002a, 002b |
| [002e](./002e-multi-tenant-connections.md) | Multi-Tenant Connection Management | Refactor auth/API client to use DB connections; webhook connection resolution | 002a, 002b |

---

## 2. Delivery Sequence

```
002a ──────────────┐
                   ├──► 002b ──────┬──► 002c
                   │               ├──► 002d
                   │               └──► 002e
                   └───────────────┘
```

**002a** must land first — every other sub-plan depends on the new tables.
**002b** must land next — it establishes the More0 integration pattern that 002c/002d/002e build on.
**002c**, **002d**, and **002e** can be developed in parallel once 002b is merged.

---

## 3. More0 Integration Model

### 3.1 More0 Concepts Used by claims-manager

More0 is a capability-centric platform. Everything invocable — workflows, tools, agents — is a **capability** registered in More0's **registry**, versioned, and executed by **workers** communicating over **NATS**. Claims-manager uses two capability types:

| Capability Type | What It Is | How claims-manager Uses It |
|----------------|-----------|---------------------------|
| **Workflow** | A durable ASL (AWS States Language–style) state machine executed by More0's workflow engine. Steps can invoke other capabilities (tools, nested workflows). Has built-in retry, catch, branching, parallel, wait, and checkpointing. | Defines the multi-step process that runs after a webhook event is ingested. |
| **Tool** | A registered, versioned unit of imperative logic. Can be TypeScript, Python, a container, or an **HTTP endpoint** on an external service. Invoked by workflows or directly. | NestJS HTTP endpoints that perform database operations, CW API calls, and entity mapping. More0 calls these endpoints as tool invocations. |

### 3.2 Application Registration

Claims-manager registers as a More0 **application** (`app_key: claims-manager`). All its capabilities are grouped under this application.

```
More0 Registry
└── Application: claims-manager
    ├── Workflow: claims-manager.process-webhook-event
    ├── Tool: claims-manager.crunchwork-fetch
    ├── Tool: claims-manager.external-object-upsert
    ├── Tool: claims-manager.entity-mapper
    ├── Tool: claims-manager.processing-log-update
    └── (future) Workflow: claims-manager.new-job-onboarding
```

### 3.3 Invocation Pattern

NestJS invokes More0 via the `@more0ai/client` SDK:

```
NestJS                          More0 Registry              More0 Worker
  │                                  │                          │
  │─── invokeWorkflow ──────────────►│                          │
  │    (claims-manager.              │── resolve capability ──►│
  │     process-webhook-event,       │   route to worker        │
  │     { eventId, tenantId, ... })  │                          │
  │◄── { runId } ───────────────────│                          │
  │                                  │                          │
  │    (NestJS returns 200           │     Workflow engine      │
  │     to webhook caller)           │     executes steps:      │
  │                                  │                          │
  │◄── HTTP POST /tools/fetch ──────│────── Step 1: fetch ────│
  │─── { payload } ────────────────►│                          │
  │                                  │                          │
  │◄── HTTP POST /tools/upsert ────│────── Step 2: upsert ───│
  │─── { externalObject } ────────►│                          │
  │                                  │                          │
  │◄── HTTP POST /tools/mapper ────│────── Step 3: project ──│
  │─── { internalEntityId } ──────►│                          │
  │                                  │     (workflow completes) │
```

The SDK call is **async** — NestJS receives a `runId` immediately and does not wait for the workflow to complete. More0's workflow engine drives the steps, calling back into NestJS tool endpoints over HTTP.

### 3.4 Workflow Definition: `process-webhook-event`

This is the core workflow. It is an ASL-style state machine registered in More0.

**Capabilities used within the workflow:**

| Step Name | Capability Invoked | Purpose | Retry Config |
|-----------|-------------------|---------|-------------|
| `resolve-entity-type` | (inline pass state) | Maps event type string to entity type using a lookup table within the ASL definition. No external call. | — |
| `fetch-external-entity` | `claims-manager.crunchwork-fetch` | Calls the NestJS tool endpoint that wraps `CrunchworkService.get<Entity>()`. Returns raw CW API payload. | 3 attempts, 30s base interval, 2x backoff |
| `upsert-external-object` | `claims-manager.external-object-upsert` | Calls the NestJS tool endpoint that wraps `ExternalObjectService.upsertFromFetch()`. Computes hash, creates version if changed. | 2 attempts, 5s interval |
| `project-to-internal` | `claims-manager.entity-mapper` | Calls the NestJS tool endpoint that dispatches to the correct entity mapper (Job, Claim, PO, etc.). Creates/updates internal records and external_links. | 2 attempts, 5s interval |
| `mark-completed` | `claims-manager.processing-log-update` | Updates the `external_processing_log` row to `completed`. | 1 attempt |
| `mark-failed` | `claims-manager.processing-log-update` | Catch handler — updates the log row to `failed` with error details. | 1 attempt |

**ASL structure (conceptual):**

```
StartAt: resolve-entity-type

States:
  resolve-entity-type:
    Type: Pass
    Result: <mapped entity type from event type>
    Next: fetch-external-entity

  fetch-external-entity:
    Type: Task
    Resource: claims-manager.crunchwork-fetch
    Parameters:
      connectionId.$: $.connectionId
      providerEntityType.$: $.resolvedEntityType
      providerEntityId.$: $.providerEntityId
    Retry:
      - ErrorEquals: [States.ALL]
        MaxAttempts: 3
        IntervalSeconds: 30
        BackoffRate: 2
    Catch:
      - ErrorEquals: [States.ALL]
        Next: mark-failed
    Next: upsert-external-object

  upsert-external-object:
    Type: Task
    Resource: claims-manager.external-object-upsert
    Parameters:
      tenantId.$: $.tenantId
      connectionId.$: $.connectionId
      providerCode: crunchwork
      providerEntityType.$: $.resolvedEntityType
      providerEntityId.$: $.providerEntityId
      payload.$: $.fetchResult.payload
      sourceEventId.$: $.eventId
    Catch:
      - ErrorEquals: [States.ALL]
        Next: mark-failed
    Next: project-to-internal

  project-to-internal:
    Type: Task
    Resource: claims-manager.entity-mapper
    Parameters:
      externalObjectId.$: $.upsertResult.externalObject.id
      tenantId.$: $.tenantId
      connectionId.$: $.connectionId
      entityType.$: $.resolvedEntityType
    Catch:
      - ErrorEquals: [States.ALL]
        Next: mark-failed
    Next: mark-completed

  mark-completed:
    Type: Task
    Resource: claims-manager.processing-log-update
    Parameters:
      processingLogId.$: $.processingLogId
      status: completed
      externalObjectId.$: $.upsertResult.externalObject.id
    End: true

  mark-failed:
    Type: Task
    Resource: claims-manager.processing-log-update
    Parameters:
      processingLogId.$: $.processingLogId
      status: failed
      errorMessage.$: $.error.Cause
    End: true
```

**Workflow input schema:**

```json
{
  "eventId": "uuid — the inbound_webhook_events row ID",
  "tenantId": "text — tenant scope",
  "connectionId": "uuid — the integration_connections row ID",
  "eventType": "text — e.g. NEW_JOB, UPDATE_PURCHASE_ORDER",
  "providerEntityId": "text — the CW entity UUID",
  "processingLogId": "uuid — the external_processing_log row ID"
}
```

### 3.5 Tool Capability Definitions

Each tool is a registered More0 capability. The capability manifest tells More0's registry what the tool does, its input/output schemas, and how to invoke it (HTTP endpoint).

#### Tool: `claims-manager.crunchwork-fetch`

| Field | Value |
|-------|-------|
| **Type** | `tool` |
| **Method** | `execute` |
| **Transport** | HTTP POST |
| **Endpoint** | `{CLAIMS_MANAGER_BASE_URL}/api/v1/tools/crunchwork/fetch` |
| **Auth** | `X-Tool-Secret` header (shared secret) |

**Input schema:**
```json
{
  "connectionId": { "type": "string", "description": "integration_connections row ID" },
  "providerEntityType": { "type": "string", "enum": ["job","claim","purchase_order","invoice","task","message","attachment","report"] },
  "providerEntityId": { "type": "string", "description": "CW entity UUID" }
}
```

**Output schema:**
```json
{
  "payload": { "type": "object", "description": "Full CW API response JSON" }
}
```

**Behavior:** Maps `providerEntityType` to the correct `CrunchworkService` method (`getJob`, `getClaim`, `getPurchaseOrder`, etc.), calls the CW API, returns the raw response.

---

#### Tool: `claims-manager.external-object-upsert`

| Field | Value |
|-------|-------|
| **Type** | `tool` |
| **Method** | `execute` |
| **Endpoint** | `{CLAIMS_MANAGER_BASE_URL}/api/v1/tools/external-objects/upsert` |

**Input schema:**
```json
{
  "tenantId": { "type": "string" },
  "connectionId": { "type": "string" },
  "providerCode": { "type": "string" },
  "providerEntityType": { "type": "string" },
  "providerEntityId": { "type": "string" },
  "normalizedEntityType": { "type": "string" },
  "payload": { "type": "object" },
  "sourceEventId": { "type": "string", "nullable": true }
}
```

**Output schema:**
```json
{
  "externalObject": { "type": "object", "description": "The upserted external_objects row" },
  "isNew": { "type": "boolean" },
  "hashChanged": { "type": "boolean" }
}
```

**Behavior:** Computes SHA-256 payload hash, upserts `external_objects`, creates `external_object_versions` row if hash changed.

---

#### Tool: `claims-manager.entity-mapper`

| Field | Value |
|-------|-------|
| **Type** | `tool` |
| **Method** | `execute` |
| **Endpoint** | `{CLAIMS_MANAGER_BASE_URL}/api/v1/tools/mappers/{entityType}` |

**Input schema:**
```json
{
  "externalObjectId": { "type": "string" },
  "tenantId": { "type": "string" },
  "connectionId": { "type": "string" },
  "entityType": { "type": "string", "enum": ["job","claim","purchase_order","invoice","task","message","attachment"] }
}
```

**Output schema:**
```json
{
  "internalEntityId": { "type": "string", "description": "UUID of the created/updated internal record" },
  "internalEntityType": { "type": "string" }
}
```

**Behavior:** Loads the `external_objects` row, dispatches to the appropriate CW mapper (Job, Claim, PO, etc.), creates/updates internal records, upserts `external_links`.

---

#### Tool: `claims-manager.processing-log-update`

| Field | Value |
|-------|-------|
| **Type** | `tool` |
| **Method** | `execute` |
| **Endpoint** | `{CLAIMS_MANAGER_BASE_URL}/api/v1/tools/processing-log/update` |

**Input schema:**
```json
{
  "processingLogId": { "type": "string" },
  "status": { "type": "string", "enum": ["processing","completed","failed"] },
  "externalObjectId": { "type": "string", "nullable": true },
  "errorMessage": { "type": "string", "nullable": true }
}
```

**Behavior:** Updates the `external_processing_log` row with status, timestamps, and optional error info.

### 3.6 More0 Retry vs claims-manager Retry

| Concern | Who handles it | How |
|---------|---------------|-----|
| CW API returns 429 / 5xx | `CrunchworkService` (NestJS) handles **immediate** HTTP-level retries (existing `requestWithRetry` logic: token refresh on 401, exponential backoff on 5xx, respect `Retry-After` on 429). | |
| CW API is completely unreachable | More0 workflow retries the `fetch-external-entity` **step** (3 attempts, 30s base, 2x backoff). | |
| NestJS tool endpoint returns error | More0 workflow retries the step per its retry config. | |
| Mapping logic fails (bad data) | More0 `catch` routes to `mark-failed`. No automatic retry — likely a data issue requiring manual intervention or code fix. | |
| More0 itself is down when NestJS tries to invoke | NestJS `triggerWorkflow` catches the error, marks the `external_processing_log` as `workflow_invoke_failed`. A scheduled reconciliation can re-invoke failed triggers. | |

### 3.7 Future More0 Workflows

The `process-webhook-event` workflow is the first. Future workflows that will be defined as the product evolves:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `claims-manager.new-job-onboarding` | After a new job is projected into internal tables | Assign staff, create tasks, send notifications, schedule initial appointment |
| `claims-manager.quote-review` | After a new quote is projected | Route to approver, wait for decision, update CW with result |
| `claims-manager.po-approval` | After a new PO is projected | Approval workflow with escalation |
| `claims-manager.reconciliation` | Scheduled (cron) | Scan for stale external objects, trigger re-fetch, fill missing FKs |

These are documented here for context but are **out of scope** for the current implementation plan.

### 3.8 Capability Definition Files

More0 capabilities are defined as JSON manifests and imported into the registry.

#### Reference examples

The codebase includes a complete set of More0 capability definition examples at:

```
apps/examples/definitions/
```

These are real More0 definitions covering every capability type. Claims-manager's definitions must follow the same structure. Key examples to study:

| Example File | Type | What to Learn |
|-------------|------|---------------|
| `app.json` | application | `app_key`, `exposure.publish` patterns, top-level `methods` |
| `tools/tool.os.web.json` | tool | Multi-method tool (`search`, `fetch`) with full input/output JSON schemas, `semantics`, `channels`, and `implementation` block |
| `tools/tool.system.workflows.json` | tool | How ASL workflows are described — `create` method's `asl` input field documents the full ASL contract (StartAt, States, state types: Task, Choice, Parallel, Pass, Wait, Fail, Succeed) |
| `agents/assistant/agent.json` | agent | Agent binding to prompt + model + tools, `tool_loop_config`, `execute` method with sync/stream channels |
| `workers/system.worker.workflow.cap.json` | worker | How the workflow engine worker subscribes to type `workflow` and executes via `workflow-engine` backend |
| `workers/system.worker.tool.cap.json` | worker | How the tool worker subscribes and dispatches |

#### Capability manifest structure (common fields)

Every More0 capability manifest has this shape (derived from the examples):

```json
{
  "name": "string — FQCN, e.g. 'tool.claims-manager.crunchwork-fetch'",
  "display_name": "string — human-readable name",
  "type": "string — 'tool' | 'workflow' | 'agent' | 'worker' | 'application' | ...",
  "version": "string — semver, e.g. '1.0.0'",
  "description": "string — what this capability does",
  "tags": ["array", "of", "discovery", "tags"],
  "methods": {
    "method_name": {
      "description": "string",
      "input": { "type": "object", "properties": { ... }, "required": [...] },
      "output": { "type": "object", "properties": { ... } },
      "semantics": "'work' | 'query' | 'informational'",
      "channels": ["sync", "async", "stream"]
    }
  },
  "implementation": {
    "kind": "string — 'ts-module' | 'data' | 'http' | ...",
    "entrypoint": "string — file path or URL",
    "execution": {
      "kind": "string — 'inline-ts' | 'workflow-engine' | 'agent-runner' | 'container' | ..."
    }
  }
}
```

For claims-manager **tools** backed by NestJS HTTP endpoints, the `implementation` block would use an HTTP transport kind pointing to the NestJS base URL, rather than an inline TypeScript module. The exact `implementation.kind` for HTTP-backed tools should be confirmed against More0's current schema — the examples show `ts-module` and `data` kinds, but an `http` or `external-http` kind may exist or need to be used.

#### Claims-manager definition files

```
apps/api/more0/
├── app.json                                    # Application manifest (app_key: claims-manager)
├── workflows/
│   └── process-webhook-event.json              # ASL workflow definition
└── definitions/
    ├── crunchwork-fetch.json                   # Tool capability manifest
    ├── external-object-upsert.json             # Tool capability manifest
    ├── entity-mapper.json                      # Tool capability manifest
    └── processing-log-update.json              # Tool capability manifest
```

These definitions must conform to the same JSON structure as the examples in `apps/examples/definitions/`. Import into the registry is done via More0's CLI or compose flows during deployment.

#### Claims-manager `app.json` (draft)

```json
{
  "name": "claims-manager",
  "display_name": "Claims Manager",
  "type": "application",
  "version": "1.0.0",
  "description": "Property insurance claims management system — workflows, tools, and integrations for builder operations",
  "tags": ["app", "claims", "insurance", "builder"],
  "app_key": "claims-manager",
  "exposure": {
    "publish": [
      { "match": "workflow.claims-manager.*" },
      { "match": "tool.claims-manager.*" }
    ]
  },
  "methods": {
    "info": {
      "description": "Application metadata",
      "semantics": "query",
      "channels": ["sync"],
      "output": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "version": { "type": "string" },
          "app_key": { "type": "string" }
        }
      }
    }
  }
}
```

#### Claims-manager tool definition example: `crunchwork-fetch.json` (draft)

```json
{
  "name": "tool.claims-manager.crunchwork-fetch",
  "display_name": "Crunchwork Entity Fetch",
  "type": "tool",
  "version": "1.0.0",
  "description": "Fetch a full entity from the Crunchwork Insurance REST API by entity type and ID. Supports job, claim, purchase_order, invoice, task, message, attachment, report.",
  "tags": ["claims-manager", "crunchwork", "fetch", "integration"],
  "methods": {
    "info": {
      "description": "Tool capability metadata",
      "channels": ["sync"]
    },
    "execute": {
      "description": "Fetch an entity from the Crunchwork API using the specified connection credentials",
      "input": {
        "type": "object",
        "properties": {
          "connectionId": {
            "type": "string",
            "description": "integration_connections row ID for CW credentials and base URL"
          },
          "providerEntityType": {
            "type": "string",
            "enum": ["job","claim","purchase_order","invoice","task","message","attachment","report"],
            "description": "The CW entity type to fetch"
          },
          "providerEntityId": {
            "type": "string",
            "description": "The CW entity UUID"
          }
        },
        "required": ["connectionId", "providerEntityType", "providerEntityId"]
      },
      "output": {
        "type": "object",
        "properties": {
          "payload": {
            "type": "object",
            "description": "Full CW API response JSON"
          },
          "error": {
            "type": "string",
            "description": "Error message if fetch failed"
          }
        }
      },
      "semantics": "work",
      "channels": ["sync"]
    }
  },
  "implementation": {
    "kind": "http",
    "entrypoint": "{CLAIMS_MANAGER_BASE_URL}/api/v1/tools/crunchwork/fetch",
    "execution": {
      "kind": "external-http",
      "config": {
        "method": "POST",
        "headers": {
          "X-Tool-Secret": "{TOOL_SECRET}"
        }
      }
    }
  }
}
```

> **Note:** The `implementation.kind` and `execution.kind` values for HTTP-backed tools (`http`, `external-http`) are drafts. The exact values must be confirmed against More0's current capability schema. The examples in `apps/examples/definitions/` use `ts-module` / `inline-ts` (for code running inside More0 workers) and `data` / `agent-runner` (for agents). An HTTP transport kind may use a different convention.

---

## 4. Cross-Cutting Concerns

| Concern | Convention |
|---------|-----------|
| **Logging** | Every log message is prefixed with `PackageName.methodName —`. |
| **Param style** | Methods with >2 params receive a single object parameter. |
| **Tenant scoping** | All queries include `tenantId` filtering. |
| **Package manager** | `pnpm` only. |
| **Platform** | Windows — no POSIX-only shell commands. |
| **Existing code** | Do not modify code unrelated to the sub-plan's scope. |
| **Tests** | Each sub-plan specifies its own test strategy. |
| **Migrations** | All Drizzle schema changes get a `drizzle-kit generate` migration. Migrations are additive. |
| **More0 integration** | NestJS services are exposed to More0 as tools via HTTP endpoints. Workflow definitions are ASL. Invocations use `@more0ai/client` SDK. Capability manifests are JSON files under `apps/api/more0/`. |

---

## 5. Files Frequently Referenced

| Alias | Path |
|-------|------|
| **Schema** | `apps/api/src/database/schema/index.ts` |
| **Repo index** | `apps/api/src/database/repositories/index.ts` |
| **DB module** | `apps/api/src/database/database.module.ts` |
| **App module** | `apps/api/src/app.module.ts` |
| **CW service** | `apps/api/src/crunchwork/crunchwork.service.ts` |
| **CW auth** | `apps/api/src/crunchwork/crunchwork-auth.service.ts` |
| **Webhooks controller** | `apps/api/src/modules/webhooks/webhooks.controller.ts` |
| **Webhooks service** | `apps/api/src/modules/webhooks/webhooks.service.ts` |
| **Webhook processor** | `apps/api/src/modules/webhooks/webhook-processor.service.ts` |
| **Webhook alias controller** | `apps/api/src/modules/webhooks/webhook-alias.controller.ts` |
| **Webhook HMAC** | `apps/api/src/modules/webhooks/webhook-hmac.service.ts` |
| **Migrations dir** | `apps/api/src/database/migrations-drizzle/` |
| **More0 definitions** | `apps/api/more0/` |
| **More0 workflow ASL** | `apps/api/more0/workflows/process-webhook-event.json` |
| **More0 tool manifests** | `apps/api/more0/definitions/*.json` |
| **More0 config** | `apps/api/src/config/more0.config.ts` |
| **More0 service** | `apps/api/src/more0/more0.service.ts` |
| **Tool endpoints** | `apps/api/src/modules/external/tools/external-tools.controller.ts` |
| **More0 example defs** | `apps/examples/definitions/` — reference examples for all capability types |
| **Example app.json** | `apps/examples/definitions/app.json` — reference for application manifests |
| **Example tool** | `apps/examples/definitions/tools/tool.os.web.json` — reference for tool schemas |
| **Example workflow tool** | `apps/examples/definitions/tools/tool.system.workflows.json` — ASL contract reference |
| **Example worker** | `apps/examples/definitions/workers/system.worker.workflow.cap.json` — workflow worker |

---

## 6. Glossary

| Term | Meaning |
|------|---------|
| CW | Crunchwork — the external insurer-side system |
| External object | A row in `external_objects` representing the latest fetched state of a CW entity |
| External link | A row in `external_links` mapping an external object to an internal business record |
| Projection / mapping | The process of converting an external CW payload into internal table columns |
| Connection | A row in `integration_connections` — one tenant's configured credentials for one provider environment |
| More0 workflow | A durable ASL (AWS States Language–style) state machine executed by More0's workflow engine. Supports retry, catch, branching, parallel, wait, and checkpointing natively. |
| More0 tool | A registered capability backed by a NestJS HTTP endpoint that More0 workers can invoke. Each tool has a manifest defining its input/output schemas and transport. |
| Invocation | A More0 SDK call that starts or interacts with a workflow/tool. Async invocations return a `runId` immediately. |
| Capability | More0's universal abstraction — a registered, versioned unit with a type (workflow, tool, agent), methods, and schemas. |
| Registry | More0's authoritative store for capability metadata, resolution, and routing of invocations to workers. |
| Worker | A More0 runtime process that subscribes to the registry, advertises capabilities it can run, and executes invocations delivered over NATS. |
| FQCN | Fully Qualified Capability Name — e.g. `claims-manager.process-webhook-event`. Ties a capability to its application. |
| `app_key` | The More0 application identifier. Claims-manager registers as `claims-manager`. |
| ASL | Amazon States Language — the JSON-based state machine definition format More0's workflow engine uses. |
