# 33g — Tasks: Polymorphic Entity Expansion

## Objective

Expand the Tasks entity from its current two-parent model (`claim_id OR job_id`) to a polymorphic model where tasks can be attached to **any entity type** in the system. Build a standalone cross-entity Tasks page.

---

## Prerequisites

- Tasks module implemented (plan 14) — existing schema and API
- Plan 33a (Sidebar Restructure) complete — `/tasks` route exists as stub
- New entity tables exist (plans 33b–33e) — Work Orders, RFQs, Proposals, Bills

---

## Domain Context

Tasks are cross-cutting work items that can be attached to virtually any entity. Examples:

- "Follow up on overdue invoice" → attached to an Invoice
- "Review sub-contractor proposal" → attached to a Proposal
- "Schedule site visit for job" → attached to a Job
- "Verify AP payment sent" → attached to a Bill (AP context)
- "Chase outstanding claim documentation" → attached to a Claim
- "Confirm appointment details" → attached to an Appointment
- "Update contact details" → attached to a Contact

The current schema restricts tasks to `claim_id OR job_id`. This expansion allows tasks on: Job, Claim, Quote, Work Order, Invoice, RFQ, Proposal, PO, Bill, Appointment, Contact.

---

## Steps

### 33g.1 Schema Change

**File:** `apps/api/src/database/schema/index.ts`

#### Current schema (tasks table)

```typescript
// Current — to be modified
claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
// ...
check('chk_task_parent', sql`claim_id IS NOT NULL OR job_id IS NOT NULL`),
```

#### New schema

Add polymorphic columns alongside the existing FK columns:

```typescript
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    taskTypeLookupId: uuid('task_type_lookup_id'),

    // Polymorphic parent — required
    relatedEntityType: text('related_entity_type').notNull(),
    relatedEntityId: uuid('related_entity_id').notNull(),

    // Denormalized FKs for fast scoping (auto-populated by service layer)
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    priority: text('priority').notNull().default('Low'),
    status: text('status').notNull().default('Open'),
    taskPayload: jsonb('task_payload').notNull().default({}),
    assignedToUserId: text('assigned_to_user_id'),
    assignedToExternalReference: text('assigned_to_external_reference'),
    createdByUserId: text('created_by_user_id'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_task_entity_type',
      sql`related_entity_type IN (
        'Job', 'Claim', 'Quote', 'WorkOrder', 'Invoice',
        'RFQ', 'Proposal', 'PurchaseOrder', 'Bill',
        'Appointment', 'Contact'
      )`,
    ),
    check('chk_task_priority', sql`priority IN ('Low','Medium','High','Critical')`),
    check('chk_task_status', sql`status IN ('Open','Completed','Failed')`),
    index('idx_tasks_entity').on(t.tenantId, t.relatedEntityType, t.relatedEntityId),
    index('idx_tasks_claim').on(t.tenantId, t.claimId),
    index('idx_tasks_job').on(t.tenantId, t.jobId),
    index('idx_tasks_status').on(t.tenantId, t.status),
    index('idx_tasks_due_date').on(t.tenantId, t.dueDate),
    index('idx_tasks_assigned').on(t.tenantId, t.assignedToUserId),
  ],
);
```

**Key changes:**
- Added `related_entity_type` (TEXT NOT NULL) and `related_entity_id` (UUID NOT NULL)
- **Dropped** `chk_task_parent` constraint (was: `claim_id IS NOT NULL OR job_id IS NOT NULL`)
- **Kept** `claim_id` and `job_id` as optional denormalized FKs for fast job/claim scoping
- Added `chk_task_entity_type` check constraint for valid entity types
- Added composite index on `(tenant_id, related_entity_type, related_entity_id)`
- Added index on `due_date` for calendar/schedule queries
- Added index on `assigned_to_user_id` for "my tasks" queries

---

### 33g.2 Migration

The migration must:

1. Add `related_entity_type` and `related_entity_id` columns (initially nullable)
2. Backfill existing rows:
   ```sql
   UPDATE tasks SET related_entity_type = 'Job', related_entity_id = job_id WHERE job_id IS NOT NULL;
   UPDATE tasks SET related_entity_type = 'Claim', related_entity_id = claim_id WHERE claim_id IS NOT NULL AND related_entity_type IS NULL;
   ```
3. Set columns to NOT NULL after backfill
4. Drop old `chk_task_parent` constraint
5. Add new `chk_task_entity_type` constraint
6. Add new indexes

**Migration file:** Generate via `drizzle-kit generate`, then manually edit the SQL to include the backfill step.

---

### 33g.3 Service Layer Changes

**File:** `apps/api/src/modules/tasks/tasks.service.ts`

#### Create — auto-populate denormalized FKs

```typescript
async create(params: { data: Record<string, unknown> }) {
  const tenantId = this.tenantContext.getTenantId();
  const { relatedEntityType, relatedEntityId, ...rest } = params.data;

  // Auto-populate denormalized FKs
  let claimId: string | null = null;
  let jobId: string | null = null;

  if (relatedEntityType === 'Job') {
    jobId = relatedEntityId as string;
  } else if (relatedEntityType === 'Claim') {
    claimId = relatedEntityId as string;
  } else {
    // For other entity types, resolve the parent job/claim if applicable
    const parentIds = await this.resolveParentIds(relatedEntityType, relatedEntityId);
    claimId = parentIds.claimId;
    jobId = parentIds.jobId;
  }

  return this.tasksRepo.create({
    tenantId,
    data: { ...rest, relatedEntityType, relatedEntityId, claimId, jobId },
  });
}
```

