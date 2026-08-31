---
title: "Invoices"
slug: invoices-overview
description: "How to find and read customer invoices — money owed to you — and how they differ from vendor bills and the AR ledger."
section: operations
area: invoices
routes:
  - /invoices
  - /invoices/[id]
audience: member
permissions_discussed:
  - invoices.read
  - invoices.create
  - invoices.update
  - invoices.approve
tags:
  - invoices
  - accounts receivable
  - work orders
  - publish
related_guides:
  - creating-an-invoice
  - accounts-receivable
  - bills
  - jobs-overview
  - work-orders-overview
  - dashboard
version: 1
last_updated: 2026-08-31
---

# Invoices

An **invoice** is the document you send to the insurer or customer for authorised work — money **owed to your organisation**. It is not a vendor **bill** (money you owe). Operational invoices live under **Customers → Invoices**; ageing and overdue totals live under **Finance → Accounts Receivable**.

This guide covers the invoices list, detail tabs, header actions including **Publish**, and how invoices relate to work orders, purchase orders, and bills.

## Key Concepts

- **Invoice** — your receivable document, usually created against a **work order** (and its purchase order when one exists).
- **Bill** — a payable from a vendor. Bills are under **Vendors → Bills** and **Accounts Payable**, not this page.
- **Accounts Receivable (AR)** — the finance ledger view of invoices (outstanding, overdue, ageing). Same invoices; different page.
- **Draft vs published** — a new invoice is a draft until you publish. After publish it is locked and, on insurer jobs, sent upstream.
- **Work order / PO link** — the invoice header links to the work order or purchase order it was raised against.

## Accessing Invoices

1. In the left sidebar, under **Customers**, click **Invoices**.
2. The list opens at `/invoices`. A selected job scopes the list with `?jobId=`.
3. Click a row to open `/invoices/[id]`.

From a work order, click **Create Invoice** to open the same create drawer with that work order selected.

> **Required permission:** `invoices.read` to view the list and detail. `invoices.create` to use **Create Invoice**. Publishing uses `invoices.update` (and insurer submit as part of publish). `invoices.approve` is reserved for approve/reject workflows where your organisation enables them — the live invoice header today centres on **Publish**, print, and archive.

## The Invoices List

The header title is **Invoices**, with a status breakdown and **Total value** of visible rows.

Header actions:

- **Create Invoice** — opens the create drawer. See [Creating an Invoice](creating-an-invoice.md).
- **Print** — prints or downloads the current list.

On the filter row:

- **Active** / **Archived** / **All**
- Search by **invoice # or insurer ref**
- **Filter by status**

| Column | Contents |
|--------|----------|
| **Invoice #** | Internal / invoice number, plus a compact sync indicator when the record syncs upstream |
| **Insurer Ref** | Insurer reference |
| **Job** | Linked job (filterable) |
| **Status** | Current status (filterable) |
| **Total** | Invoice total |
| **Issue Date** / **Created** / **Updated** | Dates |

Click a row to open detail. Archive from the row without opening the record.

> **Tip:** Dashboard **AR overdue** opens [Accounts Receivable](../finance/accounts-receivable.md), not this list. Use Invoices when you are creating or publishing documents; use AR when you are chasing ageing.

## Opening an Invoice

The detail header shows status, optional sync status, and links:

- **View PO** when a purchase order is linked
- **View work order** when a work order is linked (and no PO link is shown in that slot)
- Job name link

Header fields: **Amount**, **Issue date**, **Updated**.

### Header actions

| Control | When | What it does |
|---------|------|----------------|
| **Publish** | Invoice has no `sourceExternalReference` (typically still a local draft) | Opens the publish wizard |
| **Print** | Always | Generate a PDF of this invoice |
| **Archive** | Always | Archive the invoice |

Once an invoice has been submitted upstream, **Publish** is hidden — the record is treated as already issued.

## Detail Tabs

Live tabs (this page is thinner than estimates):

| Tab | Purpose |
|-----|---------|
| **Overview** | Invoice number, insurer ref, status, totals, tax, excess, issue date |
| **Line Items** | Read-only lines from the linked PO, work order, or invoice payload |
| **Timeline** | Local created / updated audit |

There are no Parties, Take Off, or Communications tabs on the invoice.

### Overview amounts

| Field | Meaning |
|-------|---------|
| **Total amount** | Inclusive total |
| **Sub-total** | Amount before tax |
| **Tax** | Tax component |
| **Excess amount** | Excess (policy excess) when present |
| **Issue date** | Date on the invoice |

### Line items

EnsureOS prefers lines from the **linked purchase order**, then the **linked work order**, then groups or a simple item table on the invoice payload. You do not edit invoice lines on this tab — change the source WO/PO or create a new invoice if the commercial document must change after lock.

## Invoice vs Bill vs AR

| Page | What you are looking at | Money direction |
|------|-------------------------|-----------------|
| **Invoices** (`/invoices`) | Operational customer invoices | Owed **to you** |
| **Accounts Receivable** (`/finance/ar`) | Ageing ledger of those invoices | Same invoices, finance view |
| **Bills** (`/bills`) | Vendor bills | You **owe** |
| **Accounts Payable** (`/finance/ap`) | Ageing ledger of bills | Same bills, finance view |

Do not raise a customer invoice on the Bills page, and do not treat a vendor bill as an invoice.

## Dashboard and Overdue

The Dashboard snapshot tile **AR overdue** shows the overdue invoice total and count, and links to Accounts Receivable. Overdue invoices also appear in the Dashboard money empty-state when nothing is outstanding.

Use that tile as an alert; work the invoice (or AR row) to see issue date, age in days, and status.

## Best Practices

1. **Create invoices from the work order** so PO and line items stay attached.

2. **Do not invoice before the agreed milestone** (report submitted, works complete, or as your contract states).

3. **Match the authorised PO / work order amount.** If a variation changed the PO, invoice the updated value.

4. **Publish once, from the invoice page.** Saving a draft does not notify the insurer.

5. **Use Invoices for documents and AR for collections.** Chasing ageing on the operational list misses bucket totals.

6. **Print a PDF for your file** after publish if you need a local copy; print alone does not submit the invoice.

7. **Never confuse a bill with an invoice** — paying a vendor is Accounts Payable; billing the insurer is this page.
