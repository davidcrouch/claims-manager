---
title: "Accounts Receivable"
slug: accounts-receivable
description: "How to use the Accounts Receivable ledger — outstanding and overdue customer invoices, ageing buckets, and drill-through to invoice detail."
section: operations
area: finance
routes:
  - /finance/ar
audience: manager
permissions_discussed:
  - finance.read
  - finance.manage
  - invoices.read
tags:
  - finance
  - accounts receivable
  - invoices
  - ageing
  - dashboard
related_guides:
  - invoices-overview
  - creating-an-invoice
  - accounts-payable
  - dashboard
version: 1
last_updated: 2026-08-31
---

# Accounts Receivable

**Accounts Receivable (AR)** is the finance view of **outgoing invoices** — money owed **to** your organisation. It is not the place to create invoices. Use it to see outstanding and overdue totals, ageing buckets, and to open a customer invoice.

The operational document list is **Customers → Invoices**. AR is **Finance → Accounts Receivable**.

## Key Concepts

- **Outstanding** — invoice value still receivable.
- **Overdue** — outstanding invoices that have passed your overdue rules (shown as a destructive total).
- **Paid** — invoice value already settled (summary card).
- **Ageing bucket** — outstanding amount grouped by age (for example current vs 30/60/90 days — labels come from the finance summary).
- **Age (days)** — days since the invoice **issue date**, shown on each row.
- **Ledger vs list** — AR is a collections ledger with summary cards; Invoices is where you create, publish, and archive documents.

## Accessing Accounts Receivable

1. In the left sidebar, under **Finance**, click **Accounts Receivable**.
2. The page opens at `/finance/ar` (there is no separate AR detail route).
3. Click an invoice number or **View** to open `/invoices/[id]`.

You can also click the Dashboard snapshot tile **AR overdue**, which links here.

> **Required permission:** `finance.read` to view this page and its summary. `finance.manage` is for updating finance records where edit controls exist. Opening an invoice still requires `invoices.read`.

## What the Page Shows

### Summary cards

Three cards at the top:

| Card | Meaning |
|------|---------|
| **Total Outstanding** | Sum still owed to you |
| **Total Overdue** | Outstanding amount that is overdue (highlighted) |
| **Total Paid** | Settled invoice value in the summary |

The page header also repeats **Outstanding** and **Overdue** as compact stats.

### Ageing buckets

When the finance summary includes buckets, a row of cards shows each **label**, **total amount**, and **invoice(s)** count. Use these to see whether debt is current or slipping into older bands.

### Invoice table

Below the cards, a table lists invoices (up to 100 on this page):

| Column | Contents |
|--------|----------|
| **Invoice #** | Link to invoice detail |
| **Amount** | Invoice total |
| **Issue Date** | Date the invoice was issued |
| **Status** | Status name |
| **Age (days)** | Days since issue date |
| **Actions** | **View** — same as clicking the number |

Sort tabs: **Issue Date**, **Amount**, **Invoice #**. Search by invoice number. Use the status filter to hide paid or draft rows depending on your lookups.

Empty copy: **No receivables match your filters.**

> **Note:** AR does not create invoices. If the table is empty but you expected drafts, they may still be unpublished on **Invoices**, or filtered out by status.

## Drill-Through to an Invoice

1. Click the invoice number or **View**.
2. Review Overview, line items, and publish status on the invoice.
3. Use the invoice **Back to invoices** control if you need the operational list; use the sidebar **Accounts Receivable** to return to the ledger.

From the invoice you can print, archive, or (if still a draft) publish. You do not change ageing on AR itself — ageing is calculated from issue date and status.

## Dashboard AR Overdue

On **Dashboard**, the **AR overdue** tile shows:

- The overdue **currency total**
- A hint such as **N invoices** or **None overdue**
- An amber icon when any invoices are overdue

Clicking the tile opens this page. Treat it as a pulse: then filter AR by status and open the oldest invoices first.

The Dashboard money panel empty state is **No overdue invoices or bills** when both AR and AP are clear.

## Ledger vs Invoices List

| | **Invoices** | **Accounts Receivable** |
|--|--------------|-------------------------|
| Sidebar | Customers | Finance |
| Route | `/invoices`, `/invoices/[id]` | `/finance/ar` only |
| Create / publish | Yes | No |
| Ageing totals | No (list total is visible-row value only) | Yes — outstanding, overdue, paid, buckets |
| Job filter | Yes (`?jobId=`) | No — organisation-wide ledger |
| Typical user | Estimators and ops creating documents | Managers watching collections |

## Working a Collections Pass

1. Open **Accounts Receivable** (or click **AR overdue** on Dashboard).
2. Note **Total Overdue** versus **Total Outstanding** — if overdue is most of outstanding, start there.
3. Sort by **Issue Date** ascending so the oldest invoices appear first, or by **Amount** if a few large debts dominate.
4. Filter status to hide settled invoices if your lookups include a Paid (or equivalent) status.
5. Open each overdue invoice, confirm it was **published** (not a leftover draft), and note insurer ref and job.
6. Follow up outside EnsureOS as your process requires, then return to AR to confirm the row has left overdue after payment is recorded.

Age on this page is **days since issue date**, not a separate due-date column. If your commercial terms use a due date, still treat a large **Age (days)** as a chase signal.

> **Tip:** Combine this page with **Invoices** search when you know the invoice number but need to publish or print. AR will not expose **Create Invoice**.

> **Note:** The table loads a large first page (100 rows). Totals in the summary cards are from the finance summary, not only the rows you can see after search.

## Best Practices

1. **Start from the AR overdue tile** on Monday mornings, then work oldest **Age (days)** first.

2. **Publish invoices promptly** so they enter outstanding; drafts do not collect.

3. **Do not use AR as a substitute for Invoices** when you need to raise or correct a document.

4. **Reconcile bucket totals** with what ops thinks is billed — mismatches often mean unpublished drafts or archived invoices.

5. **Open the invoice before chasing** so you quote the insurer ref and linked work order correctly.

6. **Pair AR with AP** in the same session if cash timing matters — they are opposite directions of trade.

7. If the page is always empty, confirm `finance.read` on your role rather than assuming there are no invoices.
