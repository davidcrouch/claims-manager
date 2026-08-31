# 63f — Guides: Invoices, Finance, Reports

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Priority:** P2  
**Related:** `12_INVOICES_MODULE.md`, `ui/05_INVOICES.md`, `33f_FINANCE_AR_AP.md`, `ui/12_FINANCE.md`, `16_REPORTS_MODULE.md`, `56_REPORT_BUILDER_UX.md`

---

## Objective

Document customer invoices, AR/AP ledgers, and the Reports experience (run/print vs template admin, which is 63i).

---

## Guides

| File | Slug | Routes | Audience |
|------|------|--------|----------|
| `operations/invoices/overview.md` | `invoices-overview` | `/invoices`, `/invoices/[id]` | member |
| `operations/invoices/creating-an-invoice.md` | `creating-an-invoice` | `/invoices`, `/invoices/[id]` | member |
| `operations/finance/accounts-receivable.md` | `accounts-receivable` | `/finance/ar` | manager |
| `operations/finance/accounts-payable.md` | `accounts-payable` | `/finance/ap` | manager |
| `operations/finance/reports.md` | `reports` | `/reports`, `/reports/[id]` | member |

---

## 1. Invoices — Overview

**Sources:** invoice list/detail, `PublishButton` on `InvoiceDetail.tsx`. Permissions: `invoices.read`, `invoices.create`, `invoices.update`, `invoices.approve`.

### Outline

1. Intro — bill the insurer/customer for work; not the same as vendor **Bills**.
2. Key Concepts — invoice vs bill vs AR; statuses; job link.
3. Accessing — Customers → **Invoices**. Job filter.
4. List — columns, filters, New Invoice.
5. Detail tour — header, line items if any, publish, approve/reject if `invoices.approve`.
6. Dashboard AR overdue tile → this list / finance AR.
7. Best practices — don’t invoice before the job milestone (report submitted / works complete); match PO amounts.

`related_guides`: `creating-an-invoice`, `accounts-receivable`, `bills`, `jobs-overview`, `work-orders-overview`

Walk live detail tabs — UI spec may be stale.

---

## 2. Creating an Invoice

### Outline

1. From list vs from job/estimate if drawers exist.
2. Header fields, lines, tax as shown.
3. Publish wizard (parallel to estimates — walk `InvoiceDetail` publish flow).
4. Required permissions.
5. Warning — publishing may send to the insurer.
6. Best practices — use the assessment/works fee PO as the source of truth when present.

---

## 3. Accounts Receivable

**Route:** `/finance/ar` only (no `[id]` page in the tree).

### Outline

1. Intro — accounting view of **outgoing invoices** (money owed to you).
2. Accessing — Finance → **Accounts Receivable**. `finance.read` / `finance.manage`.
3. What the page shows (aging, overdue, open invoices — **walk live**).
4. Drill-through to invoice detail.
5. Dashboard snapshot **AR overdue**.
6. vs Invoices list — AR is the ledger; Invoices is the operational document.
7. Best practices.

`related_guides`: `invoices-overview`, `accounts-payable`, `dashboard`

---

## 4. Accounts Payable

**Route:** `/finance/ap`

### Outline

Mirror AR for **bills** (money you owe vendors). Drill to `/bills`. Dashboard **AP overdue**. `related_guides`: `bills`, `purchase-orders`, `dashboard`.

---

## 5. Reports

**Routes:** `/reports`, `/reports/[id]`  
**Sources:** reports pages, `56_REPORT_BUILDER_UX.md` (end-user print + builder agent). Template **admin** is `document-templates` (63i). Page agent `report-builder`.

### Outline

1. Intro — generate documents (assessment reports, scopes, invoices) from records.
2. Key Concepts — report run vs document template; print wizard / data scope if present on entity Print buttons vs this page.
3. Accessing — Finance → **Reports**. `reports.read`.
4. List + opening a report / generating.
5. Print from a job/assessment/estimate — `PrintButton` + `PrintDocumentDrawer` (users often never visit `/reports`). Mention both paths.
6. Tip — chat `report-builder` on this page; **?** for this guide.
7. Pointer to Document Templates for admins.
8. Best practices — choose the right document type; don’t email drafts.

`related_guides`: `assessment-reports`, `document-templates`, `jobs-overview`, `invoices-overview`

If `/reports` is a thin list, keep the guide short and put weight on “printing from a record”.

---

## Index updates

TOC already lists these five files.

---

## Ingest & smoke

| Route | Expect |
|-------|--------|
| `/invoices` | `invoices-overview` |
| `/finance/ar` | `accounts-receivable` |
| `/finance/ap` | `accounts-payable` |
| `/reports` | `reports` |

---

## Acceptance

- [ ] Invoice vs bill vs AR/AP distinctions are explicit.
- [ ] Reports guide covers Print on records, not only `/reports`.
- [ ] Ingest + **?** on AR and invoices.
