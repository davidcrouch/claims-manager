# 65c — Frontend: Task Action CTA Renderer

**Parent plan:** 65 (Task Actions Design)  
**Scope:** `apps/frontend`  
**Status:** Plan  
**Depends on:** 65a (API serves `action` on Task and DashboardInboxItem)

---

## Objective

When a task has an `action`, render a CTA button that opens the appropriate UI (drawer or page navigation) with pre-populated context. Three touch-points: dashboard `InboxRow`, task detail drawer, and task list rows.

---

## 1. Task Action Renderer

### File: `apps/frontend/src/lib/task-action-renderer.ts` (new)

A thin, pure mapping from `actionKey` → UI behaviour. This is the **only** place the frontend maps action keys to components/routes.

```typescript
import type { TaskAction } from '@/types/api';

export type ActionRenderResult =
  | { type: 'drawer'; component: string; props: Record<string, unknown> }
  | { type: 'navigate'; href: string };

/**
 * Resolve a URL for entity detail, given entityType and optional entityId.
 * Falls back to the job page when no specific entity is targeted.
 */
function entityHref(ctx: TaskAction['context']): string {
  const { entityType, entityId, jobId } = ctx;

  if (entityId) {
    switch (entityType) {
      case 'Quote':
        return `/quotes/${entityId}`;
      case 'Invoice':
        return `/invoices/${entityId}`;
      case 'WorkOrder':
        return `/work-orders/${entityId}`;
      case 'Proposal':
        return `/proposals/${entityId}`;
      case 'RFQ':
        return `/rfqs/${entityId}`;
      case 'Bill':
        return `/bills/${entityId}`;
      case 'Report':
        return jobId ? `/jobs/${jobId}?tab=reports` : `/reports/${entityId}`;
    }
  }

  // Default: navigate to the job
  if (jobId) return `/jobs/${jobId}`;
  return '/tasks';
}

const ACTION_RENDERERS: Record<
  string,
  (ctx: TaskAction['context']) => ActionRenderResult
> = {
  create_appointment: (ctx) => ({
    type: 'drawer',
    component: 'AppointmentFormDrawer',
    props: { jobId: ctx.jobId, claimId: ctx.claimId },
  }),

  create_invoice: (ctx) => ({
    type: 'drawer',
    component: 'InvoiceFormDrawer',
    props: { jobId: ctx.jobId, claimId: ctx.claimId },
  }),

  upload_document: (ctx) => ({
    type: 'drawer',
    component: 'JournalFileUploadDrawer',
    props: { jobId: ctx.jobId },
  }),

  review_entity: (ctx) => ({
    type: 'navigate',
    href: entityHref(ctx),
  }),

  view_entity: (ctx) => ({
    type: 'navigate',
    href: entityHref(ctx),
  }),

  publish_quote: (ctx) => ({
    type: 'navigate',
    href: ctx.entityId
      ? `/quotes/${ctx.entityId}`
      : ctx.jobId
        ? `/jobs/${ctx.jobId}?tab=quotes`
        : '/quotes',
  }),
};

/**
 * Resolve how to render a task action CTA.
 * Returns null for unknown actionKeys — caller should show no CTA.
 */
export function renderTaskAction(
  action: TaskAction,
): ActionRenderResult | null {
  const renderer = ACTION_RENDERERS[action.actionKey];
  return renderer ? renderer(action.context) : null;
}
```

---

## 2. Drawer Registry Updates

### File: `apps/frontend/src/lib/ai/drawer-registry.ts`

