---
title: "Builder Make Safe Workflow"
slug: builder-make-safe-workflow
description: "How a Builder Make Safe job runs in EnsureOS — allocation or Create Make-Safe, site works, estimate, invoice, and variations."
section: operations
area: jobs
routes:
  - /jobs
  - /jobs/[id]
  - /quotes
  - /invoices
audience: member
permissions_discussed:
  - jobs.read
  - jobs.update
  - jobs.create
  - assessments.read
  - procurement.manage
  - invoices.create
  - documents.manage
  - workflows.manage
tags:
  - make safe
  - builder make safe
  - jobs
  - estimates
  - variations
  - workflow
  - playbook
related_guides:
  - completing-a-builder-make-safe-job
  - creating-a-variation
  - creating-an-estimate
  - builder-assessment-workflow
  - completing-an-assessment
  - job-lifecycle
version: 1
last_updated: 2026-08-31
---

# Builder Make Safe Workflow

A **Builder Make Safe** job is temporary work to protect people, pets, and the building — boarding, tarping, fencing, isolating unsafe elements — not the full repair. The insurer may allocate it, or you can spawn it from another job on the same claim using **Create Make-Safe** on the job header.

This page is the stage map. Use [Completing a Builder Make Safe Job](completing-a-builder-make-safe-job.md) as the checklist.

## Key Concepts

- **Builder Make Safe** — job type for temporary safety works. The type badge must read **Builder Make Safe**.
- **Parent job** — when you create Make Safe from an assessment or works job, **Overview** shows **Parent job** with a link back to the master job.
- **Make-safe required** — yes/no on **Overview**. Setting this to no is how you cancel a Make Safe that is no longer needed.
- **Estimate** — price the make-safe works on **Customers → Estimates** (`/quotes`). After approval, extra cost is a **variation**, not a second original quote.
- **Create Make-Safe drawer** — header action on a non–Make Safe job that already has a linked claim.

## Accessing Builder Make Safe Jobs

1. Under **Customers**, click **Jobs**.
2. Open the job whose type is **Builder Make Safe**, or open the parent job and click **Go to Make-Safe**.

> **Required permission:** `jobs.read` to view. Creating a Make Safe job from another job needs `jobs.create`. Editing dates and flags needs `jobs.update`.

## Creating a Make Safe Job from Another Job

Use this when you discover make-safe need during an assessment or other visit, and the insurer has not already allocated a Make Safe job.

### When the button appears

| Header button | Meaning |
|---------------|---------|
| **Create Make-Safe** | This job has a linked claim, a Builder Make Safe type exists for your organisation, and this job is *not* already a Make Safe job. |
| **Go to Make-Safe** | A Make Safe job already exists on this claim (or as a child of this job). Opens that job. |
| Hidden | You are already on a Builder Make Safe job, the job has no claim, or the Make Safe type is not configured. |

### Using the Create Make-Safe drawer

1. Open the parent job (usually a Builder Assessment).
2. Click **Create Make-Safe** in the header.
3. Review the drawer **Create Make-Safe job**. The summary includes:
   - **Job type** — Builder Make Safe
   - **Make-safe required** — Yes
   - **Parent job** — the job you are on
   - **Assignee** — carried from the parent when set
   - **Site address** — carried from the parent
   - **Claim** — claim number or external reference
4. Read the notice that submitting creates the job on the linked claim and cannot be undone from this screen.
5. Click **Create Make-Safe**.
6. When the success drawer appears, click **Open Make-Safe job**.

The new job is named from the claim number plus “Make Safe” when a claim number exists. It inherits address, assignee, **Collect excess**, **Excess**, and **Instructions** from the parent where those values are set.

> **Warning:** A linked claim is required. If the drawer cannot submit, open **Overview** and confirm **Parent claim** is populated.

> **Note:** You still complete contact, booking, and the estimate on the *new* Make Safe job. Creating it is allocation, not completion.

## What You Will See on the Job

Same tabs as other jobs: **Overview**, **Parties**, **Reports**, **Attachments**, **Timeline**. **Type Details** is not used for Builder Make Safe.

| Overview field | Role on Make Safe |
|----------------|-------------------|
| **Make-safe required** | Must stay yes while work is needed. Set to no to cancel. |
| **Request date** | When the job was allocated or created |
| **Contact / booked / attendance dates** | Same contact-and-book pattern as assessment |
| **Completed date** | Date temporary works finished on site |
| **Auto approval applies** | Whether your delegated authority can approve the make-safe estimate |
| **Collect excess / Excess** | Carried from the claim or parent; excess is not usually collected on Make Safe |

