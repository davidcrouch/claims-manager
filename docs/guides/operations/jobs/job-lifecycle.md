---
title: "Job Lifecycle"
slug: job-lifecycle
description: "How job dates, status, assignee, child make-safe jobs, archive, and invoicing work across a job’s life."
section: operations
area: jobs
routes:
  - /jobs
  - /jobs/[id]
audience: member
permissions_discussed:
  - jobs.read
  - jobs.update
  - jobs.assign
  - jobs.create
  - invoices.create
  - invoices.read
tags:
  - jobs
  - lifecycle
  - dates
  - assignee
  - make-safe
  - invoices
related_guides:
  - jobs-overview
  - job-types
  - builder-make-safe-workflow
  - claims-overview
  - invoices-overview
version: 1
last_updated: 2026-08-31
---

# Job Lifecycle

A job moves from request through booking, attendance, optional child make-safe, and completion. Dates and status live on **Overview**. Invoices are raised on **Customers → Invoices**, not on a job tab.

This guide follows one job from the list through archive. Type-specific fields are covered in [Job Types](job-types.md).

## Key Concepts

- **Request date** — when the job was requested (header **Request**, Overview **Request date**). Display-only on Overview.
- **Booked date** — when the visit is booked. Editable on Overview; **Add Appointment** appears when it is empty.
- **Attendance due / attendance / completed** — due date is display-only; attendance date is editable; completed date is display-only.
- **Assignee** — **Assigned** on the tab bar (and **Assigned** on the list). Autosaves with Overview.
- **Child make-safe** — a Builder Make Safe job with this job as **Parent job**.
- **Archive** — removes the job from **Active**; recover it under **Archived**.

## Accessing a Job in Progress

1. Open **Customers → Jobs**.
2. Use **Active** for live work.
3. Click the job row.

> **Required permission:** `jobs.read` to view. Changing dates, status, instructions, or assignee needs `jobs.update`. Assigning others may also require `jobs.assign`. Creating a child make-safe needs `jobs.create`.

## Dates on Overview

Open **Overview** → **Job Dates & Approval**.

| Field | Editable? | What to do |
|-------|-----------|------------|
| **Auto approval applies** | No | Read from the job/claim |
| **Vendor job number** | No | Shown when the vendor supplied one |
| **Contact date** | No | When the customer was contacted |
| **Booked date** | Yes (date control) | Set when the visit is in the diary |
| **Add Appointment** | Button | Shown only if booked date is empty; opens the appointment drawer with job address and parties |
| **Attendance due date** | No | Target attendance |
| **Attendance date** | Yes | Actual attendance |
| **Completed date** | No | Set when the job is completed upstream |

1. Click the **Booked date** field and choose a date.
2. If you still need a calendar item, click **Add Appointment** *before* you set booked date, or add an appointment from **Operations → Appointments** with the job selected.
3. After the visit, set **Attendance date**.
4. Wait a moment for autosave (status above the tabs).

**Core Details** also shows **Request date**, **Make-safe required**, **Collect excess**, and **Excess**. On Crunchwork jobs, **Status** is a dropdown on this card.

> **Note:** There is no separate **Save** button. Leave the field or wait for autosave. Use **Undo** in the header if the last change was wrong.

> **Tip:** Header **Updated** refreshes after save. Use it to confirm the insurer sync time versus your local edit.

## Status

Status is a lookup (organisation-specific names). You see it as a badge on the list and header.

On a **Crunchwork** job:

1. Open **Overview**.
2. In **Core Details**, change **Status**.
3. Autosave pushes the change.

On an **Internal** job, status is display-only on Overview (badge).

Unread styling on the list is not a status — it only marks jobs with unread activity.

## Assignee

1. On job detail, find **Assigned** on the right of the tab row.
2. Choose a user (or clear).
3. Autosave runs with other dirty Overview fields.

On **Create Job**, **Assigned** defaults to you. The Jobs list **Assigned** column and filter use the same field.

> **Required permission:** Changing assignee is an assign/update action. If the control does not stick, your role may lack `jobs.assign` or `jobs.update`.

## Child Make-Safe Jobs

When **Make-safe** on the header is yes, or the insurer requires make-safe:

1. On the parent job (not already **Builder Make Safe**), click **Create Make-Safe**.
2. Confirm the summary and click **Create Make-Safe**.
3. Open the new job. **Core Details** shows **Parent job** → **Open master job**.
4. If a make-safe already exists, the parent shows **Go to Make-Safe** instead.

The child copies claim, address, excess, instructions, and assignee where present, and sets **Make safe required**. Work the child like any other job (dates, parties, estimates).

> **Warning:** Submitting **Create Make-Safe** publishes a new Crunchwork job. Do not click it twice; use **Go to Make-Safe** if the button has already changed.

See [Builder Make Safe](builder-make-safe-workflow.md) for the insurer playbook.

## Estimates, Documents, and Invoices (Not Job Tabs)

Lifecycle work after attendance often includes pricing and billing. Those screens are separate:

| Need | Where |
|------|--------|
| Price the job | Header **Create Estimate**, or **Customers → Estimates** with `?jobId=` |
| Site photos / notes | **Customers → Journals** (job selected) |
| Formal assessment | **Customers → Assessments** |
| Invoice the job | **Customers → Invoices** — **not** a job tab |
| Vendor PO / bill | **Vendors → Purchase Orders** / **Bills** with job context |

1. Keep the job selected (header picker).
2. Click **Invoices** in the sidebar.
3. Create or open invoices for that `jobId`.

> **Note:** Do not look for an Invoices tab beside Timeline. Older documents that listed Quotes/POs/Invoices as job tabs are out of date.

## Archiving and Completing

**Completed date** appearing on Overview means the job was completed in the source system. You still archive in EnsureOS when your process says the job should leave **Active**:

1. Click **Archive job** (trash) in the header, or the list row trash.
2. Confirm **Archive job**.
3. You return to `/jobs` from detail. Find the job under **Archived** or **All**.

Archive is hidden when the job is already archived.

> **Warning:** Archive hides the job from the Active list and job-context counts. Do not archive a job that still has unpaid invoices you are working this week without agreeing that with finance.

## Suggested Sequence

1. **Create** the job (from claim or Jobs list) with the correct type and provider.
2. **Assign** the person who will attend.
3. Set **Booked date** (and appointment if needed).
4. Attend; set **Attendance date**; update **Instructions** if the scope changed.
5. Raise **Create Make-Safe** if required and not already a make-safe job.
6. Complete assessments/estimates from the sidebar.
7. Raise invoices on **Invoices**.
8. When finished, **Archive** the job (and consider the parent claim separately).

## Best Practices

1. **Set booked and attendance dates on Overview** so the rest of the organisation can see progress without opening chat.
2. **Assign before the visit** so filters and Dashboard “your jobs” stay accurate.
3. **Create make-safe as a child** instead of a second unlinked job with a similar name.
4. **Invoice on the Invoices page** with the job selected so the bill ties to the right `jobId`.
5. **Use Undo** immediately if autosave wrote the wrong status or date.
6. **Archive last**, after invoices and documents are in place.
7. **Open View Claim** from the header when policy excess or DOL must be checked mid-job.
