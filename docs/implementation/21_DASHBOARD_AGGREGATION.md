# 21 — Dashboard & Aggregation Endpoints

## Objective

Implement aggregation endpoints that power the frontend dashboard and summary views. These endpoints query the local database (not the Crunchwork API) for fast, pre-computed data.

---

## Steps

### 21.1 Module Structure

```
src/modules/dashboard/
├── dashboard.module.ts
├── dashboard.controller.ts
├── dashboard.service.ts
├── dto/
│   └── dashboard-response.dto.ts
└── interfaces/
    └── dashboard.interface.ts
```

### 21.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/dashboard/stats` | KPI summary stats | All authenticated |
| `GET` | `/dashboard/recent-activity` | Recent changes from webhooks | All authenticated |
| `GET` | `/dashboard/alerts` | Pending actions (approvals, tasks) | All authenticated |

### 21.3 Dashboard Stats

```typescript
export class DashboardStatsDto {
  totalClaims: number;
  totalJobs: number;
  jobsByStatus: { status: string; count: number }[];
  pendingApprovals: number;  // quotes pending approval
  openInvoices: number;
  openTasks: number;
  recentJobCount: number;    // last 7 days
}
```

### 21.3.1 "Pending Approvals" Definition

"Pending approvals" counts quotes whose status indicates they are awaiting insurer approval. The exact status value(s) depend on the Crunchwork quote status domain.

**Configuration approach:** Rather than hardcoding status names, define the approval-pending statuses as a configurable list per tenant:

```typescript
// Configurable via env or lookup_values metadata
const APPROVAL_PENDING_STATUSES = ['Submitted', 'Pending Approval', 'Awaiting Review'];
```

The query filters quotes by `status_lookup_id` where the associated `lookup_values.name` or `lookup_values.external_reference` matches the configured list. This list should be populated during lookup bootstrap (doc 07) and can be overridden per tenant via the `lookup_values.metadata` JSONB field.

Implementation queries:

```typescript
async getStats(): Promise<DashboardStatsDto> {
  const tenantId = this.tenantContext.getTenantId();

  const [
    totalClaims,
    totalJobs,
    jobsByStatus,
    pendingApprovals,
    openInvoices,
    openTasks,
  ] = await Promise.all([
    this.claimRepo.count({ where: { tenantId } }),
    this.jobRepo.count({ where: { tenantId } }),
    this.jobRepo
      .createQueryBuilder('job')
      .select('lookup.name', 'status')
      .addSelect('COUNT(*)', 'count')
      .leftJoin('lookup_values', 'lookup', 'job.status_lookup_id = lookup.id')
      .where('job.tenant_id = :tenantId', { tenantId })
      .groupBy('lookup.name')
      .getRawMany(),
    this.quoteRepo.count({
      where: { tenantId, /* status = pending approval */ },
    }),
    this.invoiceRepo.count({
      where: { tenantId, /* status = open/submitted */ },
    }),
    this.taskRepo.count({
      where: { tenantId, status: 'Open' },
    }),
  ]);

  return { totalClaims, totalJobs, jobsByStatus, pendingApprovals, openInvoices, openTasks };
}
```

### 21.4 Recent Activity

Powered by `inbound_webhook_events` table:

```typescript
async getRecentActivity(params: {
  limit?: number;
}): Promise<RecentActivityDto[]> {
  const events = await this.webhookRepo.find({
    where: {
      tenantId: this.tenantContext.getTenantId(),
      processingStatus: 'processed',
    },
    order: { createdAt: 'DESC' },
    take: params.limit || 20,
  });

  return events.map(event => ({
    id: event.id,
    type: event.eventType,
    entityId: event.payloadEntityId,
    timestamp: event.eventTimestamp,
    description: this.describeEvent(event),
  }));
}
```

### 21.5 Alerts

Aggregates pending actions that require user attention:

```typescript
async getAlerts(): Promise<AlertDto[]> {
  const alerts: AlertDto[] = [];

  // New jobs needing attention
  const newJobs = await this.getUnacknowledgedJobs();
  // Quotes pending approval
  const pendingQuotes = await this.getPendingQuotes();
  // Overdue tasks
  const overdueTasks = await this.getOverdueTasks();
  // Unacknowledged messages
  const unackedMessages = await this.getUnacknowledgedMessages();

  return [...newJobs, ...pendingQuotes, ...overdueTasks, ...unackedMessages];
}
```

### 21.6 Caching

Dashboard queries can be expensive. Implement short-lived caching (30-60 seconds) using NestJS `@nestjs/cache-manager`:

```typescript
@Get('stats')
@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
async getStats(): Promise<DashboardStatsDto> {
  return this.dashboardService.getStats();
}
```

---

### 21.7 Data Source Clarification

Dashboard data comes from the **local PostgreSQL database**, not from Crunchwork API calls. This ensures fast response times and avoids rate limiting. The local DB is populated by:

1. **Dual-write on mutations** — when the frontend creates/updates entities, the API response is synced locally
2. **Webhook-driven sync** — inbound events trigger entity fetches and local persistence
3. **List endpoint sync** — when list views are accessed, results are synced locally

The dashboard is only as fresh as the local DB. Data that has not yet been synced (e.g., entities created directly in Crunchwork by other systems) will not appear until a webhook fires or a sync occurs.

---

## Acceptance Criteria

- [ ] `/dashboard/stats` returns tenant-scoped KPI data
- [ ] `/dashboard/recent-activity` returns last N webhook events with descriptions
- [ ] `/dashboard/alerts` surfaces pending approvals, overdue tasks, new jobs
- [ ] Dashboard data comes from local DB (fast, no external API calls)
- [ ] Results cached for 30 seconds to reduce DB load
- [ ] Cache keys include `tenantId` — no cross-tenant leakage
- [ ] "Pending approvals" uses configurable status list, not hardcoded values
