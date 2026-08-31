---
title: "Publishing an Estimate"
slug: publishing-an-estimate
description: "How to publish an estimate, understand internal vs insurer submit, record received approval, and work with a locked take-off."
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
  - publish
  - approval
  - locked
  - work orders
related_guides:
  - estimates-overview
  - creating-an-estimate
  - creating-a-variation
  - work-orders-overview
  - jobs-overview
version: 1
last_updated: 2026-08-31
---

# Publishing an Estimate

Publishing turns a draft estimate into a submitted record. The estimate is **locked**: take-off and most fields can no longer be edited. Depending on the job, publish either issues an internal PDF or sends the estimate to the insurer.

This guide walks the **Publish** wizard, what happens after submit, the **Received Approval** wizard, and how to handle a locked take-off.

## Key Concepts

- **Save** — autosave of draft fields and lines. The insurer never sees a save.
- **Publish** — submit the estimate. Status becomes **Pending** and the record locks.
- **Internal publish** — used when the job is not a Crunchwork (insurer-connected) job. A PDF is generated and downloaded; status still becomes Pending.
- **External publish** — used when the job provider is Crunchwork. The estimate is sent to the insurer for review.
- **Received Approval** — an internal confirmation that approval has arrived. Creates a linked work order. Shown only for **Pending** internal estimates.
- **Locked** — take-off, overview (except assignment), and parties are read-only.

## Accessing Publish

1. Open **Estimates** under **Customers** and click the draft estimate.
2. Confirm Take Off, Overview, and Parties are complete.
3. Click **Publish** in the header toolbar (printer-style publish control).

**Publish** only appears while the estimate is unlocked (typically status **Draft**, and no insurer external reference).

> **Required permission:** You need `procurement.manage` to publish. Viewers with only `procurement.read` can open the estimate but will not see a working publish action.

## Before You Publish

Walk these checks on the live page:

1. **Overview** — name, estimate date, expiry, and type are correct.
2. **Take Off** — groups and lines are complete; totals match what you intend to submit.
3. **Parties** — From, For, and To are filled.
4. For assessment-related jobs, finish the assessment recommendation first so the estimate matches the published findings.
5. If this is a variation, confirm **Reason for variation** on Overview.

> **Tip:** Use **Print** if you only need a PDF for local review. Print does not lock the estimate and does not notify the insurer.

## The Publish Wizard

Click **Publish**. A bottom drawer opens. The title and confirm button depend on the job:

| Job | Drawer title | Confirm button |
|-----|--------------|----------------|
| Not Crunchwork | **Publish estimate** | **Publish estimate** |
| Crunchwork (insurer) | **Publish estimate to Insurer** | **Submit to Insurer** |

### Step 1 — Read the warning

**Internal**

- The estimate will be locked after publish.
- A PDF is created from the assigned estimate template and downloaded.
- Status changes to **Pending**.
- Line items and estimate details cannot be edited afterwards.

**External (insurer)**

- Submitting creates the estimate for the insurer.
- Status changes to **Pending** and the estimate locks.
- This cannot be undone from this screen.

### Step 2 — Review the summary

The **Estimate Summary** card shows:

- Name
- Status
- Estimate number
- Reference
- Total
- Estimate date

Below that, claim and job context is shown so you can confirm you are publishing the right record.

### Step 3 — Confirm

1. Click **Cancel** to close without publishing, or
2. Click **Publish estimate** / **Submit to Insurer**.

The button shows **Publishing…** or **Sending to Insurer…** while the request runs. You cannot close the drawer during this step.

### Step 4 — Result panel

On success the drawer switches to a result view.

**Internal success**

- Status: **Pending**
- PDF generated: Yes (or a warning toast if PDF generation failed after a successful publish)
- Toast: **Estimate published and PDF downloaded** (or a warning if the PDF failed)

**External success**

- **Estimate sent to Insurer**
- Provider reference (when returned)
- Groups sent, items sent, assemblies sent
- Items excluded (not tagged for the provider), if any
- Scopes stripped (structural send only — this is normal)
- Status: **Pending (awaiting Insurer review)**

If the insurer side returned warnings, the title is **Published with warnings** and the list is shown in the drawer. Click **Done** to close and refresh the page.

> **Warning:** External publish notifies the insurer and creates the upstream estimate. Do not submit a half-finished take-off. There is no “unpublish” on this screen.

## Statuses After Publish

| Status | Meaning |
|--------|---------|
| **Draft** | Still editable; Publish is available |
| **Pending** | Submitted; locked; awaiting approval (internal or insurer) |
| **Approved** | Approval recorded; take-off remains locked |
| **Resubmission Required** | Reviewer asked for changes — create a new estimate or variation rather than editing the locked original |
| **Cancelled** / archived | No longer active; use list tabs **Archived** or **All** to find it |

Exact names come from your organisation’s status lookups. The list **Status** filter shows the live set.

On insurer-connected estimates, the Overview **Insurer Review** card shows awaiting review or approved, and reminds you that **per-line decisions appear on Take Off**.

## Recording Received Approval (Internal)

When status is **Pending** and the job is **not** Crunchwork, the header shows **Received Approval**.

1. Click **Received Approval**.
2. The **Received approval** drawer opens with step **1. Confirm Approval**.
3. Read the explanation: the estimate will be marked **Approved** and a **Work Order** will be created on the same job, inheriting claim and total.
4. Click **Confirm Approval** (or **Cancel**).

On success, a toast reads **Estimate approved — Work Order created**, with **View Work Order** when an id is returned.

> **Note:** This wizard is for *recording* approval that arrived outside the insurer integration (phone, email, portal). Insurer-connected jobs update approval from the insurer response; they do not show this button.

## Locked Take-Off

After publish:

- A **Locked** pill appears in the header.
- A banner states the estimate can no longer be edited, except for **Assigned**.
- Take Off is read-only. Catalogue, Add group, and Update Mode are hidden.
- **Create Work Order** appears so you can open a work order against the job (you still select a purchase order in that drawer).

To change price or scope after lock:

1. Do **not** try to force-edit the published take-off.
2. Create a [variation](creating-a-variation.md) on the same job.
3. Publish the variation through the same wizard.

Assignment (the person chip on the tab bar) can still be changed so the work does not stall if the original estimator is away.

## Best Practices

1. **Treat publish as irreversible on this screen.** Proof totals and parties on the draft first.

2. **Complete the assessment or recommendation** on assessment jobs before you submit the estimate, so the insurer is not reviewing a stale scope.

3. **Use Print for drafts** and Publish only when the record should lock and (for insurer jobs) leave your organisation.

4. **Read excluded-item counts** on the external result panel. Untagged lines never reach the insurer.

5. **Record internal approval promptly** with **Received Approval** so a work order exists and Dashboard “estimates ready to publish” / pending queues stay accurate.

6. **After insurer approval, read Take Off line decisions** before you invoice or start work — the header status alone may hide rejected lines.

7. **Never unlock by cloning into a new Quote type** when the commercial change is a variation; use the variation types so history stays clear.
