# 27e — More0 Workflow Refinement

**Date:** 2026-04-09
**Status:** Implementation Plan
**Depends on:** [27c](27c_MORE0_TOOL_ENDPOINTS.md), [27d](27d_ENTITY_MAPPER_SERVICE.md)

---

## 0. Purpose

Refine the `process-webhook-event` ASL workflow definition and register the supporting More0 capability manifests for each tool endpoint. The existing workflow (in `apps/api/more0/workflows/process-webhook-event.json`) is functional but needs updates to match the v2 transaction boundaries and the enhanced tool endpoint contracts.

---

## 1. Current ASL vs. v2 ASL

### 1.1 What Changes

| ASL Step | v1 Behavior | v2 Behavior |
|----------|-------------|-------------|
| `resolve-entity-type` | Pass state — derives entity type from event type | Unchanged |
| `fetch-external-entity` | Calls `crunchwork-fetch` tool | Unchanged (retry config already correct) |
| `upsert-external-object` | Calls `external-object-upsert` tool | Now also passes `eventId`; receives `processingLogId` in response |
| `project-to-internal` | Calls `entity-mapper` tool | Now also passes `processingLogId` for atomic log update |
| `mark-completed` | Calls `processing-log-update` (status = completed) | Removed — completion is handled atomically in `project-to-internal` |
| `mark-failed` | Calls `processing-log-update` (status = failed) | Enhanced — also updates `inbound_webhook_events` status |

### 1.2 Why Remove `mark-completed`

In v2, the `entity-mapper` tool endpoint (doc 27c) updates the processing log to `completed` inside the same transaction as the internal projection (TX-3). A separate `mark-completed` step would be redundant and would re-introduce a gap where the projection committed but the log status didn't.

The `mark-failed` step is retained because failure routing crosses step boundaries — it needs to capture the error from whichever step failed.

---

## 2. Revised ASL Definition

