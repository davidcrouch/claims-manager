---
title: "Work Orders"
slug: work-orders-overview
description: "How to find, accept, and progress work orders, including creating them from a locked estimate and the Dashboard accept queue."
section: operations
area: work-orders
routes:
  - /work-orders
  - /work-orders/[id]
audience: member
permissions_discussed:
  - procurement.read
  - procurement.manage
  - invoices.create
tags:
  - work orders
  - accept
  - estimates
  - invoices
  - dashboard
related_guides:
  - estimates-overview
  - publishing-an-estimate
  - creating-an-invoice
  - invoices-overview
  - purchase-orders
  - dashboard
  - jobs-overview
version: 1
last_updated: 2026-08-31
---

# Work Orders

A **work order** is an instruction to a crew or vendor to perform scoped work on a job. It often follows an approved estimate and sits between “price agreed” and “invoice the insurer”. Line items on the work order are read-only in EnsureOS; you progress the record with status actions and, when ready, **Create Invoice**.

This guide covers the list, detail tabs, creating a work order from an estimate or the list, accepting issued work, and the Dashboard **Work orders to accept** queue.

## Key Concepts

- **Work order (WO)** — instruction to proceed. Not a price offer (that is an [estimate](../estimates/overview.md)) and not a vendor bill (that is a bill / PO).
- **Purchase order (PO)** — the authorised commercial document (often from the insurer). Creating a WO from the list or estimate drawer **requires a PO** on that job.
- **Estimate** — priced scope. Approving an *internal* estimate can **automatically create** a work order; you can also click **Create Work Order** on a locked estimate.
- **Accept / Decline** — header actions when status is **Issued**. Dashboard lists work orders still waiting on that decision.
- **Insurer PO** — the insurer’s purchase-order reference shown on the list and Overview.

## Accessing Work Orders

1. In the left sidebar, under **Customers**, click **Work Orders**.
2. The list opens at `/work-orders`. A selected job scopes the list with `?jobId=`.
3. Click a row to open `/work-orders/[id]`.

> **Required permission:** `procurement.read` to view the list and detail. `procurement.manage` to create work orders and change status (Accept, Start Work, Complete). Creating an invoice from a work order also needs `invoices.create`.

## The Work Orders List

The header title is **Work Orders**, with a status breakdown and **Total value** of visible rows.

Header actions:

- **Create Work Order** — opens the create drawer (job + purchase order).
- **Print** — prints or downloads the current list.

On the filter row:

- **Active** / **Archived** / **All**
- Search by **WO #, insurer PO or name**
- **Filter by type**
- **Capture External PO** — records a purchase order that arrived from outside EnsureOS

| Column | Contents |
|--------|----------|
| **Work Order #** | Internal number / name |
| **Insurer PO** | Insurer purchase-order reference |
| **Job** | Linked job (filterable) |
| **Status** | Current status (filterable) |
| **Type** | Work order type (filterable) |
| **From (upstream)** | Source reference; **External** chip when it came from another organisation |
| **Total** | Amount |
| **Start** / **Updated** | Dates |

Click a row to open detail. Archive from the row action without opening the record.

> **Tip:** If you arrived from Dashboard **Work orders to accept**, the list may already be filtered to statuses such as Received, Issued, or Draft.

## Opening a Work Order

The detail header shows status, type, upstream source, job link, optional **View Claim**, plus **Total**, **Start**, and **End**.

### Status actions

Actions depend on the current status name:

| Status | Header buttons |
|--------|----------------|
| **Issued** | **Accept** and **Decline** |
| **Accepted** | **Start Work** |
| **In Progress** | **Complete** |

Always available:

- **Create Invoice** — opens the invoice drawer with this work order selected
- **Print**
- **Archive**

> **Note:** Accept / Decline only appear when the status label is exactly **Issued**. Other waiting statuses (for example **Received** or **Draft**) still show on Dashboard; open the record and confirm status, or progress it according to your organisation’s lookups.

