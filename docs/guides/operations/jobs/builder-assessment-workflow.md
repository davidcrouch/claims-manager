---
title: "Builder Assessment Workflow"
slug: builder-assessment-workflow
description: "How a Builder Assessment job runs in EnsureOS — from allocation through site attendance, report, estimate, invoice, and insurer review."
section: operations
area: jobs
routes:
  - /jobs
  - /jobs/[id]
  - /assessments
  - /quotes
  - /invoices
audience: member
permissions_discussed:
  - jobs.read
  - jobs.update
  - jobs.assign
  - assessments.read
  - assessments.manage
  - journals.manage
  - documents.manage
  - procurement.read
  - procurement.manage
  - invoices.create
  - invoices.read
  - workflows.manage
tags:
  - builder assessment
  - jobs
  - assessments
  - estimates
  - invoices
  - workflow
  - playbook
related_guides:
  - completing-a-builder-assessment-job
  - assessments-overview
  - completing-an-assessment
  - assessment-reports
  - creating-an-estimate
  - job-lifecycle
  - jobs-overview
version: 1
last_updated: 2026-08-31
---

# Builder Assessment Workflow

A **Builder Assessment** job is allocated when the insurer needs you to investigate damage, establish cause, and describe the repairs required. You attend the property, record findings in an **Assessment**, attach evidence, and usually return a report and (when required) an estimate so the insurer can decide the claim.

This page is the stage map. Use [Completing a Builder Assessment Job](completing-a-builder-assessment-job.md) as the numbered checklist while you work the job.

## Key Concepts

- **Builder Assessment** — the job type. The type badge on the job header and **Overview** tab confirms you are on this playbook, not Make Safe or Works.
- **Assessment** — the structured site record in **Customers → Assessments**. Findings live here, not on a form attached to the job.
- **Job filesystem** — when a job is selected, **Documents** shows that job’s project folders. The project *is* the job. Upload reports and photos here (or they appear on the job **Attachments** tab once linked).
- **Estimate** — priced scope created under **Customers → Estimates** (`/quotes`), usually from the job **Create Estimate** button.
- **Related records** — tasks, appointments, journals, assessments, estimates, and invoices all hang off the same job. Select the job in the header picker so lists stay filtered.

## Accessing Builder Assessment Jobs

1. In the sidebar under **Customers**, click **Jobs**.
2. Open the job whose type badge is **Builder Assessment**.
3. Confirm the header shows the claim link, type badge, risk address, and current **Status**.

> **Required permission:** You need `jobs.read` to open the list and detail. Editing dates, instructions, or assignment needs `jobs.update`. Assigning the job to another user needs `jobs.assign`.

> **Tip:** Filter the Jobs list by type if your organisation runs mixed work. Unread or newly allocated jobs also appear on the **Dashboard**.

## What You Will See on the Job

Every job uses the same tab strip. Builder Assessment work uses them as follows.

| Tab | What you use it for |
|-----|---------------------|
| **Overview** | Claim snapshot, status, dates, make-safe and excess flags, instructions, site address |
| **Type Details** | Only appears for a few specialised types (for example temporary accommodation). Builder Assessment jobs typically stay on **Overview**. |
| **Parties** | Insurer-supplied contacts plus site contacts you add |
| **Reports** | Generated or registered report records (**Add Report**) |
| **Attachments** | Files already linked to this job |
| **Timeline** | Created and updated history |

### Header actions

- **Create Make-Safe** — opens the Create Make-Safe job drawer when this claim does not already have a Make Safe job. If one exists, the button reads **Go to Make-Safe**.
- **Create Estimate** — opens the estimate drawer on this job.
- **Print PDF** (printer icon) — generate **Job Details** or, when an assessment exists, **Assessment Report**.
- Assignee control on the tab strip — assign yourself or a colleague.

### Overview cards

| Card | Typical fields |
|------|----------------|
| **Core Details** | Job number, name, type badge, status, insurer reference, parent claim, request date, **Make-safe required**, **Collect excess**, **Excess** |
| **Job Dates & Approval** | Auto approval applies, contact date, booked date, attendance due date, attendance date, completed date |
| **Vendor** | Your company contact details on the allocation |
| **Address** | Risk address and map when coordinates exist |
| **Instructions** | Insurer directions for this job |
| **Parent claim** | Claim number, account (insurer), lodged date, date of loss, CAT code, loss type, priority, policy name |

