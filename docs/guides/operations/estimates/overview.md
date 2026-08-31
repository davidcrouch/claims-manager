---
title: "Estimates"
slug: estimates-overview
description: "How to find, open, and read estimates — priced scope for a job, including take-off, parties, and status."
section: operations
area: estimates
routes:
  - /quotes
  - /quotes/[id]
audience: member
permissions_discussed:
  - procurement.read
  - procurement.manage
  - catalogs.read
tags:
  - estimates
  - quotes
  - take-off
  - procurement
  - onboarding
related_guides:
  - creating-an-estimate
  - publishing-an-estimate
  - creating-a-variation
  - catalogues
  - jobs-overview
  - work-orders-overview
  - proposals
version: 1
last_updated: 2026-08-31
---

# Estimates

An **estimate** is the priced scope of work for a job. You build it from catalogue items and free-typed lines, then publish it so the insurer (or your organisation) can review and approve it. After approval, the estimate typically becomes the basis for a work order and later an invoice.

The sidebar label is **Estimates**. The page URL is `/quotes` (and `/quotes/[id]` for a single record). That path is a leftover from the underlying quote record — use **Estimates** in conversation and in the menu.

This guide explains how the list and detail pages work, how an estimate differs from invoices and vendor documents, and what each tab is for.

## Key Concepts

- **Estimate** — a quote you send *out* (or hold internally) for the cost of work on a job. Built on the **Take Off** tab.
- **Invoice** — a bill *you* send to the insurer or customer for work already authorised. See [Invoices](../invoices/overview.md).
- **Work order** — an instruction to a crew or vendor to perform scoped work, often created after an estimate is approved. See [Work Orders](../work-orders/overview.md).
- **RFQ / proposal** — vendor procurement: you *request* prices (RFQ) and *receive* a vendor offer (proposal). Direction of trade is the opposite of an estimate.
- **Estimate type** — a lookup on the record (for example Quote, Variation, Scope Of Work). Types appear as badges and as list filters.
- **Take-off** — the working bill of quantities: groups (sections), line items, and optional assemblies/scopes expanded from the catalogue.
- **Locked** — after publish, take-off and most header fields cannot be edited. Change scope with a [variation](creating-a-variation.md), not by unlocking the original.

## Accessing Estimates

1. In the left sidebar, under **Customers**, click **Estimates**.
2. The list opens at `/quotes`. If a job is selected in the header job picker, the list is scoped with `?jobId=`.
3. Click a row to open that estimate.

From a job, use the job-scoped Estimates list (same sidebar item while that job is selected), then click a row or **Create Estimate**.

> **Required permission:** You need `procurement.read` to view the list and detail pages. Creating and editing requires `procurement.manage`. Opening the catalogue picker also needs `catalogs.read`.

## The Estimates List

The page header is titled **Estimates**. It shows how many records match the current filters, a status breakdown, and a **Total value** of the visible rows (Australian dollars).

Header actions:

- **Create Estimate** — opens the create drawer. See [Creating an Estimate](creating-an-estimate.md).
- **Print** (printer icon) — prints or downloads the current list.

### Tabs, search, and filters

1. Use **Active**, **Archived**, or **All** to hide or include archived estimates.
2. Type in **Search estimates by estimate #, insurer ref or name...** to narrow the table.
3. Use **Filter by estimate type** (and column filters on **Status**, **Job**, **Assignee**, and **Type**) to focus the list.

| Column filter | What it does |
|---------------|----------------|
| **Status** | Draft, Pending, Approved, and other status names from your organisation lookups |
| **Job** | Limits rows to one or more jobs |
| **Assignee** | Limits rows to the person assigned on the estimate |
| **Estimate type** | Quote, Variation, Variation - PC/PS, and other types |

Click a column header to sort. Pagination is 20 rows per page.

> **Tip:** If the list looks empty, check whether a job is selected in the header, or switch from **Active** to **All**.

## Opening an Estimate

Click a row. The detail header shows:

- Internal / display name, status badge, and a **Locked** pill when the estimate is no longer a draft
- Estimate type badge (hidden when the type is simply Estimate or Quote)
- Links to the related **job** and, when present, **View Claim**
- **Total**, **Estimate date**, and **Updated**