Register `InvoiceFormDrawer` if not already present (it's used by `create_invoice` actions):

```typescript
InvoiceFormDrawer: {
  title: 'Create Invoice',
  loader: () =>
    import('@/components/forms/InvoiceFormDrawer').then((m) => ({
      default: m.InvoiceFormDrawer as unknown as ComponentType<CanvasDrawerProps>,
    })),
},
```

Verify these are already registered (they are, per current codebase):
- `AppointmentFormDrawer` ✓
- `JournalFileUploadDrawer` ✓

---

## 3. Dashboard InboxRow — CTA Button

### File: `apps/frontend/src/components/dashboard/InboxRow.tsx`

Add an action button that appears when `item.action` is present and the item is a task.

### Changes

1. Import `renderTaskAction` and `useEntityDrawer`
2. Import `useRouter` from `next/navigation`
3. Add a CTA button inside the row, right-aligned before the due date

```tsx
// Inside InboxRow component, after existing content:
{item.action && (() => {
  const result = renderTaskAction(item.action);
  if (!result) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (result.type === 'drawer') {
      openEntityDrawer({ component: result.component, props: result.props });
    } else {
      router.push(result.href);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="shrink-0 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
    >
      {item.action.label}
    </button>
  );
})()}
```

**Behaviour:**
- Clicking the **row** still opens the task detail (existing `<Link href={item.href}>`)
- Clicking the **CTA button** opens the drawer or navigates (stopPropagation prevents the row link from firing)
- Tasks without an action render exactly as today

### Layout adjustment

The CTA button sits between the subtitle row and the due date badge. The flex layout already supports this — add the button as a sibling of the due-date `<span>`.

---

## 4. Task Detail Drawer — Primary Action Button

### File: `apps/frontend/src/components/tasks/TaskDetailDrawer.tsx`

Add a primary action button at the top of the task detail, visible when `task.action` is set.

### Changes

Pass `task.action` through to `TaskFormDrawer` (which renders the task detail). Inside the form header area, render:

```tsx
{task?.action && (() => {
  const result = renderTaskAction(task.action);
  if (!result) return null;

  const handleAction = () => {
    if (result.type === 'drawer') {
      openEntityDrawer({ component: result.component, props: result.props });
    } else {
      router.push(result.href);
    }
  };

  return (
    <Button
      onClick={handleAction}
      className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-500"
    >
      <ExternalLink className="h-4 w-4" />
      {task.action.label}
    </Button>
  );
})()}
```

**Placement:** Below the task name, above the status/priority fields. Only shown for tasks with status `Open` or `In Progress` (no CTA for completed/cancelled tasks).

---

## 5. Task List Rows (optional enhancement)

### File: `apps/frontend/src/components/tasks/TasksListClient.tsx`

In the task table rows, add a subtle CTA icon-button in the task name cell when `task.action` is present. This is lower priority — the dashboard and drawer are the primary surfaces.

```tsx
{task.action && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      const result = renderTaskAction(task.action!);
      if (!result) return;
      if (result.type === 'drawer') {
        openEntityDrawer({ component: result.component, props: result.props });
      } else {
        router.push(result.href);
      }
    }}
    className="ml-1.5 inline-flex items-center text-blue-600 hover:text-blue-800"
    title={task.action.label}
  >
    <ExternalLink className="h-3.5 w-3.5" />
  </button>
)}
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| **New:** `apps/frontend/src/lib/task-action-renderer.ts` | `renderTaskAction()`, `entityHref()`, action renderers |
| `apps/frontend/src/lib/ai/drawer-registry.ts` | Register `InvoiceFormDrawer` |
| `apps/frontend/src/components/dashboard/InboxRow.tsx` | CTA button on task items |
| `apps/frontend/src/components/tasks/TaskDetailDrawer.tsx` | Primary action button |
| `apps/frontend/src/components/tasks/TasksListClient.tsx` | Optional CTA icon in task rows |

---

## Testing

1. **Unit**: `renderTaskAction({ actionKey: 'create_appointment', ... })` → returns `{ type: 'drawer', component: 'AppointmentFormDrawer', ... }`
2. **Unit**: `renderTaskAction({ actionKey: 'unknown_key', ... })` → returns `null`
3. **Unit**: `entityHref({ entityType: 'Quote', entityId: 'abc' })` → `/quotes/abc`
4. **Unit**: `entityHref({ entityType: 'Job', jobId: 'xyz' })` → `/jobs/xyz`
5. **Visual**: Dashboard task with action → CTA button visible, correct label
6. **Visual**: Dashboard task without action → no CTA, identical to current UI
7. **Visual**: Task detail drawer with action → primary button visible above fields
8. **Interactive**: Click CTA on "Schedule Repairs" → AppointmentFormDrawer opens with jobId pre-filled
9. **Interactive**: Click CTA on "Submit estimate" → navigates to quotes page for the job