```json
{
  "Comment": "Process Webhook Event v2: fetch from CW, store external object, project to internal tables",
  "StartAt": "resolve-entity-type",
  "States": {
    "resolve-entity-type": {
      "Type": "Pass",
      "Comment": "Map event type string to CW entity type",
      "Parameters": {
        "eventId.$": "$.eventId",
        "tenantId.$": "$.tenantId",
        "connectionId.$": "$.connectionId",
        "providerId.$": "$.providerId",
        "eventType.$": "$.eventType",
        "providerEntityType.$": "$.providerEntityType",
        "providerEntityId.$": "$.providerEntityId",
        "eventTimestamp.$": "$.eventTimestamp"
      },
      "Next": "fetch-external-entity"
    },

    "fetch-external-entity": {
      "Type": "Task",
      "Comment": "Fetch full entity payload from Crunchwork API",
      "Resource": "claims-manager.crunchwork-fetch",
      "Parameters": {
        "connectionId.$": "$.connectionId",
        "providerEntityType.$": "$.providerEntityType",
        "providerEntityId.$": "$.providerEntityId"
      },
      "ResultPath": "$.fetchResult",
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "MaxAttempts": 3,
          "IntervalSeconds": 30,
          "BackoffRate": 2
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "mark-fetch-failed"
        }
      ],
      "Next": "upsert-external-object"
    },

    "upsert-external-object": {
      "Type": "Task",
      "Comment": "Store external object + versions + processing log + mark event fetched (TX-2)",
      "Resource": "claims-manager.external-object-upsert",
      "Parameters": {
        "tenantId.$": "$.tenantId",
        "connectionId.$": "$.connectionId",
        "providerId.$": "$.providerId",
        "providerCode": "crunchwork",
        "providerEntityType.$": "$.providerEntityType",
        "providerEntityId.$": "$.providerEntityId",
        "payload.$": "$.fetchResult.payload",
        "sourceEventId.$": "$.eventId",
        "sourceEventType.$": "$.eventType",
        "sourceEventTimestamp.$": "$.eventTimestamp",
        "eventId.$": "$.eventId"
      },
      "ResultPath": "$.upsertResult",
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "MaxAttempts": 2,
          "IntervalSeconds": 5,
          "BackoffRate": 2
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "mark-upsert-failed"
        }
      ],
      "Next": "project-to-internal"
    },

    "project-to-internal": {
      "Type": "Task",
      "Comment": "Map external object to internal tables + update processing log (TX-3)",
      "Resource": "claims-manager.entity-mapper",
      "Method": "map",
      "Parameters": {
        "entityType.$": "$.providerEntityType",
        "externalObjectId.$": "$.upsertResult.externalObject.id",
        "tenantId.$": "$.tenantId",
        "connectionId.$": "$.connectionId",
        "processingLogId.$": "$.upsertResult.processingLogId"
      },
      "ResultPath": "$.mapResult",
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "MaxAttempts": 2,
          "IntervalSeconds": 10,
          "BackoffRate": 2
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "mark-projection-failed"
        }
      ],
      "End": true
    },

    "mark-fetch-failed": {
      "Type": "Task",
      "Comment": "Record fetch failure on webhook event",
      "Resource": "claims-manager.processing-log-update",
      "Parameters": {
        "processingLogId": "n/a",
        "status": "failed",
        "errorMessage.$": "$.error.Cause",
        "eventId.$": "$.eventId",
        "eventStatus": "fetch_failed"
      },
      "End": true
    },

    "mark-upsert-failed": {
      "Type": "Task",
      "Comment": "Record external object upsert failure",
      "Resource": "claims-manager.processing-log-update",
      "Parameters": {
        "processingLogId": "n/a",
        "status": "failed",
        "errorMessage.$": "$.error.Cause",
        "eventId.$": "$.eventId",
        "eventStatus": "upsert_failed"
      },
      "End": true
    },

    "mark-projection-failed": {
      "Type": "Task",
      "Comment": "Record projection failure — external object was stored but internal mapping failed",
      "Resource": "claims-manager.processing-log-update",
      "Parameters": {
        "processingLogId.$": "$.upsertResult.processingLogId",
        "status": "failed",
        "errorMessage.$": "$.error.Cause",
        "eventId.$": "$.eventId",
        "eventStatus": "projection_failed"
      },
      "End": true
    }
  }
}
```

---

## 3. Key Differences from v1 ASL

### 3.1 Entity Type Passed In, Not Derived

In v1, the `resolve-entity-type` step tried to derive the entity type from the event type using `States.Format`. In v2, `providerEntityType` is resolved by the NestJS dispatcher (in `dispatchToMore0`) and passed as input. The `resolve-entity-type` step becomes a pure pass-through that structures the state.

### 3.2 `processingLogId` Flows Through the Pipeline

The `upsert-external-object` step now returns `processingLogId` in its result (because it creates the processing log entry inside TX-2). This ID is then passed to `project-to-internal` so the mapper can update the log atomically.

### 3.3 Granular Failure States

Instead of a single `mark-failed` catch-all, each step has its own failure state:

| Failure State | Triggered By | Event Status Set |
|---|---|---|
| `mark-fetch-failed` | `fetch-external-entity` catch | `fetch_failed` |
| `mark-upsert-failed` | `upsert-external-object` catch | `upsert_failed` |
| `mark-projection-failed` | `project-to-internal` catch | `projection_failed` |

This gives precise visibility into where the pipeline failed for each event.

### 3.4 No `mark-completed` Step

Completion is handled atomically inside the `project-to-internal` tool endpoint (TX-3). The workflow ends naturally when `project-to-internal` succeeds.

---

## 4. Capability Manifests

Each tool endpoint must be registered as a More0 capability. Create manifest files in `apps/api/more0/capabilities/`:

### 4.1 `crunchwork-fetch.json`