**Claim recommendation** on a Make Safe allocation is often already **Accept** so auto-approval can apply. Confirm it if your process requires it on the related assessment or estimate.

## Workflow Stages

### 1. Allocation or spawn

Either:

- The insurer allocates a Builder Make Safe job (it appears on **Jobs** / **Dashboard**), or
- You create it with **Create Make-Safe** as above.

At this stage, claim data and **Request date** are populated. A **Call to Schedule** task is typically open.

1. Read **Instructions** and the risk address.
2. Confirm **Make-safe required** is yes.
3. Assign the attending trade if needed.

### 2. Contact the customer

1. Call using **Parties**.
2. Complete **Call to Schedule** on **Operations → Tasks**.
3. Confirm **Contact date** and **Attendance due date** on Overview.

> **Note:** Completing the task may fill those dates and create **Book Site Attendance**.

### 3. Book attendance

1. Click **Add Appointment** next to **Booked date**, or create an appointment from **Operations → Appointments**.
2. Save the onsite inspection (or make-safe attendance) time.
3. Confirm **Booked date** and **Attendance date**.

> **Tip:** If you book the appointment first, **Call to Schedule** may complete automatically. Still make the actual phone call.

### 4. Attend and complete make-safe works

Attend at the booked time. Typical works:

- Temporary roof protection or tarp
- Boarding windows or doors
- Temporary fencing
- Isolating unsafe building elements
- Temporary weatherproofing

Photograph before and after in a **Journal** on this job.

If you find the property does **not** need temporary works:

1. On **Overview**, set **Make-safe required** to no.
2. Expect the job to move to cancelled.

> **Warning:** Only set **Make-safe required** to no when you are sure. That cancels the Make Safe job.

### 5. Record completion on the job

1. Set **Completed date** on **Overview → Job Dates & Approval** to the day works finished.
2. Upload photos and any make-safe report to **Documents** with this job selected (or confirm they appear on **Attachments**).

After **Attendance date** passes, status may move to awaiting submission and a **Submission Required** task may appear.

### 6. Submit the make-safe estimate

Price what you actually did (and any materials left on site).

1. On the job header, click **Create Estimate**.
2. Set **Type** to **Quote** (there is no separate “Make Safe” estimate type — use **Quote** unless your organisation standardises on another listed type).
3. Add line items, then **publish**. Publishing is the submission; saving a draft is not.

| Approval path | What happens |
|---------------|--------------|
| Auto-approval applies and the figure is within authority | Estimate may approve and a purchase order appears |
| Insurer review | Wait for approved, resubmission required, cash settled, declined, or cancelled |

> **Required permission:** `procurement.manage` to create and publish the estimate.

If the outcome is **resubmission required**, revise the estimate and publish again. See [Creating an Estimate](../estimates/creating-an-estimate.md).

### 7. Invoice

Once a purchase order exists for the approved amount:

1. Open **Customers → Invoices** and create an invoice on this job.
2. Invoice at or below the remaining PO value.

> **Note:** One purchase order is typical per Make Safe job. Later approved variations add lines to that same PO rather than opening a second one.

### 8. Variations after approval

If you discover extra make-safe cost after the first estimate is approved:

1. Create a new estimate on the **same** job.
2. Set **Type** to **Variation** (or **Variation - PC/PS** when that is the correct commercial type).
3. Set **Reason for variation** when the form requires it.
4. Publish and wait for approval.

Full steps: [Creating a Variation](../estimates/creating-a-variation.md).

> **Warning:** Do not bury extra cost in an informal email. Only published variations can be invoiced against the PO.

## Related Records

| Record | Where |
|--------|--------|
| Parent job | **Overview → Parent job** (Open master job) |
| Assessment findings | Parent job’s **Assessments** — the Make Safe *job* is the works vehicle |
| Estimate / variation | **Customers → Estimates** |
| Invoice | **Customers → Invoices** |
| Purchase order | **Vendors → Purchase Orders** |
| Evidence | **Journals** and **Documents** on this job |

## Best Practices

1. **Spawn Make Safe from the job that found the risk** so claim, address, and parent link stay correct. Do not create a disconnected job unless the insurer allocated one themselves.
2. **Photograph before and after.** Temporary works disappear; the photos are the proof.
3. **Publish the estimate the day works finish** when you can. Attendance date passing without a quote leaves **Submission Required** hanging.
4. **Record Completed date.** Status and invoicing often depend on it.
5. **Cancel cleanly** with **Make-safe required = no** when nothing was needed — do not leave an allocated job idle.
6. **Use variations for extras**, including negative variations when you did less than quoted.
7. **Do not collect excess on Make Safe** unless instructions explicitly say so. Excess usually belongs to the later Works job.
