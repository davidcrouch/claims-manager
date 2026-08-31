---
title: "Bills"
slug: bills
description: "How to record vendor bills, approve or reject them, mark them paid, and how bills differ from customer invoices and Accounts Payable."
section: operations
area: vendors
routes:
  - /bills
  - /bills/[id]
audience: member
permissions_discussed:
  - procurement.read
  - procurement.manage
  - finance.read
  - vendors.read
tags:
  - bills
  - vendors
  - procurement
  - accounts payable
  - invoices
related_guides:
  - accounts-payable
  - purchase-orders
  - invoices-overview
  - vendors-overview
  - dashboard
version: 1
last_updated: 2026-08-31
---

# Bills

A bill is a **vendor invoice payable by you**. The vendor has charged your organisation for work or materials on a job. You receive the bill, approve or reject it, then mark it paid.

This is the opposite of an **Invoice** under **Customers**, which is what **you** bill the insurer or customer (accounts receivable).

## Key Concepts

- **Bill** — payable vendor invoice (bill number, amount, received date, due date).
- **Invoice** — receivable document you issue. Different sidebar group (`/invoices`).
- **Accounts Payable (AP)** — finance view of money you owe, including overdue bills. Dashboard **AP overdue** opens AP, not this list.
- **Payment status** — separate from workflow status (for example Received vs Paid).
- **Linked PO** — optional purchase order this bill is charging against.

## Bills vs Invoices vs Accounts Payable

| Record | Who is owed | Sidebar | Typical action |
|--------|-------------|---------|----------------|
| **Bill** | The vendor | **Vendors** → Bills | Approve, then **Mark Paid** |
| **Invoice** | Your organisation | **Customers** → Invoices | Submit / collect |
| **Accounts Payable** | Summary of payables | **Finance** → Accounts Payable | Ageing and overdue totals |

> **Note:** Creating a bill here updates operational records. AP is the finance ledger view of those payables. Use both: this page to process a vendor invoice; AP to see what is overdue across jobs.

## Accessing Bills

1. In the left sidebar, under **Vendors**, click **Bills**.
2. Click a row to open `/bills/[id]`.
3. Use **Back to bills** to return to the list.

> **Required permission:** You need `procurement.read` to view bills. **Create Bill**, **Approve**, **Reject**, and **Mark Paid** require `procurement.manage`. Dashboard **AP overdue** also needs `finance.read`.

## Job Filter

When a job is selected in the sidebar job picker, the Bills link becomes `/bills?jobId=…`. The count badge is for that job only.

> **Tip:** If the list looks empty, check whether a job is selected. Clear job context to see the organisation-wide list again.

## The Bills List

The header title is **Bills**. It shows total count, status breakdown, and a value total for the current page when amounts are present.

1. Choose **Active**, **Archived**, or **All**.
2. Search by bill number, reference, or vendor.
3. Filter by vendor from **All vendors**, or by **Job** / **Status** / **Vendor** on column headers.
4. Archive a row from the row action.

| Column | What it shows |
|--------|----------------|
| **Bill #** | Bill number or external reference |
| **Job** | Linked job |
| **Status** | Workflow status badge |
| **Vendor** | Vendor name from the bill payload |
| **PO #** | Linked purchase order |
| **Amount** | Bill total |
| **Received** | Date received |
| **Due Date** | Payment due date |
| **Updated** | Last change date |

Empty state: **No bills found.** (If you expected rows, clear the job filter or switch to **All**.)

## Creating a Bill

1. Click **Create Bill** in the page header.
2. If no job is selected, choose the **job**.
3. Select the customer **Invoice** this vendor charge relates to (when your process codes cost against an invoice).
4. Optionally enter **Bill #**, **Total Amount**, **Issue Date**, **Received Date**, and comments.
5. Click **Create Bill**.

> **Note:** The create drawer is titled **Create Bill** and describes recording a vendor bill against an invoice. You can still open an existing bill that was linked from a purchase order via **View PO** on detail.

## Bill Detail

The header shows bill number, status, vendor chip, **View PO** when a purchase order is linked, and the job link. Header fields: **Amount**, **Received**, **Due**.

Workflow buttons depend on status:

| Current status | Header actions |
|----------------|----------------|
| **Received** | **Approve** or **Reject** |
| **Approved** | **Mark Paid** |
| Other | Print and archive only |

1. Open a bill in **Received**.
2. Review Overview amounts and the **Line Items** tab.
3. Click **Approve** if the charge matches the PO and the work, or **Reject** if it does not.
4. After approval, click **Mark Paid** when payment has been made.

| Tab | What you do here |
|-----|------------------|
| **Overview** | Status, payment status, vendor, job, PO, amounts, issue / received / due / payment dates |
| **Line Items** | Billed lines |
| **Activities** | Placeholder until connected |
| **Communications** | Placeholder until connected |
| **Timeline** | Created and updated audit |
| **Attachments** | Placeholder until the attachments API is connected |

Print and archive are in the header toolbar. The vendor chip opens `/vendors/[id]`.

> **Warning:** **Mark Paid** records that your organisation has paid the vendor. Do not use it as a substitute for approving. Approve first so rejected bills never show as paid.

## How Bills Connect to Accounts Payable

Overdue approved (or received) bills roll into **Finance** → **Accounts Payable** and the Dashboard **AP overdue** tile. Processing on this page is what keeps AP accurate. If AP looks wrong, start with the bill’s due date and **Mark Paid** state.

## Best Practices

1. **Match every bill to a purchase order** when a PO exists. Use **View PO** to compare ordered vs billed amounts.

2. **Do not confuse bills with invoices.** Invoices are money owed *to* you; bills are money you owe.

3. **Approve against scope**, not just the total. Check **Line Items** before **Approve**.

4. **Set a due date** so AP ageing and the Dashboard tile are meaningful.

5. **Reject promptly** when the vendor billed the wrong job or included unapproved variations.

6. **Use job context** when entering bills for a single site so the sidebar count stays correct.

7. **Reconcile AP weekly** against this list’s **Due Date** column so overdue vendor invoices are not missed.
