---
title: "Request for Quotations"
slug: rfqs
description: "How to create RFQs from an estimate, send them to vendors, and track responses on the RFQ detail page."
section: operations
area: vendors
routes:
  - /rfqs
  - /rfqs/[id]
audience: member
permissions_discussed:
  - procurement.read
  - procurement.manage
  - vendors.read
tags:
  - rfqs
  - vendors
  - procurement
  - estimates
  - proposals
related_guides:
  - vendors-overview
  - proposals
  - jobs-overview
  - dashboard
  - estimates-overview
version: 1
last_updated: 2026-08-31
---

# Request for Quotations

An RFQ is how you **ask a vendor for a price**. You typically start from a job estimate, choose the scope items the vendor should price, then send the request from the RFQ **Requests** tab.

This page lists RFQs for your organisation (or for the selected job) and opens each RFQ’s detail tabs.

## Key Concepts

- **RFQ** — a request for quotation sent to one or more vendors.
- **Scope items** — line items copied from a source estimate; these are what the vendor is asked to price.
- **Send request** — a batch of emails (and a generated PDF) recorded on the **Requests** tab.
- **Proposal** — the vendor’s response. Incoming proposals appear on the RFQ **Proposals** tab and on **Vendors** → **Proposals**.
- **Include pricing / quantities** — flags on the RFQ that control whether scope items show prices and quantities to the vendor.

## Accessing RFQs

1. In the left sidebar, under **Vendors**, click **Request for Quotations**.
2. Click a row to open `/rfqs/[id]`.
3. Use **Back to RFQs** on the detail header to return to the list.

> **Required permission:** You need `procurement.read` (Read Procurement) to view RFQs. **Create RFQ** and **Send Request** require `procurement.manage`.

The Dashboard **Needs a decision** rail includes RFQs waiting on vendors. Those chips open this list.

## Job Filter

When a job is selected in the sidebar job picker, the RFQs link becomes `/rfqs?jobId=…`. The count badge on **Request for Quotations** is for that job only.

You can also filter by job from the **Job** column header without using the sidebar picker.

> **Tip:** If the list looks empty, check whether a job is selected. Clear job context to see the organisation-wide list again.

## The RFQs List

The header title is **RFQs**. It shows total count, how many rows are showing, and a status breakdown for the current page.

1. Choose **Active**, **Archived**, or **All**.
2. Search by number, name, or vendor.
3. Open **All vendors** to include or exclude vendors.
4. Click a column header to sort. Filter **Job**, **Status**, or **Vendor** from the column menus.
5. Use the archive action on a row (without opening the row) to archive an RFQ.

| Column | What it shows |
|--------|----------------|
| **RFQ #** | Internal number, RFQ number, or name |
| **Job** | Linked job (opens the job) |
| **Status** | Current RFQ status badge |
| **Vendor** | Vendor the RFQ is addressed to |
| **Sent** | Date the RFQ was sent |
| **Due** | Response due date |
| **Updated** | Last change date |

Empty state: **No RFQs found.**

## Creating an RFQ

1. Click **Create RFQ** in the page header.
2. If no job is selected, choose the **job** first.
3. Optionally enter a **Name** and **Description**.
4. Under **Select Estimate**, choose the estimate this RFQ is based on. You cannot continue until an estimate is selected.
5. Click **Next: Select Scope**.
6. Tick the line items (or whole groups) the vendor should price.
7. Click **Create RFQ**. EnsureOS opens the new RFQ.

> **Warning:** If the job has no estimates, the drawer shows **No estimates found for this job. Create an estimate first.** Create the estimate under **Customers** → **Estimates** before raising the RFQ.

> **Note:** Scope selection requires at least one line item. An estimate with no lines cannot produce an RFQ.

## RFQ Detail

The header shows the RFQ number or name, status, vendor chip, a link to the job, and **View Source Estimate** when a quote is linked. Header fields: **Sent**, **Due**, **Updated**.

| Tab | What you do here |
|-----|------------------|
| **Overview** | RFQ number, name, status, vendor, job, source estimate, sent/due dates, include pricing and quantities, parties |
| **Scope Items** | Edit which estimate lines are on the RFQ. Changes autosave; a save status appears in the header |
| **Requests** | Send the RFQ and review send batches |
| **Proposals** | Proposals received against this RFQ |
| **Activities** | Tasks and appointments (placeholder until connected) |
| **Communications** | Messages for this RFQ (placeholder until connected) |
| **Timeline** | Created and updated audit |

Print and archive are in the header toolbar.

## Sending a Request

1. Open the RFQ and click **Requests**.
2. Click **Send Request** in the header (this button only appears on the Requests tab).
3. **Recipients** — pick job contacts (or create a contact) who should receive the RFQ.
4. **Preview PDF** — wait for the RFQ PDF to generate, then review it.
5. **Send Email** — confirm the message and send.

Each batch shows a status: **Sending…**, **Sent**, **Partial**, or **Failed**. Click a batch to see recipient-level results.

> **Warning:** If PDF generation fails with a template error, fix the RFQ Word template under Admin → **Document Templates** (loop tags such as `{#scopes}` must stay inside the same table), then retry.

> **Tip:** Send from a job-scoped RFQ so recipients and the PDF pick up the correct site and estimate.

## How RFQs Connect to Proposals

After vendors respond, proposals appear on the RFQ **Proposals** tab and on **Vendors** → **Proposals**. Open a proposal to **Accept**, **Decline**, or **Request Revision**. Accepted pricing is what you later order on a purchase order.

Dashboard queues for “RFQs awaiting” and “proposals to review” point at these two lists.

## Best Practices

1. **Start from the published estimate** you intend the vendor to price. Do not send an RFQ from a draft that will change.

2. **Select only the scope the vendor owns.** Mixing trades on one RFQ makes proposals hard to compare.

3. **Set a due date** before sending so the list **Due** column is meaningful.

4. **Send from the Requests tab**, not by emailing a PDF from your inbox. Send batches stay on the RFQ.

5. **One RFQ per vendor conversation** when you need a clean audit trail; use additional send batches if you need to chase the same vendor.

6. **Check job context** before creating. An RFQ created on the wrong job will not appear in that job’s sidebar count.
