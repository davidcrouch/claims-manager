---
title: "Builder Works Workflow"
slug: builder-works-workflow
description: "How a Builder Works job runs in EnsureOS — allocation after quote approval, scope, excess, schedule, completion certificate, and invoice."
section: operations
area: jobs
routes:
  - /jobs
  - /jobs/[id]
  - /work-orders
  - /quotes
  - /invoices
  - /purchase-orders
audience: member
permissions_discussed:
  - jobs.read
  - jobs.update
  - procurement.read
  - procurement.manage
  - invoices.create
  - documents.manage
  - workflows.manage
tags:
  - builder works
  - jobs
  - work orders
  - estimates
  - variations
  - invoices
  - workflow
  - playbook
related_guides:
  - completing-a-builder-works-job
  - creating-a-variation
  - creating-an-estimate
  - work-orders-overview
  - builder-assessment-workflow
  - job-lifecycle
version: 1
last_updated: 2026-08-31
---

# Builder Works Workflow

A **Builder Works** job is the repair phase. It is allocated after the insurer approves the Builder Assessment estimate. You send the customer a scope or contract, collect excess if required, schedule trades, complete the repairs, upload a completion certificate, and invoice against the approved purchase order.

This page is the stage map. Use [Completing a Builder Works Job](completing-a-builder-works-job.md) as the checklist.

## Key Concepts

- **Builder Works** — job type for approved repairs. Confirm the type badge before you schedule anyone.
- **Approved purchase order** — created from the approved assessment estimate. Invoice against this PO (and later variations), not a guessed total.
- **Scope / contract** — the customer-facing description of work. Generate **Scope of Work** from the estimate printer, or upload a signed contract to the job filesystem.
- **Excess** — **Collect excess** and **Excess** on **Overview** tell you whether to invoice the customer before works start.
- **Work order** — optional document you issue to a subcontractor under **Customers → Work Orders**. The Works *job* remains the insurer-facing record.
- **Variation** — any cost or scope change after the original approved estimate.

## Accessing Builder Works Jobs

1. Under **Customers**, click **Jobs**.
2. Open the job whose type is **Builder Works**.
3. Confirm **Parent claim** and, when present, **Parent job** (the assessment job).

> **Required permission:** `jobs.read` to view; `jobs.update` to change status, dates, and instructions.

> **Tip:** Newly allocated Works jobs appear on the **Dashboard**. The assessment estimate you published earlier should now show as approved on **Customers → Estimates**.

## What You Will See on the Job

Tabs: **Overview**, **Parties**, **Reports**, **Attachments**, **Timeline**. **Type Details** is not used for Builder Works (it appears only for types such as temporary accommodation or specialist).

| Overview area | What matters for Works |
|---------------|------------------------|
| **Core Details** | Status, request date, **Collect excess**, **Excess** amount, parent claim |
| **Job Dates & Approval** | Contact/booked/attendance dates if used, **Completed date**, auto approval (for variations) |
| **Instructions** | Insurer conditions on the repair |
| **Parent claim** | Policy, date of loss, account |

Header actions you will use: **Create Estimate** (variations), **Create Make-Safe** if a new safety issue appears, **Print PDF** (job details; **Scope of Work** is printed from the estimate).

## Workflow Stages

### 1. Allocation after quote approval

When the assessment estimate is approved:

- A Builder Works job appears on **Jobs**.
- Claim data and **Request date** are populated.
- A **purchase order** is created with the approved repair items — open **Vendors → Purchase Orders** with the job selected.
- Tasks typically include **Send Scope/Contract**, **Send Excess** (if excess is required), and a recurring **Repair Update**.

1. Open the Works job and read **Instructions**.
2. Open the PO and confirm line items match the approved estimate.
3. Assign a supervisor if needed.

> **Note:** Do not start repairs at allocation. Scope must be with the customer, and excess must be collected when **Collect excess** is yes.

### 2. Send the scope or contract

Provide the repair scope to the customer for review and signature (the conversation may happen off-platform; you record it here).

1. Open the approved estimate under **Customers → Estimates**.
2. Click the **printer** icon and generate **Scope of Work** (descriptions without pricing) or **Estimate** if the customer should see prices.
3. Send the file to the customer (email or **Communications**).
4. Complete **Send Scope/Contract** on **Operations → Tasks**, or move job **Status** to the awaiting-scope value your organisation uses.

When the customer returns a signed copy:

1. Upload the signed file to **Operations → Documents** with this job selected.
2. Complete **Signed Scope/Contract**.