> **Note:** **Collect excess** on an assessment job is a flag for a later Works allocation. Do not collect excess during the assessment visit unless the insurer’s instructions say otherwise.

## Workflow Stages

### 1. Job appears

The insurer allocates a Builder Assessment to your organisation. At this stage:

- The job appears on **Jobs** and usually on the **Dashboard**.
- Core claim data is already on **Overview** (address, parent claim, loss type, request date).
- A purchase order for the report fee may already exist under **Vendors → Purchase Orders** when the insurer issues one with the allocation.

1. Open the job and read **Instructions**.
2. Check **Priority**, date of loss, and the risk address.
3. Review **Parties** for the customer and any site contact.
4. Assign the job to the estimator who will attend (assignee on the tab strip).

> **Required permission:** `jobs.assign` is required to change the assignee if you are not already allowed to update the job.

### 2. Contact the customer

Call or message the customer to introduce yourself and agree a visit window.

1. Open **Operations → Tasks** with this job selected, or work the task from the Dashboard.
2. Complete the **Call to Schedule** task once you have spoken to the customer.
3. Confirm **Contact date** and **Attendance due date** on **Overview → Job Dates & Approval**.

> **Note:** Completing **Call to Schedule** may populate **Contact date** and calculate **Attendance due date** automatically. Prefer completing the task rather than typing those dates by hand.

> **Tip:** If the first call fails, a follow-up task (for example a second **Call to Schedule**) may appear. Keep trying until you have a confirmed window or the insurer instructs you to stop.

### 3. Book attendance

Once the customer agrees a time, book it in EnsureOS.

1. On **Overview**, next to **Booked date**, click **Add Appointment** if no booked date is set — or open **Operations → Appointments** with the job selected.
2. The appointment drawer prefills the job name, site address, and a default **Inspection** type. Set the start and end time, then save.
3. Confirm **Booked date** and **Attendance date** on **Overview**.

> **Note:** Saving the appointment may complete **Book Site Attendance**, fill **Booked date** and **Attendance date**, and move status toward scheduled. If you book the appointment before completing **Call to Schedule**, that contact task may complete at the same time.

### 4. Attend the property

On the booked day, attend the risk address. This stage is **Assessment + Journal**, not a report form on the job.

During the visit you should:

- Inspect the damage and establish cause.
- Record structured findings on an **Assessment**.
- Photograph rooms, defects, and context in a **Journal**.

1. Under **Customers**, open **Assessments** (the sidebar keeps `?jobId=` when the job is selected).
2. Click **Create Assessment** if none exists, or open the existing row.
3. Complete the tabs in order — see [Completing an Assessment](../assessments/completing-an-assessment.md).
4. Under **Customers → Journals**, create or continue a photo journal for the same job.

> **Required permission:** Creating and editing assessments needs `assessments.manage`. Journals need `journals.manage`.

> **Warning:** Do not treat the job **Reports** tab as the place to type site findings. **Reports** is for generated or registered documents. Site observations belong on the Assessment.

When **Attendance date** is set, **Submission due date** may be calculated from the insurer’s timeframe. Work to that date.

### 5. Submit the assessment report

After the visit, produce the report the insurer expects.

You have two complementary paths:

| Path | Where | Use when |
|------|--------|----------|
| **Generate / print** | Printer icon on the assessment or job | Your organisation’s **Assessment Report** template is assigned |
| **Upload a finished PDF** | **Operations → Documents** with the job selected | You prepared the report outside EnsureOS, or the insurer wants a signed file |

1. Finish **Recommendation** on the assessment (claim recommendation must not be empty).
2. Print or upload the report and classify it as **Assessment Report**.
3. Confirm the file is visible on the job **Attachments** tab or in the job’s Documents folders.

Full steps: [Assessment Reports](../assessments/assessment-reports.md).

> **Warning:** Do not mark the job complete, and do not tell the insurer the assessment is finished, until the report is in the job filesystem where they can receive it.