```json
{
  "name": "claims-manager.crunchwork-fetch",
  "display_name": "Crunchwork Entity Fetch",
  "type": "tool",
  "version": "1.0.0",
  "description": "Fetches a full entity payload from the Crunchwork API by type and ID",
  "methods": {
    "execute": {
      "description": "Fetch entity from Crunchwork",
      "input": {
        "type": "object",
        "properties": {
          "connectionId": { "type": "string" },
          "providerEntityType": { "type": "string" },
          "providerEntityId": { "type": "string" }
        },
        "required": ["connectionId", "providerEntityType", "providerEntityId"]
      },
      "output": {
        "type": "object",
        "properties": {
          "payload": { "type": "object" }
        }
      },
      "semantics": "read"
    }
  },
  "implementation": {
    "kind": "http",
    "config": {
      "method": "POST",
      "url": "${CLAIMS_MANAGER_API_URL}/api/v1/tools/crunchwork/fetch"
    }
  }
}
```

### 4.2 `external-object-upsert.json`

```json
{
  "name": "claims-manager.external-object-upsert",
  "display_name": "External Object Upsert",
  "type": "tool",
  "version": "2.0.0",
  "description": "Upserts external object with versions, creates processing log, and marks webhook event as fetched (TX-2)",
  "methods": {
    "execute": {
      "description": "Upsert external object from fetched payload",
      "input": {
        "type": "object",
        "properties": {
          "tenantId": { "type": "string" },
          "connectionId": { "type": "string" },
          "providerId": { "type": "string" },
          "providerCode": { "type": "string" },
          "providerEntityType": { "type": "string" },
          "providerEntityId": { "type": "string" },
          "payload": { "type": "object" },
          "sourceEventId": { "type": "string" },
          "sourceEventType": { "type": "string" },
          "sourceEventTimestamp": { "type": "string" },
          "eventId": { "type": "string" }
        },
        "required": ["tenantId", "connectionId", "providerCode", "providerEntityType", "providerEntityId", "payload", "eventId"]
      },
      "output": {
        "type": "object",
        "properties": {
          "externalObject": { "type": "object" },
          "processingLogId": { "type": "string" },
          "isNew": { "type": "boolean" },
          "hashChanged": { "type": "boolean" }
        }
      },
      "semantics": "work"
    }
  },
  "implementation": {
    "kind": "http",
    "config": {
      "method": "POST",
      "url": "${CLAIMS_MANAGER_API_URL}/api/v1/tools/external-objects/upsert"
    }
  }
}
```

### 4.3 `entity-mapper.json`

```json
{
  "name": "claims-manager.entity-mapper",
  "display_name": "Entity Mapper",
  "type": "tool",
  "version": "2.0.0",
  "description": "Projects an external object to internal business tables and updates the processing log (TX-3)",
  "methods": {
    "map": {
      "description": "Map external object to internal entity",
      "input": {
        "type": "object",
        "properties": {
          "entityType": { "type": "string" },
          "externalObjectId": { "type": "string" },
          "tenantId": { "type": "string" },
          "connectionId": { "type": "string" },
          "processingLogId": { "type": "string" }
        },
        "required": ["entityType", "externalObjectId", "tenantId", "connectionId"]
      },
      "output": {
        "type": "object",
        "properties": {
          "internalEntityId": { "type": "string" },
          "internalEntityType": { "type": "string" }
        }
      },
      "semantics": "work"
    }
  },
  "implementation": {
    "kind": "http",
    "config": {
      "method": "POST",
      "url": "${CLAIMS_MANAGER_API_URL}/api/v1/tools/mappers/${entityType}"
    }
  }
}
```

### 4.4 `processing-log-update.json`

