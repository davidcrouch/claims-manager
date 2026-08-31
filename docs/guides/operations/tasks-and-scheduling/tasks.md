---
title: "Tasks"
slug: tasks
description: "How to create, filter, and complete work items on the Tasks list, including My tasks and overdue views from the Dashboard."
section: operations
area: tasks-and-scheduling
routes:
  - /tasks
audience: member
permissions_discussed:
  - workflows.read
  - workflows.manage
tags:
  - tasks
  - workflows
  - dashboard
  - schedule
  - jobs
related_guides:
  - schedule
  - appointments
  - job-lifecycle
  - dashboard
version: 1
last_updated: 2026-08-31
---

# Tasks

Tasks are work items assigned to a person, usually on a job. Use this page to see what is open, overdue, or assigned to you, and to create or complete tasks without leaving Operations.

The Dashboard **My tasks** panel and overdue items in **Needs a decision** open this list with filters already applied.

## Key Concepts

- **Task** — a named action with type, status, priority, assignee, and due date.
- **My tasks** — Dashboard panel shown only when you have tasks assigned to you (`assignedToUserId` matches your user). Its link opens `/tasks` with that assignee filter.
- **Overdue** — open tasks past their due date. Dashboard overdue chips and `?overdue=true` show these.
- **Priority** — Low, Medium, High, or Critical (Urgent uses the same emphasis as Critical).
- **Status** — Open, In Progress, On Hold, Completed, Failed, or Cancelled on the list filters; the create/edit drawer uses Open, Completed, and Failed.

## Accessing Tasks

1. In the left sidebar, under **Operations**, click **Tasks**.
2. Click a row to open the **Edit Task** drawer (there is no separate `/tasks/[id]` page).
3. From the Dashboard, click **My tasks** or an overdue task row to open this list with assignee or overdue filters.

> **Required permission:** You need `workflows.read` (Read Workflows) to view tasks. **Create Task** and editing status require `workflows.manage`.

When **My tasks** or overdue filters are on, a hint appears under the tabs: **Showing overdue open tasks** and/or **Showing assigned tasks**.

## Job Filter

When a job is selected in the sidebar job picker, the Tasks link becomes `/tasks?jobId=…`. The count badge on **Tasks** is for that job only.

You can also filter by job from the **Job** column header.

> **Tip:** If the list looks empty, check whether a job is selected. Clear job context to see the organisation-wide list again.

## The Tasks List

The header title is **Tasks**. It shows total count, how many rows are showing, and a status breakdown.

1. Choose **Open**, **Completed**, or **All**.
2. Search by name, type, or entity.
3. Open **All priorities** to include or exclude Low, Medium, High, and Critical.
4. Filter **Task**, **Job**, **Status**, **Priority**, **Type**, or **Assigned** from column headers.
5. Click **Create Task** to add a task.

| Column | What it shows |
|--------|----------------|
| **Task** | Name (plus a sync indicator if the task is still syncing) |
| **Job** | Linked job |
| **Status** | Status badge |
| **Priority** | Colour chip (green / amber / orange / red) |
| **Type** | Task type badge |
| **Assigned** | Assignee display name |
| **Due Date** | Due date — red if overdue, orange if due within two days, green if due within seven days |
| **Updated** | Last change date |

Empty state: **No tasks found.**

## Creating a Task

1. Click **Create Task**.
2. Under **Assignment**, choose the **job** (if none is selected) and the **assignee**.
3. Enter a **Name** (required) and optional **Description**.
4. Select **Type** (required), **Status** (defaults to Open), and **Priority**.
5. Set a **Due Date**. Add tags or hours and notes if your team uses them.
6. Click **Create Task**.

The drawer title is **Create Task** for new records and **Edit Task** when you open a row.

## Completing a Task

1. Click the task row.
2. Change **Status** to **Completed**.
3. Save. The task moves to the **Completed** tab.

There is no separate Complete or Snooze button on the list. Change status and due date in the drawer.

> **Tip:** Completing a contact or attendance task does not always stamp dates on Job Overview. After a site visit, confirm **Booked** / attendance dates on the job as well.

> **Note:** Dashboard overdue items use open tasks past due. Completing the task removes it from that queue.

## Opening a Task from a Link

Some notifications open `/tasks?open=<id>`. EnsureOS opens the edit drawer for that task, then removes `open` from the URL.

## Best Practices

1. **Assign an owner on every SLA task.** Unowned insurer deadlines do not appear in anyone’s **My tasks**.

2. **Set a real due date.** Colour coding only helps if the date is the actual commitment.

3. **Use Open for work still to do.** Do not leave In Progress items with no assignee.

4. **Start from the Dashboard in the morning.** **My tasks** and overdue rows are the same records as this list.

5. **Keep tasks on the job.** Create with job context so the sidebar count and Schedule chips stay accurate.

6. **Update Job Overview** for attendance or first-contact dates rather than assuming a completed task wrote them.

7. **Filter to one job** when you are running a site pack so you do not complete the wrong job’s task.
