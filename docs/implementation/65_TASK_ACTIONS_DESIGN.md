# 65 — Task Actions: Workflow-Driven CTA for Dashboard & Task UI

**Project:** Claims Manager + More0 Ensure  
**Date:** 2026-09-12  
**Status:** Plan  
**Depends on:** 64 (Job Kind Capabilities), 55a (Workflow Invoke Enrichment), 55f (Workflow Phase Status Sync)  
**Related repos:** `claims-manager` (apps/api, apps/frontend, apps/claims-mcp), `more0-ensure` (definitions/workflows)

---

## Objective

When a user sees a task on the dashboard (or in the task list / task drawer), provide a **call-to-action (CTA) button** that opens the specific UI required to fulfil that task — e.g. "Schedule Repairs" opens the Appointment drawer pre-populated with job context. The action metadata is **authored by More0 Ensure workflows** (the business-logic owner) and **stored + served by claims-manager** (the operational layer).

---

## Architecture Principles

| Principle | Application |
|-----------|-------------|
| **More0 Ensure is the brain** | Workflows define what action each task requires and when tasks are fulfilled |
| **Claims-manager is the system of record** | Stores `action` on the task, serves it to UI and API consumers, fires domain events |
| **Frontend is a thin renderer** | Maps `actionKey` → drawer / navigation; no business logic |
| **Transport: claims-mcp** | More0 Ensure calls back via Streamable HTTP MCP (existing `tool.claims.create_task`, `tool.claims.update_task`) |
| **Separate auth domains** | Do **not** assume More0 Ensure and Claims Manager share an IdP. Each call direction authenticates to the **receiver’s** trust model (see 65d). |

---

## The `TaskAction` Contract

```typescript
interface TaskAction {
  /** Semantic action identifier — stable, not a UI concept */
  actionKey: string;
  /** Human-readable CTA label */
  label: string;
  /** Context the frontend needs to execute the action */
  context: {
    entityType?: string;   // target entity type (Appointment, Invoice, Quote…)
    entityId?: string;     // target entity ID — present when entity already exists
    jobId?: string;
    claimId?: string;
  };
}
```

`actionKey` values (initial set):

| `actionKey` | Meaning | Frontend behaviour |
|-------------|---------|-------------------|
| `create_appointment` | Create an appointment for the job | Open `AppointmentFormDrawer` |
| `create_invoice` | Create an invoice (e.g. excess) | Open `InvoiceFormDrawer` |
| `review_entity` | Navigate to an existing entity to review it | Navigate to entity detail page |
| `view_entity` | Navigate to an existing entity | Navigate to entity detail page |
| `upload_document` | Upload a document to the job | Open `JournalFileUploadDrawer` |
| `publish_quote` | Publish / submit an estimate | Navigate to quote detail page |

---

## Task Type → Action Mapping (authored in More0 Ensure ASL)

| Task name (from ASL) | `actionKey` | `label` | Notes |
|----------------------|-------------|---------|-------|
| Call to Schedule | `create_appointment` | Schedule appointment | Assessment + Make Safe |
| Book Site Attendance | `create_appointment` | Book site attendance | Assessment + Make Safe |
| Book Accommodation | `create_appointment` | Book accommodation | — |
| Schedule Repairs | `create_appointment` | Schedule repairs | Works |
| Commence Repairs | `view_entity` | Go to job | Navigate to job detail |
| Send Scope/Contract | `view_entity` | View scope | Navigate to job |
| Signed Scope/Contract | `view_entity` | View scope | Navigate to job |
| Send Excess | `create_invoice` | Create excess invoice | Works |
| Collect Excess | `create_invoice` | Collect excess | Works |
| Submission Required | `publish_quote` | Submit estimate | Assessment + Make Safe |
| Upload Completion Certificate | `upload_document` | Upload certificate | Works |
| Repair Update | `view_entity` | Update job | Navigate to job |
| Quote Review Required | `review_entity` | Review estimate | Navigate to quote |
| Submit Report | `view_entity` | Go to report | Navigate to job reports tab |
| Follow-up with Customer | `view_entity` | View job | Navigate to job |
| Customer Complaint | `view_entity` | View job | Navigate to job |
| Check out Date Changes | `view_entity` | View job | Navigate to job |
| Make Safe Required | `view_entity` | View job | Navigate to job |
| Specialist Required | `view_entity` | View job | Navigate to job |

Tasks without a mapped action (or tasks created outside workflows) render no CTA — existing behaviour preserved.

---

## Sub-Plans

| Plan | Title | Scope |
|------|-------|-------|
| **65a** | Claims-manager: persist and serve `action` on tasks | API schema, service, dashboard, types |
| **65b** | More0 Ensure: attach `action` to workflow task creation | ASL changes across all three workflows |
| **65c** | Frontend: task action CTA renderer | Renderer, InboxRow, TaskDetailDrawer |
| **65d** | Infrastructure: expose claims-mcp to auth'd external clients | Terraform, LB, DNS; CM-side M2M client for Ensure (cross-system auth) |

---

## Data Flow

```
More0 Ensure workflow
  │  ASL state: tool.claims.create_task with action in data
  ▼
McpClientService
  │  Token from Claims Manager’s auth (receiver trust) — not Ensure’s IdP
  │  Streamable HTTP + Bearer JWT
  ▼
claims-mcp (public, JWT-protected by CM auth)
  │  create_task tool → POST /tasks
  ▼
claims-manager API
  │  TasksService.create() — persists action in task_payload jsonb
  ▼
Dashboard / Task list
  │  API response includes action on Task / DashboardInboxItem
  ▼
Frontend
  │  task-action-renderer.ts: actionKey → drawer or navigation
  ▼
User clicks CTA → drawer opens / page navigates
  │  User completes the action (creates appointment, uploads doc, etc.)
  ▼
Service emits domain event (appointment.scheduled, document.uploaded, …)
  │  Token from Ensure’s auth (receiver trust) — not CM’s IdP
  ▼
More0 Ensure receives event via webhook
  │  Workflow resumes, evaluates conditions
  │  Calls tool.claims.update_task { status: 'Completed' } when fulfilled
  ▼
Task marked complete — cycle ends
```

---

## Testing Strategy

1. **Unit**: `resolveTaskAction()` — reads action from stored task, returns it or null
2. **Unit**: `renderTaskAction()` — maps actionKey → drawer/navigate
3. **Integration**: Create task via MCP with action payload → verify API returns action
4. **Integration**: Dashboard inbox includes action on task items
5. **E2E**: Click CTA on dashboard task → drawer opens with correct pre-populated data
6. **E2E**: Complete action → domain event fires → workflow completes task

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| More0 Ensure creates task before claims-mcp accepts `action` field | `action` is stored inside `taskPayload` jsonb — no schema migration needed; unrecognised fields pass through |
| Unknown `actionKey` in frontend | `renderTaskAction` returns null → no CTA shown, graceful fallback |
| claims-mcp public exposure | JWT required against **CM auth**; rate limits on LB; dedicated CM-side M2M client for Ensure |
| Separate IdPs | Each direction uses credentials for the **receiver**; do not hard-wire a shared auth-server assumption |
| ASL `context` has stale jobId | Context is resolved at task creation time from workflow state; if job changes, task is recreated by workflow |
