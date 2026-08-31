---
title: "Completing a Builder Works Job"
slug: completing-a-builder-works-job
description: "Numbered checklist to complete a Builder Works job — scope, excess, schedule, repairs, completion certificate, and invoice."
section: operations
area: jobs
routes:
  - /jobs
  - /jobs/[id]
  - /documents
  - /invoices
audience: member
permissions_discussed:
  - jobs.read
  - jobs.update
  - documents.manage
  - invoices.create
  - procurement.manage
  - workflows.manage
tags:
  - builder works
  - checklist
  - completion certificate
  - invoices
  - documents
related_guides:
  - builder-works-workflow
  - creating-a-variation
  - work-orders-overview
  - uploading-documents
  - creating-an-invoice
version: 1
last_updated: 2026-08-31
---

# Completing a Builder Works Job

Use this checklist when you are delivering approved repairs on a **Builder Works** job. For the stage map, see [Builder Works Workflow](builder-works-workflow.md).

## Key Concepts

- **Approved scope** — you repair what the purchase order contains, plus later approved variations.
- **Customer gates** — signed scope (and excess, if flagged) before you schedule.
- **Completion evidence** — signed **Completion Certificate** on the job filesystem, or a recorded verbal confirmation plus the matching task completed.

## Accessing the Job

1. Under **Customers**, click **Jobs**.
2. Open the **Builder Works** job allocated after the assessment estimate was approved.
3. Keep this job selected in the header picker for Documents, Tasks, Invoices, and Work Orders.

> **Required permission:** `jobs.read` to open; `jobs.update` and `workflows.manage` to progress tasks and dates.

## Checklist

### 1. Confirm allocation and the purchase order

1. Read **Overview → Instructions**.
2. Confirm type **Builder Works**, parent claim, **Collect excess**, and **Excess**.
3. Open **Vendors → Purchase Orders** with the job selected.
4. Check approved items against the assessment estimate.

> **Tip:** If the PO is missing, wait for sync or ask a manager to confirm the estimate is approved. Do not start works on a verbal “you’re approved”.

### 2. Send the scope or contract

1. Open the approved estimate under **Customers → Estimates**.
2. Click the **printer** icon and generate **Scope of Work** (or **Estimate** if prices should be visible).
3. Send it to the customer.
4. Complete **Send Scope/Contract** on **Operations → Tasks**.

### 3. Record the signed scope

1. When the customer returns the signed document, open **Operations → Documents** with this job selected.
2. Upload the file into the job project folders.
3. Complete **Signed Scope/Contract**.

> **Required permission:** `documents.manage`.

> **Warning:** Do not schedule trades until this task is done.

### 4. Send and collect excess (only if required)

Skip if **Collect excess** is no.

1. Raise the customer excess invoice (**Customers → Invoices**).
2. Complete **Send Excess**.
3. When paid, complete **Collect Excess**.

### 5. Schedule repairs

1. Complete any remaining gates (signed scope; excess if required) so **Schedule Repairs** is available.
2. Book trades on **Operations → Schedule** / **Appointments**.
3. If you use subcontractors, create a **Work Order** from **Customers → Work Orders** — see [Work Orders](../work-orders/overview.md).
4. Complete **Schedule Repairs**.

### 6. Commence repairs

1. On the start date, complete **Commence Repairs**.
2. Keep the photo journal up to date on **Customers → Journals**.

### 7. Send repair updates

1. When **Repair Update** appears, write a short progress note.
2. Complete the task (a new one may be created a few business days later).
3. Repeat until repairs are finished.

### 8. Complete the repairs

1. Confirm every PO line (and approved variation) is done.
2. Set **Completed date** on **Overview → Job Dates & Approval**.
3. Update status to repairs complete if you manage status by hand.

### 9. Upload the completion certificate

1. Open **Operations → Documents** with the Works job still selected.
2. Click **Upload** and add the signed certificate PDF.
3. Classify the file as **Completion Certificate**.
4. Confirm it is listed on the job **Attachments** tab.
5. If the customer only confirmed verbally, record that confirmation and complete **Upload Completion Certificate** so the task closes.

> **Warning:** Uploading to the company filesystem (no job selected) does not complete this job. Select the job first.

### 10. Invoice the insurer

1. Open the PO. If excess was collected, use the net (total minus excess) as the insurer invoice amount.
2. Open **Customers → Invoices** and create the invoice on this job.
3. Stay at or below remaining PO value.

> **Required permission:** `invoices.create`.

### 11. Variations for cost or scope changes

If you need more (or less) than the approved PO:

1. Click **Create Estimate** on the Works job.
2. Set **Type** to **Variation**.
3. Publish and wait for approval before doing or invoicing the extra work — unless you must make the site safe, in which case use **Create Make-Safe**.

See [Creating a Variation](../estimates/creating-a-variation.md).

### 12. Confirm job completion

The job can complete when:

- The completion certificate is on the job (or verbal completion is recorded), and
- The purchase order is fully invoiced (status completed).

Do not archive the job while the insurer is still reviewing the final invoice.

## Documents You Typically Upload

| File | Document type / category | When |
|------|--------------------------|------|
| Scope or contract (signed) | Contract / scope category used by your organisation | After the customer signs |
| Progress photos | Journal pages (preferred) or job documents | During works |
| Completion certificate | **Completion Certificate** | When the customer signs off |
| Variation backup | On the variation estimate or job documents | When extras are claimed |

## Best Practices

1. **Walk the PO before the first site day** so missing items are variations, not surprises.
2. **Keep the job selected** for every upload.
3. **Close Repair Update the day you have news**, even if the news is “waiting on materials”.
4. **Do not invoice extras without a published variation.**
5. **Photograph completion** as well as uploading the certificate.
6. **Net excess out of the insurer invoice** so finance and the PO stay aligned.
7. **Create Make-Safe from this header** if you uncover a new safety issue mid-repair — do not hide it inside a works variation unless the insurer asks you to.
