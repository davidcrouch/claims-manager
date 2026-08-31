---
title: "Assessments"
slug: assessments-overview
description: "How the Assessments list and detail pages work — creating a record, job filter, tabs, autosave, lock, print, and Help versus the page agent."
section: operations
area: assessments
routes:
  - /assessments
  - /assessments/[id]
audience: member
permissions_discussed:
  - assessments.read
  - assessments.manage
tags:
  - assessments
  - site findings
  - autosave
  - help
related_guides:
  - completing-an-assessment
  - assessment-reports
  - jobs-overview
  - builder-assessment-workflow
  - journals-overview
version: 1
last_updated: 2026-08-31
---

# Assessments

An **assessment** is the structured site record for a job: who attended, what the building is, whether it is habitable, hazards, damage and cause, make-safe need, temporary accommodation, specialists, and your recommendation. Those findings feed the insurer’s field assessment report.

Assessments are owned by a **job**. You do not re-type the claim address or policy on this page — those stay on the job and parent claim.

This page is the tour of the list and detail chrome. Filling each tab is [Completing an Assessment](completing-an-assessment.md). Printing or uploading the PDF is [Assessment Reports](assessment-reports.md).

## Key Concepts

- **Assessment versus job versus claim** — the claim is the insurer matter; the job is the allocation (for example Builder Assessment); the assessment is the visit findings. One job can have more than one assessment if you attend more than once.
- **Status** — list values include **draft**, **in_progress**, **submitted**, **reviewed**, **published**, and **archived**. **Published** and **archived** lock the form.
- **Sections / tabs** — nine tabs on detail. They are the same record; changing tabs does not discard unsaved edits (autosave runs first).
- **Job filter** — with a job selected, **Assessments** appends `?jobId=` so you only see that job’s records.
- **Help (?) versus page agent** — **?** opens these guides. The assessment page agent can help fill the *current* tab. They are different tools.

## Accessing Assessments

1. In the sidebar under **Customers**, click **Assessments**.
2. Or select a job first, then click **Assessments** — the list is already filtered.

> **Required permission:** `assessments.read` to view the list and detail. Creating, editing, and archiving need `assessments.manage`.

## The Assessments List

The header shows the **Assessments** title, counts, and a status breakdown. The primary action is **Create Assessment**.

### Tabs and search

1. Use **Active**, **Archived**, or **All** to change which statuses appear.
2. Type in **Search assessments by name...** to filter by name.
3. Use the status filter menu to narrow statuses further.

### Columns

| Column | Contents |
|--------|----------|
| **Name** | Assessment name (required at create) |
| **Job** | Link to the owning job |
| **Status** | Current status badge |
| **Created** | Created date |
| **Updated** | Last updated date |

Click a row to open detail. The archive control on the row archives that assessment without opening it.

You can hide columns from the column settings header cell, and sort by name, job, status, created, or updated.

> **Tip:** If the list looks empty, check whether a job is selected and whether you are on **Active** while the only records are archived.

## Creating an Assessment

1. Click **Create Assessment**.
2. In the **Create Assessment** drawer, select the **Job** (prefilled when you opened Assessments from a job).
3. Enter **Assessment Name** (required) — for example `Initial site assessment`.
4. Optionally set **Claim Recommendation**, building dropdowns (**Design Type**, **Construction**, **Roof Type**, **Building Type**), **Make Safe Required** / **Make Safe Type**, and **Comments**.
5. Click **Submit**.

EnsureOS opens the new assessment. You do not enter risk address or policy here; they remain on the job and claim.

> **Required permission:** `assessments.manage`.

> **Note:** Job and name are the only required create fields. You can leave recommendation and building details for the tabs.

## Assessment Detail Header

On `/assessments/[id]`:

| Control | What it does |
|---------|----------------|
| Save status | **Unsaved changes**, **Saving…**, or **Saved** (hidden when locked) |
| **Print PDF** (printer) | Opens the print drawer for this assessment (`Assessment Report` template) |
| **Archive** | Archives the assessment and returns you to the list |
| Assignee | Shows who is assigned; often inherited from the job |

A banner appears when the record is locked:

> This assessment has been published and can no longer be edited.

Locked means status is **published** or **archived**. You can still print and read. Start a **new** assessment on the same job if you must record a later visit — there is no clone button on this page.

## The Tab Strip

| Tab | Purpose (one line) |
|-----|--------------------|
| **Attendance** | Who attended, when, occupancy, other address |
| **Building** | Size, age, construction, roof, condition |
| **Habitability** | Whether the property is liveable |
| **Hazards** | Pool, electrical/gas, sewerage, structural, summaries |
| **Damage & Cause** | Observations, cause, policy event, maintenance |
| **Make Safe** | Whether temporary works are required and what type |
| **Temp Accommodation** | Displacement, duration, amounts |
| **Specialists** | Whether a specialist is required and of which type |
| **Recommendation** | Claim recommendation, costs, conclusion |

Work them in that order. Details: [Completing an Assessment](completing-an-assessment.md).

The active tab is stored as `?tab=` on the URL (Attendance is the default and has no query). You do not need a different help route per tab.

## Autosave

Edits debounce and persist without a Save button.

1. Change a field. Status shows **Unsaved changes**.
2. After a short pause, status shows **Saving…**, then **Saved**.
3. If save fails, an error message appears; fix the problem and change a field again to retry.

> **Note:** Switching tabs does not require a manual save. Wait for **Saved** if you are about to navigate away from the whole page.

## Lock Behaviour

| Status | Editable? |
|--------|-----------|
| draft, in_progress, submitted, reviewed | Yes (with `assessments.manage`) |
| published | No — banner shown |
| archived | No — treated as locked |

Publishing is a one-way lock from this screen’s point of view. Do not publish (or ask someone to publish) an empty **Recommendation**.

## Print Versus Help Versus the Page Agent

| Tool | Where | Use for |
|------|--------|---------|
| **Print PDF** | Header printer icon | Generate the **Assessment Report** from the assigned template |
| **?** (Help) | Far right of the app header | Opens these user guides in the canvas (Help Assistant) |
| Page agent / AI chat | Chat drawer | Can fill the **current** tab from what you say on site |

> **Tip:** Use **?** when you need the official steps. Use the page agent when you want help drafting a tab. Do not confuse the two — Help will not type into fields; the agent will not open this guide unless you ask.

## Best Practices

1. **Create the assessment from the job** so the job picker is already correct.
2. **Finish Attendance before Recommendation** so dates and names match the appointment.
3. **Do not fight a locked assessment.** Open a new one for a return visit.
4. **Keep photos in Journals**, not only in the assessment text fields.
5. **Print or upload the report** after the tabs are complete — autosave is not a submission to the insurer.
6. **Use Help on this page** for procedure; use the page agent for wording on the open tab.
7. **Name assessments by visit** (`Initial`, `Reinspect 2 Sep`) so the list stays readable.