```json
{
  "name": "claims-manager.processing-log-update",
  "display_name": "Processing Log Update",
  "type": "tool",
  "version": "2.0.0",
  "description": "Updates the processing log and optionally the webhook event status",
  "methods": {
    "execute": {
      "description": "Update processing log status",
      "input": {
        "type": "object",
        "properties": {
          "processingLogId": { "type": "string" },
          "status": { "type": "string" },
          "externalObjectId": { "type": "string" },
          "errorMessage": { "type": "string" },
          "eventId": { "type": "string" },
          "eventStatus": { "type": "string" }
        },
        "required": ["processingLogId", "status"]
      },
      "output": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean" }
        }
      },
      "semantics": "work"
    }
  },
  "implementation": {
    "kind": "http",
    "config": {
      "method": "POST",
      "url": "${CLAIMS_MANAGER_API_URL}/api/v1/tools/processing-log/update"
    }
  }
}
```

---

## 5. Workflow Manifest Update

Update `apps/api/more0/workflows/process-webhook-event.json` with:

1. The revised ASL from section 2.
2. Updated `input` schema to include `providerId`, `providerEntityType`, and `eventTimestamp`.
3. Version bump to `2.0.0`.
4. Updated `dependencies` listing the four tool capabilities.

```json
{
  "name": "workflow.claims-manager.process-webhook-event",
  "display_name": "Process Webhook Event",
  "type": "workflow",
  "version": "2.0.0",
  "description": "Fetch entity from CW, store as external object, project to internal tables. Retry-safe, idempotent.",
  "tags": ["claims-manager", "webhook", "processing"],
  "methods": {
    "execute": {
      "description": "Execute the webhook event processing workflow",
      "input": {
        "type": "object",
        "properties": {
          "eventId": { "type": "string" },
          "tenantId": { "type": "string" },
          "connectionId": { "type": "string" },
          "providerId": { "type": "string" },
          "eventType": { "type": "string" },
          "providerEntityType": { "type": "string" },
          "providerEntityId": { "type": "string" },
          "eventTimestamp": { "type": "string" },
          "isRetry": { "type": "boolean" }
        },
        "required": ["eventId", "tenantId", "connectionId", "eventType", "providerEntityType", "providerEntityId"]
      },
      "semantics": "work",
      "channels": ["async"]
    }
  },
  "dependencies": {
    "tools": [
      "claims-manager.crunchwork-fetch",
      "claims-manager.external-object-upsert",
      "claims-manager.entity-mapper",
      "claims-manager.processing-log-update"
    ]
  },
  "implementation": {
    "kind": "workflow-asl",
    "entrypoint": "asl.json",
    "execution": {
      "kind": "workflow-engine"
    }
  }
}
```

---

## 6. File Changes Summary

| File | Change |
|------|--------|
| `apps/api/more0/workflows/process-webhook-event.json` | Replace with v2 manifest + ASL |
| `apps/api/more0/capabilities/crunchwork-fetch.json` | **NEW** — tool capability manifest |
| `apps/api/more0/capabilities/external-object-upsert.json` | **NEW** — tool capability manifest |
| `apps/api/more0/capabilities/entity-mapper.json` | **NEW** — tool capability manifest |
| `apps/api/more0/capabilities/processing-log-update.json` | **NEW** — tool capability manifest |

---

## Acceptance Criteria

- [ ] Workflow ASL updated with granular failure states and v2 parameter flow
- [ ] `processingLogId` flows from `upsert-external-object` result to `project-to-internal` input
- [ ] `mark-completed` step removed (handled in TX-3)
- [ ] Three granular `mark-*-failed` states replace single `mark-failed`
- [ ] Four capability manifests created in `apps/api/more0/capabilities/`
- [ ] Workflow manifest version bumped to 2.0.0
- [ ] Input schema includes `providerId`, `providerEntityType`, `eventTimestamp`, `isRetry`
- [ ] Retry policies tuned: fetch (3x/30s), upsert (2x/5s), mapper (2x/10s)
- [ ] ASL validates against More0 workflow schema
- [ ] End-to-end test: invoke workflow in mock mode, verify state transitions
