---
title: "Purchase Orders"
slug: purchase-orders
description: "How to create and review purchase orders issued to vendors, including statuses, line items, and how POs connect to bills."
section: operations
area: vendors
routes:
  - /purchase-orders
  - /purchase-orders/[id]
audience: member
permissions_discussed:
  - procurement.read
  - procurement.manage
  - vendors.read
tags:
  - purchase orders
  - vendors
  - procurement
  - bills
  - estimates
related_guides:
  - bills
  - work-orders-overview
  - creating-a-variation
  - builder-assessment-workflow
  - proposals
  - vendors-overview
version: 1
last_updated: 2026-08-31
---

# Purchase Orders

A purchase order is how you **order from a vendor**. It records what you committed to buy (or what an insurer instructed you to deliver) against a job, with a total, dates, and line items.

Some POs are issued by your organisation to a trade. Others arrive from an insurer for assessment or works fees — those still appear on this list because they are vendor-side orders, not customer invoices.

## Key Concepts

- **Purchase order (PO)** — a committed order to a vendor, with PO number, status, type, vendor, and total.
- **Estimate link** — optional source estimate (`/quotes`) used when creating the PO.
- **Service window** — start and end dates (and times) on the header.
- **Allocation** — vendor allocation context (job type, report type, quote revision) used on insurer-originated POs.
- **Bill** — the vendor’s invoice against this PO. Payable under **Bills** and **Accounts Payable**.

## Accessing Purchase Orders

1. In the left sidebar, under **Vendors**, click **Purchase Orders**.
2. Click a row to open `/purchase-orders/[id]`.
3. Use **Back to purchase orders** to return to the list.

> **Required permission:** You need `procurement.read` to view purchase orders. **Create PO** requires `procurement.manage`.

## Job Filter

When a job is selected in the sidebar job picker, the Purchase Orders link becomes `/purchase-orders?jobId=…`. The count badge is for that job only.

> **Tip:** If the list looks empty, check whether a job is selected. Clear job context to see the organisation-wide list again.

## The Purchase Orders List

The header title is **Purchase Orders**. It shows total count, status breakdown, and **Total value** for the current page when amounts sum to more than zero.

1. Choose **Active**, **Archived**, or **All**.
2. Search by PO #, external id, or vendor.
3. Filter by vendor from **All vendors**, or by **Job** / **Status** / **Vendor** on column headers.
4. Archive a row from the row action.

| Column | What it shows |
|--------|----------------|
| **PO #** | Internal number, PO number, or external id |
| **Job** | Linked job |
| **Status** | Current status badge |
| **Vendor** | Vendor organisation name |
| **Total** | Order total (AUD) |
| **Updated** | Last change date |

Empty state: **No purchase orders found.**

## Creating a Purchase Order

1. Click **Create PO** in the page header.
2. If no job is selected, choose the **job**.
3. Optionally select an **Estimate** to associate.
4. Enter **PO #**, **Name**, and **Total Amount** as needed.
5. Add a **Note** if the vendor needs extra instruction.
6. Click create. EnsureOS opens the new PO.

> **Note:** Linking an estimate helps later variations append lines to the same commercial package. See creating a variation when scope changes after the PO is issued.

## Purchase Order Detail

The header shows the PO name or number, status, PO type, vendor chip, job link, and **View claim** when a claim is linked. Header fields: **Total**, **Start**, **End**.

| Tab | What you do here |
|-----|------------------|
| **Overview** | PO number, external id, name, status, type, vendor, job, estimate, service window, totals and adjusted totals |
| **Parties** | PO to / for / from names, emails, phones, and addresses |
| **Line Items** | Ordered lines (paged) |
| **Allocation** | Vendor allocation job type, report type, quote revision, expiry |
| **Bills** | Bills raised against this PO (placeholder until connected) |
| **Activities** | Related tasks (placeholder) |
| **Communications** | Related messages (placeholder) |
| **Timeline** | Local and source-system audit dates |
| **Attachments** | Files on the PO (placeholder) |
| **Audit** | Created / updated users and timestamps |

Print and archive are in the header toolbar. There is no separate “receive” or “acknowledge” button on this page today — status is shown as a badge from the record.

> **Note:** Click the vendor chip or Overview **Vendor** field to open the vendor directory (`/vendors/[id]`). Vendors are not listed in the sidebar.

## How Purchase Orders Connect to Bills

When the vendor invoices you, record a **Bill** under **Vendors** → **Bills**. On bill detail, **View PO** opens this purchase order. Accounts Payable uses bills (not POs) for overdue amounts on the Dashboard.

Insurer-issued POs for builder assessment or works fees still belong here. They are not **Work Orders** (customer/insurer work instructions) and not **Invoices** (what you bill the customer).

## Variations and Extra Lines

If approved scope grows after the PO exists, create a **variation** on the estimate. Variations may append lines to the related PO. Do not raise a second unrelated PO for the same variation unless your organisation’s process requires it.

## Best Practices

1. **Create the PO after you accept a proposal** (or receive a clear insurer instruction) so the ordered amount matches an agreed price.

2. **Keep one PO per vendor package on a job** where possible. Split only when trades or payment terms differ.

3. **Fill start and end dates** so the Schedule and job timeline show when vendor work is expected.

4. **Link the source estimate** when the PO is priced from your catalogue work — variations then have a document to attach to.

5. **Do not use a PO as a customer invoice.** Customer billing is **Invoices** under Customers; vendor billing is **Bills**.

6. **Check job context** before **Create PO**. A PO on the wrong job will not appear in that job’s sidebar count.

7. **Match bills back to the PO** so Accounts Payable can see what was ordered versus what was invoiced.
