# 33f — Finance: Accounts Receivable & Accounts Payable

## Objective

Implement the Finance section pages — Accounts Receivable (AR) and Accounts Payable (AP). These are **accounting-oriented views** of existing entities (Invoices for AR, Bills for AP), not new entity types.

---

## Prerequisites

- Invoices module implemented (plan 12) — AR data source
- Bills module implemented (plan 33e) — AP data source
- Plan 33a (Sidebar Restructure) complete — `/finance/ar` and `/finance/ap` routes exist as stubs

---

## Domain Context

The Finance section provides an **accountant's perspective** on money flowing in and out:

- **Accounts Receivable (AR)**: Invoices this tenant has sent to upstream parties — money owed *to* this tenant
- **Accounts Payable (AP)**: Bills this tenant has received from downstream parties — money owed *by* this tenant

Both views emphasize:
- **Aging buckets** (Current, 30-day, 60-day, 90-day+)
- **Payment status** tracking
- **Totals and summaries** (outstanding, overdue, paid)
- **Due date management**

These pages reuse the same underlying data but present it in a finance-oriented layout rather than the job-centric layout of the Invoices and Bills list pages.

---

## Steps

### 33f.1 API — Finance Endpoints

Rather than a separate module, add a `FinanceController` or extend existing modules with finance-specific query endpoints.

**Option chosen:** New `FinanceModule` that injects existing repositories.

**Directory:** `apps/api/src/modules/finance/`

```
finance/
├── finance.module.ts
├── finance.controller.ts
└── finance.service.ts
```

#### Controller Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/finance/ar` | AR summary — invoices grouped by aging bucket |
| `GET` | `/finance/ar/list` | AR detailed list — invoices with payment context |
| `GET` | `/finance/ap` | AP summary — bills grouped by aging bucket |
| `GET` | `/finance/ap/list` | AP detailed list — bills with payment context |
| `GET` | `/finance/summary` | Combined AR/AP dashboard summary |

#### Aging Bucket Logic

```typescript
interface AgingBucket {
  label: string;         // 'Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'
  count: number;
  totalAmount: number;
}

interface FinanceSummary {
  ar: {
    totalOutstanding: number;
    totalOverdue: number;
    totalPaid: number;
    buckets: AgingBucket[];
  };
  ap: {
    totalOutstanding: number;
    totalOverdue: number;
    totalPaid: number;
    buckets: AgingBucket[];
  };
}
```

#### Aging Query (AR example)

```sql
SELECT
  CASE
    WHEN i.issue_date >= NOW() - INTERVAL '30 days' THEN 'Current'
    WHEN i.issue_date >= NOW() - INTERVAL '60 days' THEN '1-30 days'
    WHEN i.issue_date >= NOW() - INTERVAL '90 days' THEN '31-60 days'
    WHEN i.issue_date >= NOW() - INTERVAL '120 days' THEN '61-90 days'
    ELSE '90+ days'
  END AS bucket,
  COUNT(*) AS count,
  COALESCE(SUM(i.total_amount), 0) AS total_amount
FROM invoices i
LEFT JOIN lookup_values ls ON i.status_lookup_id = ls.id
WHERE i.tenant_id = $1
  AND i.is_deleted = false
  AND ls.name NOT IN ('Paid', 'Cancelled')  -- exclude settled invoices
GROUP BY bucket
ORDER BY bucket;
```

AP uses the same logic against the `bills` table with `due_date` for aging.

---

### 33f.2 Frontend — API Client

Add methods to `apps/frontend/src/lib/api-client.ts`:

```typescript
async getFinanceAr(): Promise<FinanceArSummary>;
async getFinanceArList(params?: { page?; limit?; sort?; bucket?; status? }): Promise<PaginatedResponse<Invoice>>;
async getFinanceAp(): Promise<FinanceApSummary>;
async getFinanceApList(params?: { page?; limit?; sort?; bucket?; status? }): Promise<PaginatedResponse<Bill>>;
async getFinanceSummary(): Promise<FinanceSummary>;
```

---

### 33f.3 Frontend — Accounts Receivable Page

Replace stub at `apps/frontend/src/app/(app)/finance/ar/page.tsx`.

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/finance/ar/page.tsx` | Server page — fetch AR summary |
| `app/(app)/finance/ar/actions.ts` | Server actions for list refetch |
| `components/finance/ArPageClient.tsx` | Client layout |
| `components/finance/AgingSummaryCards.tsx` | Shared aging bucket cards |
| `components/finance/FinanceTable.tsx` | Shared table for AR/AP with aging columns |

**Layout:**

1. **Summary bar** at top — total outstanding, total overdue, total paid (this period)
2. **Aging bucket cards** — 5 cards (Current through 90+) showing count + amount; clickable to filter the table
3. **Invoice table** — columns: Invoice #, Customer/Job, Issue Date, Amount, Status, Age, Actions
4. Click-through on any invoice row → `/invoices/[id]` (existing invoice detail page)

---

### 33f.4 Frontend — Accounts Payable Page

Replace stub at `apps/frontend/src/app/(app)/finance/ap/page.tsx`.

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/finance/ap/page.tsx` | Server page — fetch AP summary |
| `app/(app)/finance/ap/actions.ts` | Server actions |
| `components/finance/ApPageClient.tsx` | Client layout |

**Layout:**

1. **Summary bar** — total outstanding, total overdue, total paid
2. **Aging bucket cards** — same as AR but against bills
3. **Bills table** — columns: Bill #, Vendor, Job, PO #, Due Date, Amount, Payment Status, Age, Actions
4. Click-through on any bill row → `/bills/[id]`

---

### 33f.5 Shared Finance Components

**`components/finance/AgingSummaryCards.tsx`**

Reusable component that renders 5 aging bucket cards:

```tsx
interface AgingSummaryCardsProps {
  buckets: AgingBucket[];
  activeBucket?: string;
  onBucketClick: (bucket: string | null) => void;
}
```

**`components/finance/FinanceTable.tsx`**

Shared table component that accepts a list of invoices or bills and renders with finance-specific columns (aging, payment status badges, amount formatting).

---

### 33f.6 Dashboard Integration

The `/finance/summary` endpoint is used by the Dashboard (plan 33j) to show:
- AR total outstanding
- AP total outstanding
- Overdue counts for both

---

## Acceptance Criteria

- [ ] `GET /finance/ar` returns aging bucket summary for invoices
- [ ] `GET /finance/ap` returns aging bucket summary for bills
- [ ] `GET /finance/summary` returns combined AR/AP overview
- [ ] AR page shows aging cards + filterable invoice table
- [ ] AP page shows aging cards + filterable bills table
- [ ] Clicking an aging bucket filters the table to that bucket
- [ ] Click-through to invoice/bill detail pages works
- [ ] Aging calculation is correct (based on issue date for AR, due date for AP)
- [ ] Summary totals exclude cancelled/paid items

---

*Next: 33g_TASKS_POLYMORPHIC_EXPANSION.md*
