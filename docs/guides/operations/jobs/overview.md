---
title: "Jobs"
slug: jobs-overview
description: "How to find jobs, open job detail, create jobs and make-safe children, and use job context in the sidebar."
section: operations
area: jobs
routes:
  - /jobs
  - /jobs/[id]
audience: member
permissions_discussed:
  - jobs.read
  - jobs.create
  - jobs.update
  - jobs.assign
  - claims.read
tags:
  - jobs
  - customers
  - make-safe
  - assignee
  - onboarding
related_guides:
  - job-types
  - job-lifecycle
  - builder-assessment-workflow
  - builder-make-safe-workflow
  - builder-works-workflow
  - claims-overview
  - assessments-overview
version: 1
last_updated: 2026-08-31
---

# Jobs

**Jobs** are the operational units of repair and service work. A job sits under a claim (when linked), has a type, status, assignee, site address, and optional child make-safe job.

Open a job to work its **Overview**, parties, reports, attachments, and timeline. Estimates, purchase orders, and invoices are **not** tabs on the job. They are sidebar pages that filter with `?jobId=` when a job is selected.

## Key Concepts

- **Job #** — your organisation’s job reference (list column **Job #**).
- **Insurer Ref** — the insurer’s job identifier when present.
- **Provider** — **Internal** (EnsureOS only) or **Crunchwork** (published to NRMA).
- **Job context** — selecting a job in the header picker scopes Journals, Assessments, Estimates, Invoices, and other job-filterable sidebar items.
- **Create Make-Safe** — raises a child **Builder Make Safe** job on the same claim, with this job as parent.

## Accessing Jobs

1. In the left sidebar, open **Customers**.
2. Click **Jobs**.

The list header is titled **Jobs**.

> **Required permission:** `jobs.read` to view the list and detail. **Create Job** needs `jobs.create`. Changing **Assigned** needs `jobs.update` / `jobs.assign` as your role allows.

## The Jobs List

Toolbar: **Active**, **Archived**, **All**; search (**Search jobs by job ref, insurer reference, or address...**); **Filter by type**; **Create Job**; **Print PDF**.

### List columns

| Column | What it shows |
|--------|----------------|
| **Job #** | Display name/reference, plus a compact sync indicator |
| **Insurer Ref** | Insurer job reference |
| **Type** | Job type badge |
| **Status** | Status badge |
| **Assigned** | Assignee name |
| **Address** | Site address |
| **Requested** | Request date |
| **Updated** | Last update |

**Job #**, **Type**, **Status**, and **Assigned** have column filters. Unread jobs show a blue marker. Click a row to open `/jobs/[id]`. Archive uses the row trash control.

Empty results show **No jobs found.**

> **Tip:** A blue left border means unread activity on that job. After you open it, the highlight clears on later visits.

## Creating a Job from the List

1. Click **Create Job**.
2. Complete **Job Details** → **Contacts** → **Review & publish**.
3. For NRMA work, set **Provider** to **Crunchwork** and select a **Claim** (required).
4. Click **Submit to NRMA** or **Create Job**.

See [Creating a Claim](../claims/creating-a-claim.md) for the same wizard when started from a claim (claim and address pre-filled; type often defaults to **Builder Make Safe**).

## Job Header

**Back to jobs** returns to the list. The title is the job display name. Use the chevron control (**Switch job**) to open the jobs picker, or **X** (**Back to All Jobs**) to clear the current job and return to `/jobs`.

The header also shows status, sync indicator, type badge, address, and **Claim:** with a link to `/claims/[id]` (**View Claim**). Below: **Request**, **Updated**, optional **Excess**, and **Make-safe** yes/no.

## Job Tabs (Live)

Only these tabs appear on the job:

| Tab | When it appears | Purpose |
|-----|-----------------|---------|
| **Overview** | Always | Core details, dates, vendor, location, instructions, parent claim |
| **Type Details** | Temporary Accommodation, Specialist, Rectification, Internal Audit only | Type-specific fields — see [Job Types](job-types.md) |
| **Parties** | Always | Job contacts; **Add Contact** |
| **Reports** | Always | Job reports; **Add Report** opens **Create Report** |
| **Attachments** | Always | Files linked to the job |
| **Timeline** | Always | Created/updated audit trail |

