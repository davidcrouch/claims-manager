# 25d — UI Plan D: Entity Modules (Quotes, POs, Invoices, Reports)

## Objective

Implement list and detail pages for Quotes, Purchase Orders, Invoices, and Reports. Follow the same SSR + client hybrid pattern as Claims and Jobs. Reuse EntityPanel, EntityCard, and layout patterns.

---

## Prerequisites

- Plans A, B, C complete: API client, layout, Claims/Jobs pages as reference

---

## 1. Quotes Module

### 1.1 Quotes List

**Route:** `(app)/quotes/page.tsx` → `/quotes`

**Rendering:** SSR initial load; client for search/sort/filter

**Data:** `GET /quotes` (or `GET /jobs/:jobId/quotes` aggregated — API may not have top-level list; check API)

**Components:**
- EntityPanel: search, sort (submittedAt, status), filters (status)
- EntityCard per quote:
  - Icon: FileSpreadsheet
  - Title: Quote ref or id
  - Subtitle: Job ref
  - TopRight: StatusBadge
  - Footer: Total amount, job link
- Click → `/quotes/[id]`

**Breadcrumbs:** `[{ title: 'Quotes', href: '/quotes' }]`

### 1.2 Quote Detail

**Route:** `(app)/quotes/[id]/page.tsx` → `/quotes/{id}`

**Rendering:** SSR

**Data:** `GET /quotes/:id`

**Content (per UI spec §3.5.2):**
- Quote groups, combos, items (from API Quote structure)
- Totals
- "Submit for Approval" button (Vendor role)
- Link to job

**Breadcrumbs:** `[{ title: 'Quotes', href: '/quotes' }, { title: quoteRef, href: `/quotes/${id}` }]`

**Metadata:** `generateMetadata` with quote ref

---

## 2. Purchase Orders Module

### 2.1 POs List

**Route:** `(app)/purchase-orders/page.tsx` → `/purchase-orders`

**Rendering:** SSR initial load; client for search/sort/filter

**Data:** `GET /purchase-orders` (or via job — API has `GET /purchase-orders` and `GET /jobs/:jobId/purchase-orders`)

**Components:**
- EntityPanel: search, sort, filters (status)
- EntityCard per PO:
  - Icon: ShoppingCart
  - Title: PO number
  - Subtitle: Job ref
  - TopRight: StatusBadge
  - Footer: Total, vendor
- Click → `/purchase-orders/[id]`

**Breadcrumbs:** `[{ title: 'Purchase Orders', href: '/purchase-orders' }]`

### 2.2 PO Detail

**Route:** `(app)/purchase-orders/[id]/page.tsx` → `/purchase-orders/{id}`

**Rendering:** SSR

**Data:** `GET /purchase-orders/:id`

**Content (per UI spec §3.6.2):**
- PO groups, combos, items
- Vendor allocation
- Status
- Linked invoices

**Breadcrumbs:** `[{ title: 'Purchase Orders', href: '/purchase-orders' }, { title: poNumber, href: `/purchase-orders/${id}` }]`

---

## 3. Invoices Module

### 3.1 Invoices List

**Route:** `(app)/invoices/page.tsx` → `/invoices`

**Rendering:** SSR initial load; client for search/sort/filter

**Data:** `GET /invoices`

**Components:**
- EntityPanel: search, sort, filters
- EntityCard per invoice:
  - Icon: Receipt
  - Title: Invoice ref
  - Subtitle: PO ref
  - TopRight: StatusBadge
  - Footer: Amount, status
- **Header action:** "Submit Invoice" → `InvoiceFormDrawer` (Plan E)
- Click → `/invoices/[id]`

**Breadcrumbs:** `[{ title: 'Invoices', href: '/invoices' }]`

### 3.2 Invoice Detail

**Route:** `(app)/invoices/[id]/page.tsx` → `/invoices/{id}`

**Rendering:** SSR

**Data:** `GET /invoices/:id`

**Content (per UI spec §3.7.2):**
- Invoice line items
- Status
- Linked PO

