---
title: "Job Types"
slug: job-types
description: "How job types work in EnsureOS, which types show Type Details, and what each type is for."
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
tags:
  - jobs
  - job-types
  - type-details
  - temporary-accommodation
  - specialist
related_guides:
  - jobs-overview
  - job-lifecycle
  - builder-assessment-workflow
  - builder-make-safe-workflow
  - builder-works-workflow
  - claims-overview
version: 1
last_updated: 2026-08-31
---

# Job Types

Every job has a **Job Type** chosen when you create it. The type drives the badge on the list, the default **Make safe required** flag, and whether a **Type Details** tab appears on the job.

Builder Assessment, Builder Make Safe, and Builder Works are worked mainly on **Overview**. Temporary Accommodation, Specialist, Rectification, and Internal Audit add **Type Details**.

## Key Concepts

- **Job type** — a lookup value (name plus optional provider code). **Create Job** only lists types that match the selected **Provider**.
- **Type Details** — an extra tab for types that have structured extra fields (`hasTypeDetails`).
- **Other types** — Assessment, Make Safe, Works, and any type that does not match the four Type Details kinds. They have **no** Type Details tab.
- **Provider filter** — Internal vs Crunchwork types are separate lists in the **Job Type** dropdown.

## Accessing Job Types

You do not open a separate “job types” admin page for daily work.

1. Open **Customers → Jobs**.
2. Click **Create Job** and use **Job Type**, or open a job and read the type badge in the header and **Core Details**.

> **Required permission:** `jobs.read` to see types on existing jobs. `jobs.create` to pick a type in **Create Job**. Editing Type Details on a Crunchwork job needs `jobs.update`.

## Types You Will See

Names come from your organisation’s lookups. These are the types EnsureOS is built around:

| Type | Typical use | Type Details tab? |
|------|-------------|-------------------|
| **Builder Assessment** | Site assessment and scoping | No |
| **Builder Make Safe** | Immediate make-safe / emergency works | No |
| **Builder Works** | Agreed repair works | No |
| **Temporary Accommodation** | Occupant stay, rooms, mobility | Yes — Stay Details, Occupants, Mobility |
| **Specialist** | Trade specialist and damage notes | Yes — Specialist, Damage |
| **Rectification** | Follow-up / redo of an original job | Yes — Rectification |
| **Internal Audit** | Desktop (or other) audit | Yes — Internal Audit |

> **Note:** The Type Details tab is shown only when the type name (or external reference) matches temporary accommodation, specialist, rectification / builder rectification, or internal audit. Everything else is treated as **other**.

## Choosing a Type When You Create a Job

1. Click **Create Job** (Jobs list or claim header).
2. Set **Provider** first if needed — the **Job Type** list refreshes.
3. Select **Job Type** (required).
4. If you pick **Builder Make Safe**, **Make safe required** is ticked automatically.
5. From a claim, the drawer often defaults the type to **Builder Make Safe**.
6. Continue to **Contacts** and **Review & publish**.

If you see **No job types found for this provider**, switch **Provider** or ask an admin to load job-type lookups for that connection.

> **Tip:** You cannot change job type on the detail page after create. Create the correct type, or raise a new job if the instruction changed.

## When Type Details Appears

On job detail, **Type Details** sits between **Overview** and **Parties** only for the four kinds above. The tab is hidden for Assessment, Make Safe, Works, and unknown types. A `?tab=type-details` URL falls back to Overview if the tab does not apply.

Crunchwork jobs allow inline edit on Type Details; Internal jobs show the same fields read-only. Edits **autosave** with the same undo control as Overview.

## Temporary Accommodation

**Stay Details**

| Field | Notes |
|-------|--------|
| **Emergency** | Yes/no switch |
| **Habitable property** | Yes/no |
| **Estimated start / end** | Date-time |
| **Accommodation benefit limit** | Display (from claim/job) |
| **Max accommodation duration** | Display |

**Occupants** — Adults, Children, Bedrooms, Cots, Vehicles (numeric), **Pets** (text).

**Mobility Considerations** — chips such as **Disabled (Accessible)** and **No-Stair**.

Playbooks for builder assessment / make-safe / works do not replace this tab; TA jobs are accommodation-specific.

## Specialist

**Specialist** — **Category** (for example Plumbing, Roofing, Surveyors), **Specific specialist required** (display), **Business name** when a specific specialist is required.

**Damage** — **Location of damage**, **Type of damage**, **Specialist report** (for example Causation Report, Specialist Advice).

## Rectification

Single **Rectification** card:

| Field | Notes |
|-------|--------|
| **Original job reference** | Reference of the job being rectified |
| **Original job type** | Lookup of the original type |
| **Paid job** | Yes/no |

## Internal Audit

**Internal Audit** card with **Audit type** (for example **Desktop**).

## Types Without Type Details

For **Builder Assessment**, **Builder Make Safe**, and **Builder Works**:

1. Use **Overview** for status, booked/attendance dates, instructions, and parent claim.
2. Use **Create Make-Safe** from an assessment or works job when make-safe is required (not from a job that is already make-safe).
3. Use **Create Estimate** and sidebar **Assessments** / **Estimates** for scoping and pricing.

Step-by-step insurer playbooks: [Builder Assessment](builder-assessment-workflow.md), [Builder Make Safe](builder-make-safe-workflow.md), [Builder Works](builder-works-workflow.md).

## List Filtering by Type

1. On **Jobs**, open **Filter by type** or the **Type** column filter.
2. Tick the types you want (or clear to see all).
3. Combine with **Active** / **Archived** / **All** and assignee filters.

## Best Practices

1. **Match type to the insurer instruction** — do not use Works for a first assessment visit.
2. **Use Builder Make Safe** (or **Create Make-Safe**) when make-safe is required, so the child job and Crunchwork type stay correct.
3. **Fill Type Details on TA and Specialist jobs** — Overview alone does not capture occupants or specialist category.
4. **Set Provider before Job Type** so you do not pick a type that belongs to the other provider.
5. **Record original job reference on Rectification** so the audit trail points at the first job.
6. **Filter the Jobs list by type** at the start of the day if you only run assessments or only TA.
7. **Do not expect Type Details on Assessment/Make Safe/Works** — that is intentional, not a missing tab.
