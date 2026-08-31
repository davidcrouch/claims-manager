---
title: "Completing a Builder Make Safe Job"
slug: completing-a-builder-make-safe-job
description: "Numbered checklist to complete a Builder Make Safe job — contact, attend, record works, publish the estimate, and invoice."
section: operations
area: jobs
routes:
  - /jobs
  - /jobs/[id]
  - /quotes
audience: member
permissions_discussed:
  - jobs.read
  - jobs.update
  - jobs.create
  - procurement.manage
  - invoices.create
  - documents.manage
  - journals.manage
  - workflows.manage
tags:
  - make safe
  - builder make safe
  - checklist
  - estimates
  - variations
related_guides:
  - builder-make-safe-workflow
  - creating-an-estimate
  - creating-a-variation
  - uploading-documents
  - completing-a-builder-assessment-job
version: 1
last_updated: 2026-08-31
---

# Completing a Builder Make Safe Job

Use this checklist on a **Builder Make Safe** job. For the stage map and the **Create Make-Safe** drawer, see [Builder Make Safe Workflow](builder-make-safe-workflow.md).

## Key Concepts

- **Safety first** — this job is temporary protection, not the full repair. Scope only what you need to make the site safe.
- **Estimate versus variation** — the first published **Quote** on this job is the original make-safe estimate. Anything after insurer approval is a **Variation**.
- **Evidence** — journals and job documents prove the works; **Completed date** records when they finished.

## Accessing the Job

1. Under **Customers**, click **Jobs**, and open the **Builder Make Safe** job.
2. Or, from the parent assessment/works job, click **Go to Make-Safe**.

If the job does not exist yet and you are on the parent:

1. Click **Create Make-Safe** in the header.
2. Review parent job, claim, address, and assignee.
3. Click **Create Make-Safe**, then **Open Make-Safe job**.

> **Required permission:** `jobs.read` to open; `jobs.create` to spawn from a parent; `jobs.update` to edit dates and **Make-safe required**.

## Checklist

### 1. Confirm type, flags, and instructions

1. Confirm the type badge is **Builder Make Safe**.
2. On **Overview**, confirm **Make-safe required** is yes.
3. Read **Instructions**, address, priority, and parent claim.
4. If this job was spawned, use **Parent job** to open the master job when you need the assessment context.

> **Warning:** If **Make-safe required** is already no, the job may be cancelled. Do not start works until you know why.

### 2. Assign the attending trade

1. Set the assignee on the tab strip to the person or crew lead who will attend.

### 3. Contact the customer

1. Call from **Parties**.
2. Complete **Call to Schedule** on **Operations → Tasks**.
3. Confirm **Contact date** and **Attendance due date**.

### 4. Book attendance

1. Click **Add Appointment** beside **Booked date**, or create the appointment from **Operations → Appointments**.
2. Save the onsite time.
3. Confirm **Booked date** and **Attendance date**.

### 5. Attend and carry out temporary works

Typical actions: tarp, board-up, temporary fence, isolate unsafe elements, weatherproof.

1. Photograph the hazard before you start (**Customers → Journals**).
2. Complete the works.
3. Photograph the completed make-safe.

> **Required permission:** `journals.manage` for the photo journal.

### 6. If make-safe is not required after all

1. On **Overview**, set **Make-safe required** to no.
2. Stop. Do not publish a make-safe estimate for works you did not do.

> **Warning:** This cancels the Make Safe job. Use it only when the property does not need temporary works.

### 7. Record completion

1. Set **Completed date** to the day works finished.
2. Upload any written make-safe note or trade docket to **Operations → Documents** with this job selected.
3. Complete **Submission Required** when you are ready to quote, if that task is open.

### 8. Create and publish the make-safe estimate

1. Click **Create Estimate** on the job header.
2. Set **Type** to **Quote**.
3. Price labour, materials, and plant actually used.
4. Publish the estimate.

> **Required permission:** `procurement.manage`.

> **Warning:** Creating the estimate is not enough. It must be **published**. A draft will not move the job to insurer review.

### 9. Handle the approval outcome

| Estimate outcome | Your next step |
|------------------|----------------|
| Approved (or auto-approved) | Confirm the purchase order under **Vendors → Purchase Orders** |
| Resubmission required | Revise line items and publish again |
| Declined / cancelled / cash settled | Follow insurer instructions; do not invoice declined work |

Auto-approval typically needs **Auto approval applies = yes** and a figure within your delegated authority. If review is required, wait.

### 10. Invoice against the purchase order

1. Open **Customers → Invoices**.
2. Create an invoice for this job at or below remaining PO value.
3. Submit according to your finance process.

> **Required permission:** `invoices.create`.

### 11. Variations for extra (or reduced) cost

If costs change after the original quote is approved:

1. Click **Create Estimate** again on the **same** Make Safe job.
2. Set **Type** to **Variation**.
3. Enter **Reason for variation** when asked.
4. Publish and wait for approval before invoicing the extra.

See [Creating a Variation](../estimates/creating-a-variation.md).

### 12. Confirm the job can complete

Typical completion conditions:

- A make-safe estimate has been published (unless the job was cancelled).
- **Completed date** is set when works were done.
- Invoices have cleared the PO (when a PO exists).

Leave status to the lifecycle. Do not archive an active Make Safe job that the insurer is still reviewing.

## Estimate Versus Variation

| Situation | Type to choose |
|-----------|----------------|
| First price for this Make Safe job | **Quote** |
| Extra boarding, a second visit, or more materials after approval | **Variation** |
| Prime cost / provisional sum adjustment | **Variation - PC/PS** |
| Removing unused items after approval | **Variation** (negative / reduced items) |

## Best Practices

1. **Do the minimum that makes the site safe.** Over-scoping Make Safe delays Works and confuses the insurer.
2. **Always set Completed date** on the day, not the following week.
3. **Publish the same day you finish** when materials and hours are known.
4. **Keep Make Safe photos on this job**, not only on the parent assessment journal.
5. **One PO per Make Safe job** — extras go on variations, not a second original quote.
6. **Check Go to Make-Safe on the parent** before creating a duplicate.
7. **Never start full repairs on a Make Safe job.** That is a Builder Works allocation after quote approval.
