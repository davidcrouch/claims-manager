---
title: "Creating a Variation"
slug: creating-a-variation
description: "How to create a variation estimate after approval — types, reason for variation, take-off of the delta, and publish."
section: operations
area: estimates
routes:
  - /quotes
  - /quotes/[id]
audience: member
permissions_discussed:
  - procurement.read
  - procurement.manage
tags:
  - estimates
  - variations
  - take-off
  - make safe
  - works
related_guides:
  - estimates-overview
  - creating-an-estimate
  - publishing-an-estimate
  - builder-make-safe-workflow
  - builder-works-workflow
  - purchase-orders
  - work-orders-overview
version: 1
last_updated: 2026-08-31
---

# Creating a Variation

A **variation** is a new estimate used when an *already approved* estimate must change — extra work, higher or lower cost, or items that are no longer required. You do not unlock or silently edit the original published estimate.

This guide uses EnsureOS estimate types and fields as they appear on **Estimates** (`/quotes`). Create a new estimate on the **same job** that owns the approved scope, set a variation type, record the reason, take off only the change, then publish.

## Key Concepts

- **Approved estimate** — locked after publish and approval. Its take-off stays as the historical baseline.
- **Variation** — a separate estimate record whose type is **Variation** or **Variation - PC/PS**.
- **Reason for variation** — a free-text field on the Overview **Schedule** card. Fill it after create (it is not on the create drawer).
- **Delta take-off** — only the added, removed, or repriced lines. Do not copy the entire original quote onto the variation unless you intend to restate the whole scope.
- **Negative amounts** — removed or reduced items are entered as a negative quantity or negative rate so the variation total can go down.

## When to Create a Variation

Create a variation when **all** of the following are true:

1. A quote / estimate on the job has already been **approved**, and
2. You need **additional work**, a **cost increase or decrease**, or **approved items are no longer required**.

This is most common on **Builder Make Safe** and **Builder Works** jobs. Typical examples:

- Extra damage found after works started
- Scope of repairs changed
- Previously approved costings need adjusting
- Items are no longer required and must come off the authorised amount

> **Warning:** Do not edit the original approved estimate. It is locked after publish. A silent change would break the audit trail the insurer and your finance team rely on.

> **Note:** If the original is still a **Draft**, change that draft — you do not need a variation yet.

## Variation Types in EnsureOS

Estimate **Type** is a dropdown (create drawer and Overview **Estimate type**). The live options include two variation types among the full list:

| Type | Use when |
|------|----------|
| **Variation** | Standard change: add items, adjust prices or quantities, or remove items |
| **Variation - PC/PS** | The original approved line was a prime-cost or provisional-sum allowance, and the actual cost is now known |

Other types on the same dropdown (**Quote**, **Scope Of Work**, **Tender Quote**, **Validation**, **Liability Quote**) are *not* variations. Do not pick **Quote** for a post-approval change.

### Variation (standard)

Use for:

- Additional items
- Price or quantity adjustments
- Removing items (enter negative quantity or negative cost)

Always complete **Reason for variation** on Overview after the draft exists.

### Variation - PC/PS

Use when the approved line was an *allowance* (materials, fixtures, or similar) and you now have the actual cost. The variation adjusts the authorised amount to that actual.

There is no separate “Negative Variation” type in EnsureOS. For a cost decrease, keep type **Variation** (or **Variation - PC/PS** if it is an allowance true-up) and enter **negative** figures on Take Off. Describe the decrease in **Reason for variation**.

## Accessing Create Variation

There is no separate “Create Variation” button. A variation is an estimate with a variation type.

1. Under **Customers**, click **Estimates** (optionally with the job selected so `?jobId=` scopes the list).
2. Click **Create Estimate**.
3. Select the **job that owns the approved estimate** (required).
4. Set **Type** to **Variation** or **Variation - PC/PS**.
5. Complete name, estimate date, and expiry as for any estimate.
6. Click **Create Estimate**.

> **Required permission:** `procurement.manage` to create; `procurement.read` to view.

### Job linkage

The create form **requires a job**. There is no parent-estimate control and no “duplicate quote” action on the estimate page.

- Always create the variation **on the job the change applies to**.
- Do **not** attach a Works variation to a Builder Assessment job just because that is where the first quote lived.

If you need a reminder of the original numbers, open the approved estimate in another tab and read its Take Off — then enter only the delta on the new record.

## Recording the Reason

1. Open the new draft.
2. On **Overview**, find the **Schedule** card.
3. Enter **Reason for variation** (for example “Additional ceiling damage in bedroom 2” or “Negative variation — unused tiles no longer required”).
4. Wait for autosave.

> **Note:** Reason for variation is available on every estimate type, but you should treat it as **required for variation types** so reviewers understand why a second estimate exists.

## Building the Variation Take-Off

1. Open **Take Off**.
2. Add groups that match how the change should be read (often fewer groups than the original).
3. Add only:
   - New catalogue or free-typed lines for extra work
   - Lines with **negative** quantity or rate for removals and cost decreases
   - Adjusted PC/PS lines for **Variation - PC/PS**
4. Do not re-enter the entire approved take-off unless your organisation’s process is a full restatement (EnsureOS does not clone the original for you).

Scan price drift and set **Update Mode** the same way as a normal estimate. Write-back still requires `catalogs.update-from-estimate`.

## Publishing and Approval

Publish the variation with the same wizard as a first estimate — see [Publishing an Estimate](publishing-an-estimate.md).

1. Complete parties and reason.
2. Click **Publish** / **Submit to Insurer**.
3. Status becomes **Pending** and the variation locks.

What happens next:

- **Insurer jobs** — the insurer reviews the variation. Line decisions appear on Take Off when they respond.
- **Internal jobs** — use **Received Approval** when approval arrives; that marks the variation **Approved** and can create a work order.

Once approved, variation lines may update the **purchase order** (and authorised value) on that job. If a PO was already completed, a newly approved variation can cause it to be worked again — confirm on [Purchase Orders](../vendors/purchase-orders.md) before you invoice.

You can then invoice the updated authorised amount from the work order.

> **Warning:** Publishing a variation on an insurer-connected job notifies the insurer. Submit only the intended delta.

## Finding Variations on the List

1. Open **Estimates**.
2. Use **Filter by estimate type** or the Type column filter.
3. Select **Variation** and/or **Variation - PC/PS**.

The type badge also appears on the detail header (it is hidden only when the type is the generic Estimate/Quote label).

## Best Practices

1. **One variation per commercial event** where possible, with a clear **Reason for variation**, rather than many unexplained micro-estimates.

2. **Take off the delta only.** Re-quoting the entire job as a new Quote type hides what changed and risks double-counting.

3. **Use negative figures for reductions.** There is no separate negative type — the sign on the line *is* the decrease.

4. **Use Variation - PC/PS only for allowance true-ups**, not for ordinary extras.

5. **Create the variation on the Works or Make Safe job** that will carry the PO — never on an unrelated assessment job.

6. **Publish promptly** once the site change is agreed, so the locked original and the variation stay in sequence.

7. **Check the job PO after approval** before raising an invoice, so you bill the updated authorised value rather than the first estimate total.