> **Note:** Completing those tasks (or the matching status) may record that the scope was sent and signed. Repairs should not be scheduled until the signed-scope task is done.

> **Required permission:** `documents.manage` to upload the signed contract; `workflows.manage` to complete tasks.

### 3. Collect excess if required

On **Overview**, check **Collect excess** and **Excess**.

If excess is **not** required, skip this stage.

If it is required:

1. Create a customer invoice for the excess amount under **Customers → Invoices** (or issue it in your finance system and record it here).
2. Complete **Send Excess** when the invoice has gone to the customer.
3. When the customer pays, complete **Collect Excess**.

> **Warning:** Do not commence repairs while **Collect excess** is yes and **Collect Excess** is still open. The PO may show a **total minus excess** figure — that is what you later invoice the insurer.

### 4. Schedule the works

Once scope is signed and excess is collected (if applicable), a **Schedule Repairs** task is typically created.

1. Open **Operations → Schedule** and **Appointments** with this job selected.
2. Book trade attendance (and any internal supervisor visit).
3. Complete **Schedule Repairs**.
4. Use **Work Orders** if you are issuing a formal order to a subcontractor — see [Work Orders](../work-orders/overview.md).

> **Tip:** Put start and finish expectations in the appointment and in a **Repair Update** message so the insurer sees the programme.

### 5. Commence and complete repairs

On the agreed start date:

1. Complete **Commence Repairs** (or set status to repairs in progress).
2. Keep completing **Repair Update** when it recurs (often every few business days) until works are finished. Send the update through **Communications** if that is how your organisation notifies the insurer.

When all repairs in the approved scope (plus approved variations) are done:

1. Set **Completed date** on Overview.
2. Move status to repairs complete if you update status by hand.
3. Complete any remaining repair tasks.

> **Note:** Completing **Commence Repairs** may create **Upload Completion Certificate**.

### 6. Upload the completion certificate

The customer (or your supervisor) confirms the job is finished.

**Option A — signed certificate**

1. Open **Operations → Documents** with the Works job selected.
2. Upload the signed certificate.
3. Classify it as **Completion Certificate** (document type or the matching category).
4. Confirm the file appears on the job **Attachments** tab.

**Option B — verbal confirmation only**

1. Record the confirmation date in job notes or the field your organisation uses for customer-confirmed completion.
2. Complete **Upload Completion Certificate** so the task does not stay open.

> **Warning:** A certificate uploaded only under **Company** (no job selected) is not on the Works job. Select the job first — the project filesystem *is* this job.

### 7. Invoice the insurer

1. Open the purchase order. If excess was collected, invoice the insurer the PO total minus excess.
2. Create the invoice on **Customers → Invoices** for this job.
3. Keep the amount at or below remaining PO value (including approved variation lines).

When approved invoices equal the PO, the PO typically moves to completed, and the job can complete.

## Variations During Works

If you find extra damage, dropped items, or a price change after the original estimate was approved:

1. On the Works job, click **Create Estimate**.
2. Set **Type** to **Variation**.
3. Publish and wait for approval.
4. Approved items add to the **same** purchase order.

See [Creating a Variation](../estimates/creating-a-variation.md).

> **Warning:** You cannot invoice extra cost that was never published as a variation. Negative variations belong here too when scope reduces.

## Related Records

| Record | Sidebar | Role |
|--------|---------|------|
| Purchase order | **Vendors → Purchase Orders** | Approved repair (and variation) items |
| Estimate / variation | **Customers → Estimates** | Original approval and later changes |
| Work order | **Customers → Work Orders** | Subcontractor instruction |
| Invoice | **Customers → Invoices** | Excess (customer) and repair (insurer) |
| Documents | **Operations → Documents** | Scope, signed contract, completion certificate |
| Tasks | **Operations → Tasks** | Scope, excess, schedule, commence, updates, certificate |
| Appointments / Schedule | **Operations** | Trade attendance |

## Best Practices

1. **Open the PO on day one.** If approved items disagree with what you thought you quoted, stop and resolve before you send a scope to the customer.
2. **Do not schedule trades before signed scope** (and excess, when required). Rework is expensive.
3. **Treat Repair Update as a promise.** Recurring tasks exist so the insurer is not chasing you.
4. **Issue work orders** when a subcontractor needs a written scope; keep the insurer conversation on the Works job.
5. **Upload the completion certificate to the job**, with the correct type, the day the customer signs.
6. **Variation first, then extra work** unless there is an immediate safety issue (then use **Create Make-Safe**).
7. **Invoice the insurer net of excess** when **Collect excess** was yes, so you are not paid twice for the same dollars.