#### resolveParentIds — walk up entity hierarchy

```typescript
private async resolveParentIds(
  entityType: string,
  entityId: string,
): Promise<{ claimId: string | null; jobId: string | null }> {
  // For entities that belong to a job (Quote, PO, Invoice, WorkOrder, RFQ, Proposal, Bill, Appointment):
  // look up the entity's job_id and claim_id
  // For Contact: no parent resolution needed
  // Implementation queries the relevant repository for the entity's parent IDs
}
```

#### FindAll — support entity type filtering

```typescript
async findAll(params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  status?: string;
  priority?: string;
  entityType?: string;
  entityId?: string;
  assignedToUserId?: string;
  dueBefore?: string;
  dueAfter?: string;
}) {
  // Build query with optional filters on related_entity_type, related_entity_id,
  // assigned_to_user_id, due_date range, status, priority
}
```

---

### 33g.4 Controller Changes

**File:** `apps/api/src/modules/tasks/tasks.controller.ts`

Update endpoints:

| Method | Route | Description |
|---|---|---|
| `GET` | `/tasks` | List tasks — supports `entityType`, `entityId`, `assignedToUserId`, `dueBefore`, `dueAfter`, `priority` query params |
| `GET` | `/tasks/job/:jobId` | List tasks for a job (kept for backward compat) |
| `GET` | `/tasks/claim/:claimId` | List tasks for a claim (kept for backward compat) |
| `GET` | `/tasks/entity/:entityType/:entityId` | List tasks for any entity |
| `GET` | `/tasks/my` | List tasks assigned to the current user |
| `GET` | `/tasks/overdue` | List overdue tasks (due_date < now, status = Open) |
| `GET` | `/tasks/:id` | Get task detail |
| `POST` | `/tasks` | Create task — body must include `relatedEntityType` + `relatedEntityId` |
| `POST` | `/tasks/:id` | Update task |

---

### 33g.5 Frontend — API Client

Update methods in `apps/frontend/src/lib/api-client.ts`:

```typescript
async getTasks(params?: {
  page?; limit?; search?; sort?; status?; priority?;
  entityType?; entityId?; assignedToUserId?; dueBefore?; dueAfter?;
});
async getEntityTasks(entityType: string, entityId: string);
async getMyTasks();
async getOverdueTasks();
async createTask(data: Record<string, unknown>);  // requires relatedEntityType + relatedEntityId
async updateTask(id: string, data: Record<string, unknown>);
```

---

### 33g.6 Frontend — Standalone Tasks Page

Replace stub at `apps/frontend/src/app/(app)/tasks/page.tsx`.

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/tasks/page.tsx` | Server page |
| `app/(app)/tasks/actions.ts` | Server actions |
| `components/tasks/TasksPageClient.tsx` | Client wrapper |
| `components/tasks/TasksListClient.tsx` | List with advanced filters |
| `components/tasks/TaskFormDrawer.tsx` | Create/edit task drawer |

**List features:**

- **Filter toolbar:** Entity type dropdown, status, priority, assignee, due date range
- **View modes:** "All Tasks", "My Tasks", "Overdue"
- **Columns:** Name, Entity (type + reference), Status, Priority, Assignee, Due Date, Updated
- **Entity column:** Shows entity type badge + clickable link to entity detail (e.g. "Job #123", "Invoice #456")
- **Inline actions:** Mark complete, change priority, reassign

**Create task drawer:**

- Entity type selector (dropdown)
- Entity search/picker (type-ahead search scoped to selected entity type)
- Name, description, priority, due date, assignee

---

### 33g.7 Reusable Task Widget for Entity Detail Pages

**File:** `apps/frontend/src/components/shared/EntityTasksPanel.tsx`

A reusable component that can be embedded as a tab or section in any entity detail page:

```tsx
interface EntityTasksPanelProps {
  entityType: string;
  entityId: string;
}
```

This component:
- Fetches tasks for the given entity via `getEntityTasks(entityType, entityId)`
- Shows task list with inline create
- Used in Job detail (replaces existing `JobTasksTab`), Claim detail, Quote detail, PO detail, Invoice detail, Work Order detail, RFQ detail, Proposal detail, Bill detail

---

### 33g.8 Update Existing Job Detail Tab

Replace `components/jobs/tabs/JobTasksTab.tsx` to use the new `EntityTasksPanel`:

```tsx
export function JobTasksTab({ jobId }: { jobId: string }) {
  return <EntityTasksPanel entityType="Job" entityId={jobId} />;
}
```

Same for Claim detail — add/update tasks tab to use `EntityTasksPanel`.

---

## Acceptance Criteria

- [ ] Tasks schema supports `related_entity_type` + `related_entity_id` polymorphic parent
- [ ] Migration backfills existing tasks (job-linked → `Job`, claim-linked → `Claim`)
- [ ] Denormalized `claim_id`/`job_id` auto-populated on task creation
- [ ] `GET /tasks` supports filtering by entity type, entity ID, assignee, due date, priority
- [ ] `GET /tasks/entity/:type/:id` returns tasks for any supported entity
- [ ] `GET /tasks/my` returns current user's assigned tasks
- [ ] `GET /tasks/overdue` returns tasks past due date
- [ ] Standalone Tasks page at `/tasks` with full filter/sort/create capabilities
- [ ] Reusable `EntityTasksPanel` works in any entity detail page
- [ ] Existing Job/Claim task tabs continue to function
- [ ] Check constraint prevents invalid entity types

---

*Next: 33h_OPERATIONS_STANDALONE_PAGES.md*
