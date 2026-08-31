---
title: "Vendors"
slug: vendors-overview
description: "How to open vendor records from RFQs, proposals, purchase orders, and bills, and how vendor trade documents relate to estimates."
section: operations
area: vendors
routes:
  - /vendors
  - /vendors/[id]
audience: member
permissions_discussed:
  - vendors.read
  - vendors.manage
  - procurement.read
tags:
  - vendors
  - procurement
  - rfqs
  - proposals
  - purchase orders
  - bills
related_guides:
  - rfqs
  - proposals
  - purchase-orders
  - bills
  - company-settings
version: 1
last_updated: 2026-08-31
---

# Vendors

Vendors are the organisations you buy work and materials from. EnsureOS stores each vendor once and links them to RFQs, proposals, purchase orders, and bills so you can follow the same supplier across a job.

This page is the vendor directory. It is **not** in the sidebar. You usually open it from a vendor name on a procurement document.

## Key Concepts

- **Vendor** — a supplier organisation (for example a plumber, restoration contractor, or materials merchant).
- **Linked** — the vendor has an external reference, typically from a connected insurer or CRM system.
- **Unlinked** — the vendor exists only in EnsureOS and has no external reference yet.
- **Direction of trade** — whether you are asking a vendor for a price, ordering from them, or paying them. Do not confuse this with pricing the insurer.

## Direction of Trade

Use this table when deciding which document to open.

| You are… | Document | Where it lives |
|----------|----------|----------------|
| Asking a vendor for a price | RFQ | **Vendors** → Request for Quotations |
| Receiving a vendor’s price | Proposal | **Vendors** → Proposals |
| Ordering from a vendor | Purchase Order | **Vendors** → Purchase Orders |
| The vendor invoices you | Bill | **Vendors** → Bills (and **Finance** → Accounts Payable) |
| You price work to the insurer | Estimate | **Customers** → Estimates (`/quotes`) |

> **Note:** An **Estimate** is your outbound price to the insurer. A **Proposal** is a vendor’s inbound price to you. They are not the same record.

## Accessing Vendors

The vendor directory has no sidebar row.

1. Open an RFQ, proposal, purchase order, or bill.
2. Click the **vendor name** (or **Vendor (from)** / **Vendor (sub)** link) on the header or Overview tab.
3. EnsureOS opens `/vendors/[id]`.

To browse the full directory, go to `/vendors` directly (bookmark or paste the URL).

> **Required permission:** You need `vendors.read` (Read Vendors) to view the list and detail pages. `vendors.manage` is required to update vendor associations.

## Job Filter

The vendor directory is **organisation-wide**. The sidebar job picker does **not** append `?jobId=` to `/vendors`, and this list has no job column.

Related procurement lists (**Request for Quotations**, **Proposals**, **Purchase Orders**, **Bills**) *are* job-filterable. When a job is selected, those sidebar links become `/rfqs?jobId=…` (and so on) and their count badges show records for that job only.

> **Tip:** If an RFQ or bill list looks empty, a job is probably selected. Clear job context, or open the vendor from a document you already have.

## The Vendors List

The header shows **Vendors**, the total count, how many rows are showing, and a **Linked** stat (vendors with an external reference on the current page).

1. Use **Sort** tabs to order by **Name**, **Updated**, or **Created**.
2. Type in **Search vendors by name or reference…** to narrow the list.
3. Open **All vendors** to filter by link state: **Linked** or **Unlinked**.
4. Click a row to open the vendor detail page.

| Column | What it shows |
|--------|----------------|
| **Name** | Vendor organisation name (always visible) |
| **Reference** | External reference when the vendor is linked |
| **Created** | Date the vendor was created in EnsureOS |
| **Updated** | Last change date |

Use the column settings control on the right of the header row to hide **Reference**, **Created**, or **Updated**. Empty state: **No vendors found.**

> **Note:** There is no **Create Vendor** button on this page. Vendors appear when they are linked from procurement documents or synced from a connected system.

## Vendor Detail

The detail header shows the vendor name, the external reference (if linked), and **Back to vendors**.

1. Use **Print** in the header to print the vendor record.
2. Review the body card. Job-level vendor allocation is not available on this page yet.

> **Note:** The detail body currently shows that vendor allocation for jobs will be available in a later phase. Use the vendor link on each RFQ, proposal, PO, or bill to see how that supplier is used on a job today.

## Linking Vendors

A vendor is **Linked** when it has an external reference. Use the list **All vendors** filter to find unlinked records that may be duplicates of a linked supplier.

1. Open the vendor from a procurement document so you can see the name and ABN (or other registration number) on that document’s parties.
2. Search `/vendors` for the same name or reference before treating an unlinked row as a new supplier.
3. If two rows look like the same organisation, keep the linked record and use it on new RFQs and POs.

> **Warning:** Creating parallel vendor records for the same ABN splits history across RFQs, proposals, POs, and bills. Match the existing vendor whenever the name or reference is already in the directory.

## Best Practices

1. **Open the vendor from the document you are working.** That preserves job context on the RFQ, PO, or bill you came from.

2. **Treat linked vendors as the source of truth.** Prefer the row with an external reference when the same name appears twice.

3. **Match ABN and legal name**, not a trading nickname. “ABC Plumbing” and “ABC Plumbing Pty Ltd” are often the same vendor.

4. **Do not confuse proposals with estimates.** Vendor prices stay on **Proposals**; insurer prices stay on **Estimates**.

5. **Follow the trade chain.** RFQ → proposal → purchase order → bill. Jumping straight to a bill without a PO makes Accounts Payable harder to reconcile.

6. **Use job-scoped procurement lists** when you only care about one job. The vendor directory itself is not job-filtered.
