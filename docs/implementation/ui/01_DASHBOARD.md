# 01 — Dashboard

**Route:** `/dashboard`
**Sidebar:** Top-level (above groups)

---

## Layout

```
┌────────────────────────────────────────────────┐
│ KPI Cards (4-column grid)                       │
├────────────────────────────────────────────────┤
│ Recent Activity        │ Upcoming (sidebar)     │
│ (timeline feed)        │ Tasks due this week    │
│                        │ Appointments today     │
└────────────────────────┴───────────────────────┘
```

---

## KPI Cards

| Card | Data Source | Link |
|------|------------|------|
| Active Jobs | Count of jobs with active status | `/jobs?status=active` |
| Open Work Orders | Count of WOs with status ≠ completed | `/work-orders` |
| Pending Invoices | Invoices in Submitted status | `/invoices?status=submitted` |
| Overdue Tasks | Tasks past due date | `/tasks?filter=overdue` |

---

## Recent Activity Feed

Timeline-style list showing latest events across all entities:

| Field | Description |
|-------|-------------|
| Icon | Entity-type icon |
| Description | "Job MIL260121220-BMS2 status changed to In Progress" |
| Entity link | Click → entity detail |
| Timestamp | Relative (2h ago, yesterday) |
| User | Who triggered (or "System") |

**Sources:** Job status changes, new quotes, PO issued, invoice submitted, task completed, message received

---

## Upcoming Panel

**Tasks due this week:**

| Field | Description |
|-------|-------------|
| Name | Task name (link) |
| Due | Date (red if overdue) |
| Priority | Badge |
| Entity | Job/Claim ref |

**Appointments today:**

| Field | Description |
|-------|-------------|
| Title | Appointment name |
| Time | Start time |
| Location | On-site / Digital |
| Entity | Job ref |
