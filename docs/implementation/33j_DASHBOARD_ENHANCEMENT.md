# 33j — Dashboard Enhancement

## Objective

Update the Dashboard page to include clickable metric cards that navigate to the relevant list pages introduced in plan 33. Add new stats for the new entity types and make the dashboard a useful operational overview for the Contractor (Prime) role.

---

## Prerequisites

- All prior 33* plans complete — new entity pages exist and are functional
- Dashboard module exists (plan 21) — `GET /dashboard/stats`, `GET /dashboard/recent-activity`, `GET /dashboard/alerts`
- Finance endpoints exist (plan 33f) — `GET /finance/summary`

---

## Steps

### 33j.1 API — Extended Dashboard Stats

**File:** `apps/api/src/modules/dashboard/dashboard.service.ts`

Extend the `DashboardStatsDto` with new metrics:

```typescript
export class DashboardStatsDto {
  // Existing
  totalClaims: number;
  totalJobs: number;
  jobsByStatus: { status: string; count: number }[];
  pendingApprovals: number;
  openInvoices: number;
  openTasks: number;
  recentJobCount: number;

  // New
  openWorkOrders: number;
  pendingRfqs: number;
  pendingProposals: number;
  outstandingBills: number;
  overdueTaskCount: number;
  upcomingAppointments: number;  // next 7 days
  unreadMessages: number;

  // Finance summary
  arTotalOutstanding: number;
  apTotalOutstanding: number;
  arOverdueCount: number;
  apOverdueCount: number;
}
```

Update `getStats()` query to include the new counts:

```typescript
async getStats(): Promise<DashboardStatsDto> {
  const tenantId = this.tenantContext.getTenantId();

  const [
    /* existing queries */
    totalClaims, totalJobs, jobsByStatus, pendingApprovals,
    openInvoices, openTasks, recentJobCount,
    /* new queries */
    openWorkOrders, pendingRfqs, pendingProposals,
    outstandingBills, overdueTaskCount, upcomingAppointments,
    unreadMessages, financeSummary,
  ] = await Promise.all([
    /* existing */
    this.claimRepo.count({ where: { tenantId } }),
    this.jobRepo.count({ where: { tenantId } }),
    // ... (existing queries)

    /* new */
    this.workOrdersRepo.countByStatus({ tenantId, statuses: ['Open', 'In Progress'] }),
    this.rfqsRepo.countByStatus({ tenantId, statuses: ['Sent'] }),
    this.proposalsRepo.countByStatus({ tenantId, statuses: ['Under Review'] }),
    this.billsRepo.countUnpaid({ tenantId }),
    this.tasksRepo.countOverdue({ tenantId }),
    this.appointmentsRepo.countUpcoming({ tenantId, withinDays: 7 }),
    this.messagesRepo.countUnread({ tenantId }),
    this.financeService.getSummary({ tenantId }),
  ]);

  return {
    totalClaims, totalJobs, jobsByStatus, pendingApprovals,
    openInvoices, openTasks, recentJobCount,
    openWorkOrders, pendingRfqs, pendingProposals,
    outstandingBills, overdueTaskCount, upcomingAppointments,
    unreadMessages,
    arTotalOutstanding: financeSummary.ar.totalOutstanding,
    apTotalOutstanding: financeSummary.ap.totalOutstanding,
    arOverdueCount: financeSummary.ar.overdueCount,
    apOverdueCount: financeSummary.ap.overdueCount,
  };
}
```

---

### 33j.2 Frontend — Dashboard Layout

**File:** `apps/frontend/src/app/(app)/dashboard/page.tsx` and related components.

Reorganize the dashboard into sections matching the sidebar groups:

#### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  CUSTOMERS                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐│
│  │ Claims  │ │  Jobs   │ │Invoices │ │Work Orders││
│  │   42    │ │   18    │ │  7 open │ │  3 open   ││
│  └─────────┘ └─────────┘ └─────────┘ └───────────┘│
├─────────────────────────────────────────────────────┤
│  VENDORS                                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │  RFQs   │ │Proposals│ │  Bills  │               │
│  │ 2 pend  │ │ 4 review│ │ 5 outst │               │
│  └─────────┘ └─────────┘ └─────────┘               │
├─────────────────────────────────────────────────────┤
│  FINANCE                                            │
│  ┌──────────────┐ ┌──────────────┐                  │
│  │  AR Outstdng │ │  AP Outstdng │                  │
│  │  $124,500    │ │   $87,200    │                  │
│  │  3 overdue   │ │  2 overdue   │                  │
│  └──────────────┘ └──────────────┘                  │
├─────────────────────────────────────────────────────┤
│  OPERATIONS                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐│
│  │  Tasks  │ │ Appts   │ │Messages │ │ Overdue   ││
│  │ 12 open │ │ 3 next  │ │ 5 unread│ │ 4 tasks   ││
│  └─────────┘ └─────────┘ └─────────┘ └───────────┘│
├─────────────────────────────────────────────────────┤
│  RECENT ACTIVITY                                    │
│  (existing webhook-driven activity feed)            │
└─────────────────────────────────────────────────────┘
```

---

### 33j.3 Clickable Metric Cards

**File:** `apps/frontend/src/components/dashboard/MetricCard.tsx`

```tsx
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  href: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
}
```

Each card is a `Link` wrapping a styled card. Click navigates to the relevant list page with optional pre-applied filters:

| Card | Navigates To |
|---|---|
| Claims (total) | `/claims` |
| Jobs (total/by status) | `/jobs` |
| Invoices (open) | `/invoices?status=open` |
| Work Orders (open) | `/work-orders?status=open` |
| RFQs (pending) | `/rfqs?status=sent` |
| Proposals (review) | `/proposals?status=under-review` |
| Bills (outstanding) | `/bills?paymentStatus=unpaid` |
| AR Outstanding | `/finance/ar` |
| AP Outstanding | `/finance/ap` |
| Tasks (open) | `/tasks?status=Open` |
| Appointments (upcoming) | `/appointments?from=today` |
| Messages (unread) | `/messages?status=unread` |
| Overdue Tasks | `/tasks?overdue=true` |

---

### 33j.4 Dashboard Sections Component

**File:** `apps/frontend/src/components/dashboard/DashboardSection.tsx`

```tsx
interface DashboardSectionProps {
  title: string;
  children: React.ReactNode;
}

export function DashboardSection({ title, children }: DashboardSectionProps) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}
```

---

### 33j.5 Recent Activity Enhancement

The existing recent activity feed (from webhook events) can be enhanced with:
- Activity from new entity types (work order created, RFQ sent, proposal received, bill approved)
- Clickable activity items linking to the relevant entity detail page
- Entity type badge/icon for visual differentiation

---

## Acceptance Criteria

- [ ] Dashboard shows grouped metric sections (Customers, Vendors, Finance, Operations)
- [ ] All metric cards display correct, live counts from the API
- [ ] Clicking a metric card navigates to the correct list page with appropriate filter
- [ ] Finance section shows AR/AP outstanding totals in currency format
- [ ] Operations section shows overdue task count as a distinct warning-styled card
- [ ] Recent activity includes events for new entity types
- [ ] Dashboard caching still works (30-second TTL per plan 21)
- [ ] Dashboard loads fast — all stats fetched in a single `Promise.all`

---

## File Summary

| File | Purpose |
|---|---|
| `modules/dashboard/dashboard.service.ts` (API) | Extended stats query |
| `modules/dashboard/dto/dashboard-response.dto.ts` (API) | Updated DTO |
| `app/(app)/dashboard/page.tsx` | Updated server page |
| `components/dashboard/MetricCard.tsx` | Clickable metric card |
| `components/dashboard/DashboardSection.tsx` | Section wrapper |
| `components/dashboard/DashboardPageClient.tsx` | Updated client layout |

---

*This concludes the 33* plan series.*
