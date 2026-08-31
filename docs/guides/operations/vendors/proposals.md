---
title: "Proposals"
slug: proposals
description: "How to receive vendor proposals, review line items, and accept, decline, or request a revision — and how proposals differ from estimates."
section: operations
area: vendors
routes:
  - /proposals
  - /proposals/[id]
audience: member
permissions_discussed:
  - procurement.read
  - procurement.manage
  - vendors.read
tags:
  - proposals
  - vendors
  - procurement
  - rfqs
  - estimates
related_guides:
  - rfqs
  - estimates-overview
  - purchase-orders
  - dashboard
  - vendors-overview
version: 1
last_updated: 2026-08-31
---

# Proposals

A proposal is a **vendor’s price to you**. You receive it against an RFQ, review the lines and total, then accept, decline, or ask for a revision.

This is the opposite direction of an **Estimate**, which is **your** price to the insurer on **Customers** → **Estimates** (`/quotes`).

## Key Concepts

- **Proposal** — inbound vendor quote (number, vendor, total, received date).
- **Estimate** — outbound price you prepare for the insurer. Different sidebar group, different route.
- **External vendor** — a proposal from a vendor who is not a subscribed EnsureOS organisation (amber **External vendor** chip).
- **Capture External Estimate** — records a non-EnsureOS vendor quote against the current job or claim (not the same as **Receive Proposal**).
- **Review actions** — **Accept**, **Decline**, and **Request Revision** appear when status is **Received** or **Under Review**.

## Proposals vs Estimates

| | Proposal | Estimate |
|--|----------|----------|
| Direction | Vendor prices **you** | You price the **insurer** |
| Sidebar | **Vendors** → Proposals | **Customers** → Estimates |
| Route | `/proposals` | `/quotes` |
| Typical next step | Purchase order to the vendor | Work order / invoice to the customer |

> **Note:** Dashboard **Needs a decision** includes both “proposals to review” and “estimates ready to publish”. Open the chip that matches the direction of trade.

## Accessing Proposals

1. In the left sidebar, under **Vendors**, click **Proposals**.
2. Click a row to open `/proposals/[id]`.
3. Use **Back to proposals** to return to the list.

> **Required permission:** You need `procurement.read` to view proposals. **Receive Proposal**, **Capture External Estimate**, and accept/decline actions require `procurement.manage`.

## Job Filter

When a job is selected in the sidebar job picker, the Proposals link becomes `/proposals?jobId=…`. The count badge is for that job only.

The header also shows the selected job and parent claim when you arrived with `?jobId=`.

> **Tip:** If the list looks empty, check whether a job is selected. Clear job context to see the organisation-wide list again.

## The Proposals List

The header title is **Proposals**. It shows total count, status breakdown, and **Total value** (sum of amounts on the current page, in AUD) when greater than zero.

1. Choose **Active**, **Archived**, or **All**.
2. Search by number, name, or vendor.
3. Filter by vendor from **All vendors**, or by **Job** / **Status** / **Vendor** on column headers.
4. Archive a row from the row action without opening the detail page.

| Column | What it shows |
|--------|----------------|
| **Proposal #** | Proposal number, reference, or name |
| **Job** | Linked job |
| **Status** | Current status badge |
| **Vendor** | **Proposal from** name |
| **RFQ #** | Short RFQ identifier when linked |
| **Total** | Proposal total |
| **Received** | Received or proposal date |
| **Updated** | Last change date |

Empty state: **No proposals found.**

## Receiving a Proposal

1. Click **Receive Proposal** in the page header.
2. If no job is selected, choose the **job**.
3. Search **Received From** (required). Use **Create Contact** if the vendor contact is missing.
4. Select the **Request for Proposal** that was sent to that contact’s email (required). Matching RFQs are looked up by email and job.
5. Optionally enter **Proposal #**, **Name**, **Total Amount**, **Received Date**, and a **Note**.
6. Click **Receive Proposal**.

> **Warning:** If the contact has no email, EnsureOS cannot match RFQs. Add an email on the contact, then receive the proposal again.

> **Note:** If no RFQs were sent to that email for the selected job, send the RFQ first from the RFQ **Requests** tab.

## Capturing an External Estimate

**Capture External Estimate** is on the list toolbar. It is enabled only when a job (or parent claim) is in context.

1. Select a job in the sidebar (or open Proposals from a job).
2. Click **Capture External Estimate**.
3. Enter the issuer name, ABN, contact details, quote number, dates, and total.
4. Submit to store the external quote against the job.

Use this when a vendor emailed a PDF outside EnsureOS and you need the figure on the job. Prefer **Receive Proposal** when the RFQ was sent from EnsureOS.

## Proposal Detail

The header shows proposal number, status, optional **External vendor** chip, vendor name, **View RFQ**, and the job link. Header fields: **Total**, **Received**, **Updated**.

When status is **Received** or **Under Review**:

1. Click **Accept** to accept the vendor’s price.
2. Click **Decline** to reject it.
3. Click **Request Revision** if the vendor should reprice.

| Tab | What you do here |
|-----|------------------|
| **Overview** | Status tiles, vendor (links to `/vendors/[id]`), RFQ, job, source estimate, parties, financials, note |
| **Line Items** | Read-only priced lines from the proposal |
| **Activities** | Placeholder until tasks are connected |
| **Communications** | Placeholder until messages are connected |
| **Timeline** | Created and updated audit |

Print and archive are in the header toolbar.

## How Proposals Connect to Purchase Orders

After you **Accept** a proposal, raise a **Purchase Order** under **Vendors** → **Purchase Orders** for the same job and vendor. The PO is the order; the proposal is only the offered price.

## Best Practices

1. **Review line items before accepting.** The Overview total can hide a scope the vendor omitted or inflated.

2. **Keep proposals and estimates separate.** Do not treat an accepted proposal as published insurer pricing.

3. **Receive against the original RFQ** so the RFQ **Proposals** tab stays complete.

4. **Use Capture External Estimate only for off-platform quotes**, and only with a job selected.

5. **Decide promptly.** Dashboard **proposals to review** exists so accepted work is not delayed.

6. **One accepted proposal per trade package** before you create the PO, so Accounts Payable can match bill to order.
