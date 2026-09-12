# 65a — Claims-Manager: Persist and Serve `action` on Tasks

**Parent plan:** 65 (Task Actions Design)  
**Scope:** `apps/api`, `apps/frontend/src/types`  
**Status:** Plan

---

## Objective

Accept a `TaskAction` object when creating/updating tasks, persist it inside the existing `task_payload` jsonb column, and serve it on task API responses and dashboard inbox items. No database migration required.

---

## 1. Storage Convention

The `tasks.task_payload` column is `jsonb NOT NULL DEFAULT '{}'`. We store the action as `task_payload.action`:

```jsonb
{
  "action": {
    "actionKey": "create_appointment",
    "label": "Schedule repairs",
    "context": {
      "entityType": "Appointment",
      "jobId": "uuid-here",
      "claimId": "uuid-here"
    }
  },
  // …other payload fields (CW data, etc.)
}
```

No migration. No new column. The `action` key is a new convention inside the existing jsonb.

---

## 2. Shared Type

### File: `apps/api/src/modules/tasks/task-action.types.ts` (new)

```typescript
/**
 * Action descriptor attached to a task by the workflow engine.
 * Tells the frontend what UI to open when the user acts on this task.
 */
export interface TaskAction {
  /** Semantic action key — stable identifier, not a UI concept. */
  actionKey: string;
  /** Human-readable CTA button label. */
  label: string;
  /** Context the frontend needs to execute the action. */
  context: {
    entityType?: string;
    entityId?: string;
    jobId?: string;
    claimId?: string;
  };
}
```

---

## 3. TasksService Changes

### File: `apps/api/src/modules/tasks/tasks.service.ts`

### 3a. `create()` — accept and persist action

In the `create` method, extract `action` from `params.body` and merge into `taskPayload`:

```typescript
// After existing field parsing, before building insertData:
const action = params.body.action as TaskAction | undefined;

const insertData: TaskInsert = {
  // …existing fields…
  taskPayload: {
    ...(action ? { action } : {}),
  },
};
```

The `action` is validated only by shape (it's authored by the workflow engine, not user input). If absent, `taskPayload` is `{}` as today.

### 3b. `update()` — allow action updates

In the `update` method, if `params.body.action` is present, merge it into the existing `taskPayload`:

```typescript
if (params.body.action !== undefined) {
  const existingPayload = (existing.taskPayload ?? {}) as Record<string, unknown>;
  localPatch.taskPayload = {
    ...existingPayload,
    action: params.body.action,
  };
}
```

### 3c. Response shaping — surface `action` as a top-level field

Add a helper that reads `action` from `taskPayload` and attaches it to the response:

```typescript
private shapeTaskWithAction<T extends TaskViewRow>(task: T): T & { action?: TaskAction } {
  const shaped = this.shapeTask(task);
  const payload = (shaped.taskPayload ?? {}) as Record<string, unknown>;
  const action = payload.action as TaskAction | undefined;
  if (action?.actionKey) {
    return { ...shaped, action };
  }
  return shaped;
}
```

Apply in `findAll`, `findOne`, `findByJob`, `findByClaim`, `findByEntity`, `findOverdue`, and after `create` / `update`.

---

## 4. DashboardService Changes

### File: `apps/api/src/modules/dashboard/dashboard.service.ts`

### 4a. Update `DashboardInboxItem` interface

```typescript
export interface DashboardInboxItem {
  id: string;
  entityType: string;
  title: string;
  subtitle?: string;
  status?: string;
  dueAt?: string | null;
  href: string;
  jobId?: string | null;
  action?: TaskAction | null;  // ← new
}
```

### 4b. Update `taskItem()` method

```typescript
private taskItem(
  task: TaskRow,
  jobById: Map<string, JobNumberSource>,
): DashboardInboxItem {
  const payload = (task.taskPayload ?? {}) as Record<string, unknown>;
  const action = payload.action as TaskAction | undefined;
  return {
    id: task.id,
    entityType: 'task',
    title: humanizeTitle('Task', task.name),
    subtitle: jobSubtitle(jobById.get(task.jobId ?? '')),
    status: task.priority ?? task.status ?? undefined,
    dueAt: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    href: `/tasks?open=${task.id}`,  // also fix: link to specific task
    jobId: task.jobId,
    action: action?.actionKey ? action : null,
  };
}
```

Note: the `href` is also fixed from the current catch-all `/tasks?status=Open&overdue=true` to a task-specific link.

---

## 5. Frontend Type Updates

### File: `apps/frontend/src/types/api.ts`

Add `TaskAction` interface and optional `action` field:

```typescript
export interface TaskAction {
  actionKey: string;
  label: string;
  context: {
    entityType?: string;
    entityId?: string;
    jobId?: string;
    claimId?: string;
  };
}

export interface Task {
  // …existing fields…
  action?: TaskAction | null;  // ← new
}

export interface DashboardInboxItem {
  // …existing fields…
  action?: TaskAction | null;  // ← new
}
```

---

## 6. Outbound Event Enrichment (optional, low priority)

Add optional `originTaskId` to `OutboundEventsService` convenience methods so domain events carry a reference to the task that triggered them. This is informational — More0 Ensure already matches by `taskName` filter, not by task ID.

### File: `apps/api/src/modules/outbound-events/outbound-events.service.ts`

Add `originTaskId?: string | null` to the payload of:
- `emitAppointmentScheduled`
- `emitDocumentUploaded`
- `emitQuotePublished`
- `emitInvoiceApproved`

No behavioural change. The field is available for future workflow refinements.

---

## Files Changed Summary

| File | Change |
|------|--------|
| **New:** `apps/api/src/modules/tasks/task-action.types.ts` | `TaskAction` interface |
| `apps/api/src/modules/tasks/tasks.service.ts` | Persist action in create/update; surface on responses |
| `apps/api/src/modules/dashboard/dashboard.service.ts` | Include action on `DashboardInboxItem`; fix task href |
| `apps/frontend/src/types/api.ts` | `TaskAction` type; `action?` on `Task` and `DashboardInboxItem` |
| `apps/api/src/modules/outbound-events/outbound-events.service.ts` | Optional `originTaskId` on event payloads |

---

## Testing

1. **Unit**: Create task with `body.action = { actionKey: 'create_appointment', label: 'Schedule', context: { jobId: '...' } }` → verify `taskPayload.action` persisted
2. **Unit**: Fetch task → verify `action` present as top-level field in response
3. **Unit**: Create task without action → verify `action` is absent/null in response
4. **Unit**: Dashboard `taskItem()` → verify `action` and fixed `href` on inbox items
5. **Unit**: Update task with new action → verify merged into `taskPayload`