There are **no** Quotes, Purchase Orders, or Invoices tabs on the job. Use **Customers → Estimates**, **Vendors → Purchase Orders**, and **Customers → Invoices**. With this job selected, those links include `?jobId=`.

## Header Actions on a Job

- **Create Make-Safe** — when the job has a claim, is not already a Builder Make Safe, and the type exists. Opens **Create Make-Safe job**. If a make-safe already exists, the button is **Go to Make-Safe**.
- **Create Estimate** — opens the estimate drawer for this job.
- **Add Contact** / **Add Report** — shown when you are on **Parties** or **Reports**.
- **Undo** — reverts unsaved or last-saved field edits on Overview / Type Details / assignee.
- **Print PDF** — **Print report** for job details (and related report types when assessments exist).
- **Archive job** — archives and returns to `/jobs`.

**Assigned** sits on the right of the tab bar. Changing it autosaves with Overview edits.

> **Note:** Overview and Type Details **autosave**. A save status appears above the tabs. Use **Undo** if you change the wrong date or assignee.

## Overview Tab

Cards include **Core Details** (job number, name, type, status, parent claim, parent job, request date, make-safe required, excess), **Job Dates & Approval** (booked date, attendance date, **Add Appointment** when booked date is empty), **Vendor**, **Risk Location**, **Location map**, **Instructions**, and **Parent Claim**.

On Crunchwork jobs you can edit **Status**, **Instructions**, vendor external reference, booked date, and attendance date. Expand the chevron on **Core Details** for advanced identifiers and provider.

See [Job Lifecycle](job-lifecycle.md) for dates and child make-safe jobs.

## Parties, Reports, Attachments, Timeline

1. **Parties** — search and filter contacts. Click **Add Contact** for the **Add Contact** drawer, or remove a contact with confirmation.
2. **Reports** — **Active** / **Archived** / **All**, then **Add Report**.
3. **Attachments** — lists files on this job. **Upload** may be disabled until upload is enabled; prefer **Documents** in the sidebar with job context, or journal entries for site photos.
4. **Timeline** — **Audit Trail** timestamps. **Notes & Events** shows a placeholder until the timeline API is connected.

## Create Make-Safe

1. On a parent job that is not already make-safe, click **Create Make-Safe**.
2. Review **Create Make-Safe job** (type, parent job, assignee, site, claim). The banner explains the job is pushed to the insurer.
3. Click **Create Make-Safe** (or **Cancel**).
4. On success, click **Open Make-Safe job**.

> **Warning:** This cannot be undone from the drawer. It creates a new Builder Make Safe job in Crunchwork against the linked claim.

> **Required permission:** `jobs.create`. A linked claim is required.

## Job-Scoped Sidebar

After you open a job, many **Customers**, **Vendors**, and **Operations** items append `?jobId=` and may show a count badge.

Typical job-filtered pages: **Journals**, **Assessments**, **Estimates**, **Work Orders**, **Invoices**, **RFQs**, **Proposals**, **Purchase Orders**, **Bills**, **Tasks**, **Schedule**, **Communications**, **Appointments**, **Contacts**, **Documents**.

> **Tip:** If a list looks empty, clear job context (header **X** or open **Jobs** without a selection) to see the organisation-wide list.

## Best Practices

1. **Create insurer-facing jobs with a claim** so Crunchwork publish succeeds.
2. **Use Create Make-Safe from the parent job** instead of inventing a second unlinked make-safe.
3. **Set Assigned** so Dashboard “your jobs” and filters work.
4. **Do not look for invoice tabs on the job** — open **Invoices** with the job selected.
5. **Use Type Details** when it appears; Builder Assessment / Make Safe / Works use Overview only.
6. **Print from the job header** when you need a job PDF for the file.
7. **Select the job before journals or documents** so files land on the job’s project folders.
