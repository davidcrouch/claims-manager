# UI Specification — EnsureOS Claims Workspace

**Date:** 2026-06-07
**Source:** Crunchwork Pulse observations (`docs/ui/`), Insurance REST API v17

---

## 1. Recursive Contractor Chain

Every tenant sees the same sidebar. Labels describe direction of relationship:

- **CUSTOMERS** = work received from upstream (insurer/head contractor)
- **VENDORS** = work delegated to downstream (sub-contractors)

| This tenant sends downstream | Downstream sees as |
|------------------------------|-------------------|
| RFQ | Work Order (scope) |
| PO | Work Order (committed) |
| **This tenant sends upstream** | **Upstream sees as** |
| Estimate/Quote | Proposal |
| Invoice | Bill |

---

## 2. Sidebar Navigation

```
Dashboard
─────────────────────────────
CUSTOMERS
  Jobs                        /jobs
  Estimates/Quotes            /quotes
  Work Orders                 /work-orders
  Invoices                    /invoices
  Claims                      /claims
─────────────────────────────
VENDORS
  RFQs                        /rfqs
  Proposals                   /proposals
  POs                         /purchase-orders
  Bills                       /bills
─────────────────────────────
OPERATIONS
  Tasks                       /tasks
  Schedule                    /schedule
  Messages                    /messages
  Appointments                /appointments
  Contacts                    /contacts
  Documents                   /admin/documents
─────────────────────────────
FINANCE
  Accounts Receivable         /finance/ar
  Accounts Payable            /finance/ap
  Reports                     /reports
─────────────────────────────
ADMIN
  Users                       /admin/users
  Settings                    /admin/settings
```

---

## 3. Common Page Patterns

### 3.1 List Page

| Element | Description |
|---------|-------------|
| ListPageHeader | Icon + title + total + status breakdown |
| SortTabs | Pill buttons (Updated, Created, Reference) |
| SearchInput | Debounced 300ms, clear button |
| StatusFilterMenu | Multi-select with All/None |
| Data table | Sortable columns, hover, click to detail |

### 3.2 Detail Page Tabs

Every entity detail page has these standard tabs:

| Tab | Content |
|-----|---------|
| Overview | KPI cards + section cards with field rows |
| Activities | Tasks + Appointments sections |
| Communications | Emails (outbound + shared) |
| Timeline | Notes + system audit events |
| Attachments | File list + upload |

### 3.3 Form Drawers

BottomFormDrawer pattern: icon + title + description header, form body in grid, Cancel + Submit footer. Zod validation with inline errors.

---

## 4. Spec Documents

| # | File | Pages | Group |
|---|------|-------|-------|
| 01 | `01_DASHBOARD.md` | Dashboard | — |
| 02 | `02_JOBS.md` | Jobs list + detail | CUSTOMERS |
| 03 | `03_ESTIMATES_QUOTES.md` | Quotes list + detail + create | CUSTOMERS |
| 04 | `04_WORK_ORDERS.md` | Work Orders list + detail | CUSTOMERS |
| 05 | `05_INVOICES.md` | Invoices list + detail + create | CUSTOMERS |
| 06 | `06_CLAIMS.md` | Claims list + detail | CUSTOMERS |
| 07 | `07_RFQS.md` | RFQs list + detail + create | VENDORS |
| 08 | `08_PROPOSALS.md` | Proposals list + detail | VENDORS |
| 09 | `09_PURCHASE_ORDERS.md` | POs list + detail + create | VENDORS |
| 10 | `10_BILLS.md` | Bills list + detail | VENDORS |
| 11 | `11_OPERATIONS.md` | Tasks, Schedule, Messages, Appointments, Contacts | OPERATIONS |
| 12 | `12_FINANCE.md` | AR, AP, Reports | FINANCE |
| 13 | `13_ADMIN.md` | Users, Documents, Settings | ADMIN |

---

## 5. Field Coverage

Every field from CW Pulse (`docs/ui/`) must appear in this app:

| CW Page | EnsureOS Location |
|---------|-------------------|
| Projects | Claims list + detail |
| Jobs | Jobs list + detail |
| Quotes | Estimates/Quotes (CUSTOMERS) |
| Purchase Orders | Work Orders (received) OR POs (sent) |
| Invoices | Invoices (sent up) OR Bills (received) |
| Tasks | Activities tab + standalone /tasks |
| Appointments | Activities tab + standalone /appointments |
| Emails | Communications tab + /messages |
| Notes/Timeline | Timeline tab on all entities |
