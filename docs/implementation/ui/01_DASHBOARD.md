# 01 — Dashboard

**Route:** `/dashboard`
**Sidebar:** Top-level (above groups)
**API:** `GET /dashboard/inbox` (plan 21)

The dashboard is a **tenant ops inbox** — a morning worklist of records waiting on a decision, today’s calendar, overdue tasks, and unread notifications. It is **not** an org KPI scoreboard.

Queues are labelled honestly as **team** work (“Overdue tasks”, not “Your overdue tasks”). A **My tasks** subsection appears only when the logged-in user’s id matches `tasks.assignedToUserId`.

---

## Layout

```
Good morning, Dave                              Sat 8 Aug
4 items need a decision

┌ Active jobs ┐ ┌ Needs action ┐ ┌ Unread ┐ ┌ AR overdue ┐ ┌ AP overdue ┐
│     18      │ │      4       │ │   5    │ │   $12,400  │ │   $3,100   │
└─────────────┘ └──────────────┘ └────────┘ └────────────┘ └────────────┘

┌ Active jobs (18) ──────── View all ─┐  ┌ Today ──────────────┐
│ MIL-2601  In Progress  Repair       │  │ 09:00 Site visit    │
│ 12 Smith St, Richmond               │  ├ Needs a decision ───┤
│ MIL-2602  Pending      Make Safe    │  │ [WOs 3] [Props 2]   │
│ …                                   │  │ WO-12 · Received    │
└─────────────────────────────────────┘  ├ New and unread ─────┤
                                         │ New job received    │
                                         └─────────────────────┘
```

**Primary column:** active jobs list (title, address, status, type, updated). Labelled **Your active jobs** when claim-assignee email/`userId` matches the logged-in user; otherwise **Active jobs** (tenant open book).

**Rail:** today, consolidated decision queue, optional my tasks, unread.

Layout header shows the greeting + date/decision subtitle (replaces the “Dashboard” title). The page body starts at the metric + Today row.

Empty queues collapse or show a one-line empty state. Every row and badge deep-links to an existing filtered list or detail page.

---

## Snapshot bar

Compact badges (not hero KPI tiles):

| Badge | Source | Link |
|-------|--------|------|
| Active jobs | Jobs whose status is not archived/closed | `/jobs` |
| Unread | Unread notification count | `/notifications` (or scroll to unread panel) |
| AR overdue | Finance AR overdue count | `/finance/ar` |
| AP overdue | Finance AP overdue count | `/finance/ap` |

---

## Needs a decision

Actionable queues. Preview ~5 rows each. Status filter hrefs use resolved lookup ids.

| Queue | Status names (lookup, case-insensitive) | Link |
|-------|-----------------------------------------|------|
| Work orders to accept | `Received`, `Issued` | `/work-orders?status={id}` |
| Proposals to review | `Received`, `Under Review` | `/proposals?status={id}` |
| RFQs waiting on vendors | `Sent` | `/rfqs?status={id}` |
| Estimates ready to publish | `Approved` | `/quotes?status={id}` |

Row fields: human title (document number / name), subtitle (job ref), status, due date when present. Never raw UUIDs.

---

## Today

Schedule events for the local calendar day from `GET /schedule/events` (appointments, tasks, WOs, POs, RFQs, bills, quotes). Link: `/schedule`.

| Field | Description |
|-------|-------------|
| Time | Start time |
| Title | Event title |
| Entity | Job ref when present |

---

## Overdue / due soon

Open tasks past due, plus open tasks due in the next 7 days. Link: `/tasks?status=Open&overdue=true`.

Optional **My tasks** queue: only when `assignedToUserId ===` current user id. Link: `/tasks?assignedToUserId={sub}`.

| Field | Description |
|-------|-------------|
| Name | Task name (link) |
| Due | Date (red if overdue) |
| Priority | Badge when present |
| Entity | Job/claim ref |

---

## New and unread

Unread notifications (`isRead=false`), not webhook recent-activity. Entity → route map matches the header notification bell. Empty: “You're caught up”.

---

## Money waiting

Finance overdue counts and amounts as subtitles (not giant $ tiles).

| Row | Link |
|-----|------|
| Overdue invoices (AR) | `/finance/ar` |
| Overdue bills (AP) | `/finance/ap` |

---

## Out of scope

- Org KPI tile grid (plan 33j superseded)
- Messages widget (inbox still a shell)
- Per-user notifications / claim-assignee matching
- Role-specific dashboards
