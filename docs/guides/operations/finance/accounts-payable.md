---
title: "Accounts Payable"
slug: accounts-payable
description: "How to use the Accounts Payable ledger — outstanding and overdue vendor bills, ageing buckets, and drill-through to bill detail."
section: operations
area: finance
routes:
  - /finance/ap
audience: manager
permissions_discussed:
  - finance.read
  - finance.manage
  - procurement.read
tags:
  - finance
  - accounts payable
  - bills
  - ageing
  - dashboard
related_guides:
  - bills
  - purchase-orders
  - accounts-receivable
  - dashboard
  - invoices-overview
version: 1
last_updated: 2026-08-31
---

# Accounts Payable

**Accounts Payable (AP)** is the finance view of **vendor bills** — money **you owe**. It is not the place to create bills or invoices. Use it to see payable and overdue totals, ageing buckets, and to open a bill.

Customer invoices (money owed *to* you) are **Invoices** and **Accounts Receivable**. Vendor documents are **Vendors → Bills** and this ledger.

## Key Concepts

- **Bill** — a vendor payable, usually tied to a purchase order. Drill-through from this page goes to `/bills/[id]`.
- **Payable / outstanding** — bill value still unpaid.
- **Overdue** — outstanding bills past due (highlighted on the summary).
- **Paid** — settled bill value in the summary.
- **Ageing bucket** — outstanding amount grouped by age, with a **bill(s)** count on each card.
- **Age (days)** — days since the bill **issue date** on each row (received and due dates are separate columns).

## Accessing Accounts Payable

1. In the left sidebar, under **Finance**, click **Accounts Payable**.
2. The page opens at `/finance/ap` (there is no separate AP detail route).
3. Click a bill number or **View** to open `/bills/[id]`.

You can also click the Dashboard snapshot tile **AP overdue**, which links here.

> **Required permission:** `finance.read` to view this page. `finance.manage` is for updating finance records where edit controls exist. Opening a bill requires `procurement.read`.

## What the Page Shows

### Summary cards

| Card | Meaning |
|------|---------|
| **Total Payable** | Sum you still owe |
| **Total Overdue** | Overdue portion (highlighted) |
| **Total Paid** | Settled bill value in the summary |

The page header repeats **Payable** and **Overdue** as compact stats.

### Ageing buckets

When buckets are present, each card shows a **label**, **total amount**, and **bill(s)** count. Use these to see which payables are current versus ageing.

### Bills table

The table lists bills (up to 100 on this page):

| Column | Contents |
|--------|----------|
| **Bill #** | Link to bill detail |
| **Amount** | Bill total |
| **Received** | Received date (falls back to issue date) |
| **Due Date** | When the bill is due |
| **Status** | Status name |
| **Age (days)** | Days since issue date |
| **Actions** | **View** |

Sort tabs: **Due Date** (default), **Received**, **Amount**, **Bill #**. Search by bill number. Filter by status.

Empty copy: **No payables match your filters.**

> **Note:** AP does not create bills. Raise or receive bills from **Vendors → Bills** and purchase-order workflows.

## Drill-Through to a Bill

1. Click the bill number or **View**.
2. Review the bill on `/bills/[id]` (vendor, PO, amounts, status).
3. Return via the sidebar **Accounts Payable** when you want the ledger again.

From the bill you continue the vendor workflow (match to PO, pay, or query). Ageing on AP updates from bill dates and status — you do not edit buckets on this page.

## Dashboard AP Overdue

On **Dashboard**, the **AP overdue** tile shows:

- The overdue **currency total**
- A hint such as **N bills** or **None overdue**
- An amber icon when any bills are overdue

Click the tile to open this page. Work the earliest **Due Date** and oldest **Age (days)** first so vendors are not left waiting.

Together with **AR overdue**, the two tiles are a cash pulse: money in versus money out. The Dashboard money empty state covers both invoices and bills.

## AP vs Bills vs Invoices

| Page | What you are looking at | Money direction |
|------|-------------------------|-----------------|
| **Bills** (`/bills`) | Operational vendor bills | You **owe** |
| **Accounts Payable** (`/finance/ap`) | Ageing ledger of those bills | Same bills, finance view |
| **Purchase Orders** | Authorised spend before/alongside the bill | Commitment, not a bill |
| **Invoices** / **AR** | Customer invoices | Owed **to you** |

Do not look for **Create Invoice** on AP. Do not treat a customer invoice as a payable.

## Ledger vs Bills List

| | **Bills** | **Accounts Payable** |
|--|-----------|----------------------|
| Sidebar | Vendors | Finance |
| Route | `/bills`, `/bills/[id]` | `/finance/ap` only |
| Create / capture | Yes (vendor workflow) | No |
| Ageing totals | No | Yes — payable, overdue, paid, buckets |
| Job filter | Often job-scoped | Organisation-wide ledger |
| Typical user | Ops matching POs | Managers watching payables |

## Working a Payables Pass

1. Open **Accounts Payable** (or click **AP overdue** on Dashboard).
2. Compare **Total Overdue** with **Total Payable**. If overdue is high, sort by **Due Date** ascending.
3. Search by bill number when a vendor has queried a specific invoice they sent you.
4. Open the bill, confirm it matches the purchase order and (if relevant) a variation that changed authorised spend.
5. Process payment or query in your finance process, then return to AP to confirm the row left overdue.

Row **Age (days)** is counted from the bill **issue date**. **Received** and **Due Date** are shown separately so you can distinguish when you got the bill from when it is payable.

> **Tip:** If a bill looks unfamiliar, open **Purchase Orders** for the same job before you pay. Variations on estimates often explain a second bill.

> **Note:** The table loads a large first page (100 rows). Header **Payable** / **Overdue** stats come from the finance summary, not only the filtered table.

## Best Practices

1. **Open AP overdue from Dashboard** before you approve new vendor spend for the week.

2. **Sort by due date** when cash timing matters; use age in days when you are cleaning old balances.

3. **Always drill through to the bill** (and its PO) before paying or disputing — the ledger row is a summary only.

4. **Keep bills published/received in the vendor workflow** so they appear here; drafts may not age.

5. **Do not mix AR and AP mentally** — overdue invoices are collections; overdue bills are payments you owe.

6. **Reconcile AP buckets with Purchase Orders** when a bill looks high — variations and extra POs often explain the jump.

7. If AP is always zero, confirm `finance.read` and that bills exist under Vendors, not only invoices under Customers.