## Detail Tabs

| Tab | Purpose |
|-----|---------|
| **Overview** | Identifiers, service window, financials, note, scope of work |
| **Parties** | WO To (this tenant / vendor), WO For (insured / customer), WO From (issuing upstream) |
| **Line Items** | Read-only groups and lines (often inherited from the estimate or PO) |
| **Timeline** | Local created / updated audit |

### Overview fields

**Identifiers** include insurer PO, WO/PO number, external id, name, status, type, and vendor (this tenant).

**Service Window** includes start/end dates and times, and expires-in days.

**Financial** includes total, adjusted total, and adjustment amount.

**Note** and **Scope of Work** appear when those texts are present.

## Creating a Work Order

### From a locked estimate

On an estimate that has been published (locked):

1. Open the estimate.
2. Click **Create Work Order** in the header.
3. The **Create Work Order** drawer opens with the estimate’s job set.
4. Select a **Purchase Order** on that job (required).
5. Optionally enter work order number, name, start/end dates, total, and note.
6. Click the submit control to create the work order and open it.

If the job has no PO yet, the purchase-order dropdown is empty — capture or receive a PO first.

### From internal estimate approval

On a **Pending** *internal* estimate, **Received Approval** marks the estimate approved and **automatically creates a work order** for the job (inheriting claim and total). Use **View Work Order** on the success toast, then edit dates or notes as needed.

### From the Work Orders list

1. Click **Create Work Order**.
2. Pick a **job** if the picker is shown.
3. Select a **Purchase Order** (required).
4. Fill optional number, name, dates, total, and note.
5. Submit. EnsureOS opens the new work order.

> **Note:** The list drawer always links the WO to a PO. The estimate approval path is the exception that can spawn a WO from the estimate totals without you picking a PO in that wizard.

## Accepting Work from the Dashboard

The Dashboard **Needs a decision** panel includes **Work orders to accept** when any work orders are in Received, Issued, or Draft (the accept queue).

1. Open **Dashboard**.
2. In **Needs a decision**, find **Work orders to accept** (the chip may show a shortened label).
3. Click the chip to open the filtered Work Orders list, or click a row to open that work order.
4. If status is **Issued**, click **Accept** (or **Decline** if you will not take the work).
5. After **Accepted**, click **Start Work** when the crew begins, then **Complete** when finished.

Counts on Dashboard drop after the work order leaves those waiting statuses.

> **Required permission:** The queue only lists work orders your role can already read (`procurement.read`).

## Creating an Invoice from a Work Order

1. Open the work order.
2. Click **Create Invoice**.
3. The invoice drawer is pre-filled with this work order (and its PO when present).
4. Complete optional invoice number, amounts, and dates, then create the draft.
5. Publish from the invoice page — see [Creating an Invoice](../invoices/creating-an-invoice.md).

Do not invoice before the job milestone your organisation expects (for example works complete or report submitted). Match the authorised PO amount where one exists.

## Work Order vs Estimate vs PO

| Document | Role |
|----------|------|
| **Estimate** | Your priced offer; locked after publish |
| **Purchase order** | Authorised spend (often insurer-issued) |
| **Work order** | Instruction to perform the authorised scope |
| **Invoice** | You bill the insurer/customer against the WO / PO |

## Best Practices

1. **Accept issued work orders the same day they appear on Dashboard** so crews are not waiting on a click.

2. **Do not create a second WO** for the same approved estimate unless your process is split (for example a separate variation WO after a variation PO).

3. **Create the WO from the estimate or approval wizard** when you have just approved pricing, so job and totals stay aligned.

4. **Require a PO** before list-created WOs so finance can match invoices later.

5. **Progress status in order** — Accept → Start Work → Complete — so list filters and Dashboard stay meaningful.

6. **Use Capture External PO** when the insurer sent a PO outside EnsureOS, then create the work order against it.

7. **Raise invoices from the work order**, not as orphan invoices, so line items and PO links carry through.