### 6. Submit an estimate if required

Many Builder Assessment allocations also need a priced scope.

1. On the job header, click **Create Estimate**.
2. Choose the estimate **Type** (usually **Quote**). Name it so the claim and job are obvious.
3. Build line items from catalogues, then publish when the scope is ready.

See [Creating an Estimate](../estimates/creating-an-estimate.md). If the insurer later asks for a change after approval, that is a **variation** — see [Creating a Variation](../estimates/creating-a-variation.md).

> **Note:** Estimates live at **Customers → Estimates** (`/quotes`), not on a separate quote screen on the job.

### 7. Invoice the report fee

Once the assessment (and estimate, if required) has been submitted, invoice the agreed report fee.

1. Open **Vendors → Purchase Orders** with the job selected and confirm the inbound PO for the fee (if the insurer issued one).
2. Open **Customers → Invoices** and create the invoice against this job.
3. Keep the invoice total at or below the remaining PO value.

> **Required permission:** `invoices.create` to raise the invoice; `invoices.read` to view existing ones. Approving invoices is a separate `invoices.approve` permission, usually held by managers.

> **Note:** If no PO is visible yet, wait for the insurer allocation to finish syncing, or raise the invoice against the job as your finance process allows. Do not invent a PO.

### 8. Insurer review

After submission, the insurer reviews the report and any estimate. Possible outcomes include:

| Outcome | What you do next |
|---------|------------------|
| Repairs approved | Expect a **Builder Works** job and an approved purchase order — see [Builder Works Workflow](builder-works-workflow.md) |
| Further information | Answer on the job (tasks, messages, or a revised assessment/estimate) |
| Make safe required | Create or open the Make Safe job from the header — see [Builder Make Safe Workflow](builder-make-safe-workflow.md) |
| Claim decision only | Record the outcome in notes; do not start repairs until a Works job exists |

Auto-approval may apply when **Auto approval applies** is yes and the estimate is within your delegated authority. If it does not apply, wait for the insurer before scheduling repairs.

## Related Records

| Record | Sidebar | How it links |
|--------|---------|--------------|
| Assessment | **Customers → Assessments** | Owned by the job; one or more per visit |
| Journal | **Customers → Journals** | Photo pages for the same job |
| Estimate | **Customers → Estimates** | Created from the job header or the Estimates list |
| Invoice | **Customers → Invoices** | Report fee (and later works, on a different job) |
| Purchase order | **Vendors → Purchase Orders** | Inbound fee or approved repair items |
| Tasks | **Operations → Tasks** | Call to Schedule, Book Site Attendance, Submit Report, and similar |
| Appointment | **Operations → Appointments** | Site inspection booking |

## Dates That Often Update Themselves

These **Job Dates & Approval** fields are commonly filled when you complete the matching action. Prefer the action over typing the date.

| Field | Typical trigger |
|-------|-----------------|
| Contact date | **Call to Schedule** completed |
| Attendance due date | Calculated from contact (insurer SLA) |
| Booked date | Appointment saved |
| Attendance date | Appointment saved or set on Overview |
| Completed date | You record completion when the visit and submission are done |

> **Warning:** If a date filled itself after you completed a task, do not overwrite it unless the value is wrong. Manual edits can disagree with the insurer’s copy of the job.

## Best Practices

1. **Read instructions before you call.** Priority, CAT code, and special access notes are on **Overview**. Calling blind wastes the customer’s time and yours.
2. **Book in EnsureOS the same day you agree the time.** An appointment that exists only in a personal calendar will not update **Booked date** or complete **Book Site Attendance**.
3. **Create the Assessment before you leave site** (or immediately after). Autosave keeps each tab; waiting until the next day loses detail.
4. **Keep photos in a Journal**, not only on a phone. The insurer and the later Works crew need the same evidence.
5. **Upload the report to the job**, never only to the company filesystem. With the job selected, Documents *is* the job project.
6. **Publish the estimate** if a quote was required. A draft estimate is not a submission.
7. **Use Create Make-Safe from this job** when the visit finds an unsafe property. That keeps the new job on the same claim with this job as parent.