**Breadcrumbs:** `[{ title: 'Invoices', href: '/invoices' }, { title: invoiceRef, href: `/invoices/${id}` }]`

---

## 4. Reports Module

### 4.1 Reports List

**Route:** `(app)/reports/page.tsx` → `/reports`

**Rendering:** SSR initial load; client for search/sort/filter

**Data:** `GET /reports` (API has list; reports may also be via job `GET /jobs/:jobId/reports`)

**Components:**
- EntityPanel: search, sort, filters (type: assessment, completion)
- EntityCard per report
- Click → `/reports/[id]`

**Breadcrumbs:** `[{ title: 'Reports', href: '/reports' }]`

### 4.2 Report Detail

**Route:** `(app)/reports/[id]/page.tsx` → `/reports/{id}`

**Rendering:** SSR

**Data:** `GET /reports/:id`

**Content (per UI spec §3.8.2):**
- Report type
- Body
- Attachments
- Job link

**Breadcrumbs:** `[{ title: 'Reports', href: '/reports' }, { title: reportRef, href: `/reports/${id}` }]`

---

## 5. Implementation Pattern (Reusable)

For each entity module:

1. **List page:** `async` server component; fetch initial data; pass to `*ListClient`
2. **ListClient:** Client component with EntityPanel, EntityCard, search/sort/filter
3. **Detail page:** `async` server component; fetch by id; `notFound()` if missing
4. **Detail component:** Presentational; sections per UI spec
5. **loading.tsx** for each route segment
6. **generateMetadata** for detail pages

### 5.1 API Client Additions (if not in Plan A)

- `getQuotes(params)`, `getQuote(id)`
- `getPurchaseOrders(params)`, `getPurchaseOrder(id)`
- `getInvoices(params)`, `getInvoice(id)`
- `getReports(params)`, `getReport(id)`

---

## 6. Shared Components

### 6.1 Generic List Page Factory

Optional: Create a `createEntityListPage` helper to reduce boilerplate for list pages (Quotes, POs, Invoices, Reports). Accept config: `entity`, `apiMethod`, `cardConfig`, `breadcrumbs`, `searchPlaceholder`, `sortOptions`, `filters`.

### 6.2 Entity-Specific Cards

- `QuoteCard`, `PurchaseOrderCard`, `InvoiceCard`, `ReportCard` — each uses EntityCard with entity-specific props (icon, accent color, field mapping)

---

## 7. Loading States

Each module gets:
- `quotes/loading.tsx`
- `quotes/[id]/loading.tsx`
- Same for `purchase-orders`, `invoices`, `reports`

---

## 8. Verification

- [ ] Quotes list and detail load (SSR)
- [ ] POs list and detail load (SSR)
- [ ] Invoices list and detail load (SSR); "Submit Invoice" button present
- [ ] Reports list and detail load (SSR)
- [ ] Breadcrumbs correct on all pages
- [ ] 404 for invalid ids
- [ ] Search/sort/filter work on list pages (client)

---

## File Summary

| File | Purpose |
|------|---------|
| `app/(app)/quotes/page.tsx` | Quotes list |
| `app/(app)/quotes/[id]/page.tsx` | Quote detail |
| `app/(app)/purchase-orders/page.tsx` | POs list |
| `app/(app)/purchase-orders/[id]/page.tsx` | PO detail |
| `app/(app)/invoices/page.tsx` | Invoices list |
| `app/(app)/invoices/[id]/page.tsx` | Invoice detail |
| `app/(app)/reports/page.tsx` | Reports list |
| `app/(app)/reports/[id]/page.tsx` | Report detail |
| `components/quotes/*` | QuoteCard, QuoteDetail |
| `components/purchase-orders/*` | POCard, PODetail |
| `components/invoices/*` | InvoiceCard, InvoiceDetail |
| `components/reports/*` | ReportCard, ReportDetail |

---

*Next: 25e_UI_05_FORMS_SUPPORT.md*
