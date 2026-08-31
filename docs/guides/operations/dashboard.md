---
title: "Dashboard"
slug: dashboard
description: "How to use the EnsureOS ops inbox: snapshot tiles, active jobs, today’s calendar, decisions, and unread items."
section: operations
area: dashboard
routes:
  - /dashboard
audience: member
permissions_discussed:
  - jobs.read
  - workflows.read
  - finance.read
  - messaging.read
  - procurement.read
tags:
  - dashboard
  - inbox
  - decisions
  - onboarding
  - tasks
related_guides:
  - getting-started
  - tasks
  - schedule
  - communications-overview
  - accounts-receivable
  - accounts-payable
  - work-orders-overview
  - estimates-overview
version: 1
last_updated: 2026-08-31
---

# Dashboard

The Dashboard is your organisation’s **ops inbox**. It shows records waiting on a decision, today’s calendar, active jobs, and unread notifications. It is not an organisation-wide KPI scoreboard.

The header greets you by name and shows today’s date. If anything needs a decision, a subtitle such as **4 items need a decision** appears. If nothing is outstanding, you will see **All clear on decisions**.

## Key Concepts

- **Snapshot bar** — five tiles at the top: active jobs, needs action, unread, AR overdue, AP overdue. Each tile is a link.
- **Active jobs** — jobs currently in progress for the organisation, with an optional **Yours** subset when you are the assignee.
- **Needs a decision** — work orders to accept, proposals to review, RFQs waiting on vendors, estimates ready to publish, plus overdue tasks.
- **Today** — calendar items for the rest of the day; **Schedule** opens the full calendar.
- **My tasks** — only listed when you have tasks assigned to you (`assignedToUserId` matches your user).
- **New and unread** — notifications and messages you have not opened yet.

## Accessing the Dashboard

1. Click **Dashboard** at the top of the left sidebar (above the Customers group).

There is no extra permission to *open* the page. Tiles and queues only fill with records your role can already read (for example AR overdue needs `finance.read`).

## Snapshot Bar

The five tiles across the top summarise the inbox:

| Tile | What it shows | Where it goes |
|------|----------------|---------------|
| **Active jobs** | Count of in-progress jobs. Hint shows unread job count when greater than zero | `/jobs` |
| **Needs action** | Count of items waiting on a decision | Scrolls to **Needs a decision** on this page |
| **Unread** | Count of new notifications | Scrolls to **New and unread** |
| **AR overdue** | Total overdue **invoices** (money owed to you) | [Accounts Receivable](finance/accounts-receivable.md) |
| **AP overdue** | Total overdue **bills** (money you owe) | [Accounts Payable](finance/accounts-payable.md) |

Amber icons appear when the tile is in a warning state (action required, unread, or overdue amounts).

> **Tip:** Use **AR overdue** and **AP overdue** as a finance pulse; use **Needs action** for operational decisions (accept a work order, publish an estimate).

## Active Jobs

The centre column lists active jobs (reference, status, type, address).

- **View all** opens the Jobs list.
- If the inbox is scoped to you, the list is labelled as your jobs; you can still switch to the organisation list when both counts are provided.
- Click a row to open that job.

> **Required permission:** You need `jobs.read` to see job rows. Without it the list is empty even if the organisation has work.

## Today

The **Today** panel lists timed items (appointments and similar) with a clock time on the left.

1. Scan the times for site visits and meetings.
2. Click a row to open the underlying record.
3. Click **Schedule** in the panel header to open the full [Schedule](tasks-and-scheduling/schedule.md) page.

Empty copy appears when nothing is booked for today.

## Needs a Decision

This panel consolidates queues such as:

- Work orders to accept
- Proposals to review
- RFQs waiting on vendors
- Estimates ready to publish
- Overdue tasks (up to eight combined attention items)

Chip links at the top of the panel jump to the filtered list for each queue (for example Estimates or Work Orders).

1. Click a chip to open that list, or click a row to open the record.
2. Take the decision on the destination page (publish, accept, chase a vendor).
3. Return to Dashboard; counts drop after the record leaves the queue.

## My Tasks

If you have assigned tasks, **My tasks** appears with a link to [Tasks](tasks-and-scheduling/tasks.md). Overdue tasks are emphasised.

Organisation-wide overdue work still appears under **Needs a decision** even when **My tasks** is hidden (you are not the assignee).

## New and Unread

Unread notifications and messages appear here. Open a row to read it, or use [Communications](communications/overview.md) for the full inbox.

## Empty States

| Situation | What you see |
|-----------|----------------|
| No decisions and no overdue tasks | Subtitle **All clear on decisions**; empty decision copy in the panel |
| No calendar items today | Short empty message in **Today** |
| No unread items | Empty message in **New and unread** |

## Best Practices

1. **Open Dashboard first** after sign-in so unpublished estimates and overdue tasks are not buried in lists.
2. **Clear Needs action before starting new fieldwork** when you are the decision-maker for the day.
3. **Treat AR/AP tiles as alerts**, then work the Finance pages for the actual invoices and bills.
4. **Use Today as a briefing**, then Schedule for rearranging appointments.
5. **Don’t ignore Unread** — insurer and job messages often sit there rather than in personal email.
6. If a tile is always zero, confirm your role includes the matching read permission rather than assuming there is no work.