### Header actions

| Control | When it appears | What it does |
|---------|-----------------|--------------|
| **Catalogue** | Take Off tab, unlocked | Opens the catalogue picker |
| **Received Approval** | Status is **Pending** and the job is not a Crunchwork (insurer) job | Opens the approval wizard |
| **Create Work Order** | Estimate is locked | Opens the work-order create drawer |
| **Undo** | Unsaved or recently saved edits | Reverts overview, parties, assignee, or take-off |
| **Publish** | Estimate is still a draft (not locked) | Opens the publish wizard |
| **Print** | Always | Print estimate or scope of work |
| **Archive** | Always (unless already archived) | Archives the estimate |

Assignment can be changed even after publish. Take-off and overview fields cannot.

> **Note:** Overview, parties, and take-off **autosave** after a short pause. A save indicator appears in the header. Use **Undo** if you change something by mistake.

## Detail Tabs

Live tabs on the estimate (not Communications or Attachments):

| Tab | Purpose |
|-----|---------|
| **Overview** | Identifiers, financials, schedule, approval, and notes |
| **Take Off** | Groups and line items — the priced scope |
| **Parties** | Estimate From (vendor), Estimate For (customer), Estimate To (recipient) |
| **Activities** | Activity feed for this estimate |
| **Journals** | Photo journals linked to this estimate |
| **Timeline** | Local created/updated audit |

### Overview

Cards include **Identifiers** (estimate number, insurer ref, name, reference, status type), **Financials** (estimate date, subtotal, tax, total, expires in days), **Schedule** (estimated start/completion and **Reason for variation**), **Approval** (auto-approved, status name, estimate type), and an optional **Note**.

When the estimate has been sent to an insurer, an **Insurer Review** card appears: awaiting review, approved, or another status, with a reminder to check Take Off for per-line decisions.

### Take Off

This is the working estimate. Add **groups** (sections), then add catalogue items or free-typed lines. Assemblies and scopes from the catalogue expand into their component lines. Totals on the header update from this tab.

After publish, Take Off is read-only. A banner states the estimate can no longer be edited except for **Assigned**.

### Parties, Activities, Journals, Timeline

Use **Parties** to record who the estimate is from, for, and to (name, contact, address). **Activities** lists insurer and system actions. **Journals** links site photos. **Timeline** is the local audit of who created and last updated the record.

## Catalogue Lines vs Free-Typed Lines

| Source | Typical use |
|--------|-------------|
| **Catalogue picker** | Standard rates, assemblies, and scopes that match your organisation’s price book |
| **Free-typed line** | One-off items that are not in the catalogue |

Catalogue items can later be scanned for **price drift** (the catalogue rate moved after you added the line). See [Creating an Estimate](creating-an-estimate.md).

## Estimate vs Other Documents

| Document | Who it is for | When you use it |
|----------|---------------|-----------------|
| **Estimate** | Insurer / customer (your priced offer) | Before work is authorised |
| **Work order** | Crew or vendor (instruction to proceed) | After approval, to start work |
| **Invoice** | Insurer / customer (you are owed money) | After a milestone or completion |
| **RFQ** | Vendors (you are asking for prices) | When you need market quotes in |
| **Proposal** | You (vendor’s offer back) | When a vendor responds to an RFQ |
| **Bill** | You (you owe a vendor) | Accounts payable — not an invoice |

## Best Practices

1. **Link every estimate to the correct job** before you spend time on take-off. Job context drives parties, catalogues, and later work orders.

2. **Keep the original approved estimate locked.** Scope or cost changes after approval belong on a variation, not on silent edits.

3. **Use catalogue items where a rate exists.** Free-typed lines are harder to reconcile and cannot write back to the catalogue.

4. **Fill parties before publish.** Insurer and internal review both rely on From / For / To being complete.

5. **Check Insurer Review and Take Off after submit.** Per-line decisions appear on Take Off, not only in the status badge.

6. **Assign an owner** so the list assignee filter and Dashboard queues stay useful.

7. **Use Print for a PDF snapshot**; do not treat a downloaded file as a substitute for publishing when the insurer must receive the estimate.
