# 21 — Dashboard & Aggregation Endpoints

## Objective

Implement aggregation endpoints that power the frontend dashboard. These endpoints query the **local PostgreSQL database** (not the Crunchwork API) for a fast ops inbox.

The primary consumer is the user-focused dashboard (UI spec [`ui/01_DASHBOARD.md`](ui/01_DASHBOARD.md)): actionable queues, today’s schedule, overdue tasks, unread notifications, and a slim finance snapshot.

Plan 33j KPI tile expansion is **superseded**. Do not extend `/dashboard/stats` with org-wide Work Order / RFQ / Proposal / AR-AP count cards.

---

## Steps

### 21.1 Module Structure

```
src/modules/dashboard/
├── dashboard.module.ts
├── dashboard.controller.ts
├── dashboard.service.ts
├── dashboard.utils.ts
└── dashboard.utils.spec.ts
```

### 21.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/dashboard/inbox` | Ops inbox (primary) | All authenticated |
| `GET` | `/dashboard/stats` | Legacy KPI summary (kept for compatibility) | All authenticated |
| `GET` | `/dashboard/recent-activity` | Legacy webhook feed (unused by UI) | All authenticated |

`GET /dashboard/alerts` is **not** implemented. Unread work comes from the notifications module; pending actions are inbox queues.

### 21.3 Dashboard Inbox (primary)

```typescript
type InboxQueueKey =
  | 'workOrdersToAccept'
  | 'proposalsToReview'
  | 'rfqsAwaiting'
  | 'estimatesToPublish'
  | 'overdueTasks'
  | 'myTasks'
  | 'overdueInvoices'
  | 'overdueBills';

interface DashboardInboxItem {
  id: string;
  entityType: string;
  title: string;
  subtitle?: string;
  status?: string;
  dueAt?: string | null;
  href: string;
  jobId?: string | null;
}

interface DashboardInboxQueue {
  key: InboxQueueKey;
  title: string;
  count: number;
  href: string;
  items: DashboardInboxItem[];
}

interface DashboardInboxDto {
  generatedAt: string;
  snapshot: {
    activeJobs: number;
    unreadCount: number;
    unreadJobCount: number;
    arOverdueCount: number;
    apOverdueCount: number;
    arTotalOverdue: number;
    apTotalOverdue: number;
  };
  queues: DashboardInboxQueue[];
  today: DashboardInboxItem[];
  unread: DashboardInboxItem[];
}
```

#### 21.3.1 Queue status matching

Resolve statuses by **lookup name**, case-insensitive, with aliases:

| Queue | Lookup names |
|-------|----------------|
| Work orders to accept | `Received`, `Issued` |
| Proposals to review | `Received`, `Under Review` |
| RFQs waiting | `Sent` |
| Estimates to publish | `Approved` |

Include resolved lookup ids in queue `href` query strings (`?status={id}`) so list pages filter correctly. Preview cap ~5 items per queue. Humanize titles from document numbers / names / job refs — never raw UUIDs.

#### 21.3.2 My tasks

Pass `@CurrentUser().sub` into the service. Include the `myTasks` queue **only** when at least one open task has `assignedToUserId === sub`. Do not label other queues as personal.

#### 21.3.3 Today and unread

- **Today:** `ScheduleService.findEvents` for the local calendar day.
- **Unread:** notifications with `isRead=false`. Entity → route map matches the header bell (`job` → `/jobs/:id`, etc.).
- **Money waiting:** `FinanceService.getSummary()` overdue counts and amounts.
- **Active jobs:** jobs whose status name is not archived/closed/cancelled/declined.

All queue queries run in a single `Promise.all`. Log prefix: `dashboard:DashboardService.getInbox`.

### 21.4 Legacy Stats

`GET /dashboard/stats` remains for compatibility. Do not expand it to 33j fields. Existing fields (`totalClaims`, `totalJobs`, `jobsByStatus`, `pendingApprovals`, `openInvoices`, `openTasks`, `recentJobCount`) stay as-is.

### 21.5 Legacy Recent Activity

`GET /dashboard/recent-activity` remains for compatibility. The dashboard UI uses notifications instead.

### 21.6 Caching

Short-lived cache (30 seconds). Cache keys **must** include `tenantId`. Inbox cache also includes `userId` when My tasks is queried.

### 21.7 Data Source Clarification

Dashboard data comes from the **local PostgreSQL database**, not from Crunchwork API calls. The local DB is populated by:

1. **Dual-write on mutations** — when the frontend creates/updates entities, the API response is synced locally
2. **Webhook-driven sync** — inbound events trigger entity fetches and local persistence
3. **List endpoint sync** — when list views are accessed, results are synced locally

The dashboard is only as fresh as the local DB.

---

## Acceptance Criteria

- [x] `/dashboard/inbox` returns tenant-scoped queues, today, unread, and finance snapshot
- [x] Queue status matching uses lookup names (case-insensitive aliases)
- [x] `myTasks` appears only when the current user has assigned open tasks
- [x] Titles are human-readable (no raw UUIDs)
- [x] Dashboard data comes from local DB (fast, no external API calls)
- [x] Cache keys include `tenantId` — no cross-tenant leakage
- [x] `/dashboard/stats` and `/dashboard/recent-activity` remain for compatibility
- [x] `/dashboard/alerts` is not required (superseded by notifications + inbox queues)
