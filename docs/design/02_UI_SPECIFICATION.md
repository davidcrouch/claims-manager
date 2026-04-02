# UI Page Specification — Claims Manager Application

**Version:** 1.0  
**Date:** 2025-03-20  
**Reference:** PRD (docs/PRD.md), Insurance REST API v17, workers-comp-ai-paralegal UI style

---

## 1. Design System Reference

The UI **must** follow the same style and component patterns as `../workers-comp-ai-paralegal/resources/js`. Key elements to copy:

### 1.1 Layout
- **AdminLayout** (or equivalent): Top bar with breadcrumbs + header actions; collapsible sidebar; grid layout `7% header / 93% content`
- **AppShell** with sidebar variant; `AppContent`, `AppSidebarHeader`
- **Breadcrumbs**: `BreadcrumbItem[]` with `title` and `href`

### 1.2 Components (shadcn-style)
| Component | Use |
|-----------|-----|
| `EntityPanel` | List pages with search, sort, filters, pagination |
| `EntityCard` | Card layout for list items (compound: Icon, Title, Subtitle, Description, Footer, TopRight, Badge) |
| `StatusBadge` | Status indicators (active/inactive, or custom labels) |
| `Sheet` (Drawer) | Side panels for create/edit forms |
| `Dialog` | Confirmations, modals |
| `Input`, `Label`, `Textarea` | Form fields |
| `Select` (SelectTrigger, SelectContent, SelectItem) | Dropdowns |
| `Button` | Actions |
| `Card` | Content containers |
| `Tabs` | Tabbed content (Overview, Quotes, POs, etc.) |

### 1.3 Styling
- **Colors**: `bg-btn-primary`, `hover:bg-btn-primary-hover`, `bg-btn-destructive`, `text-slate-500`, `text-slate-700`, `border-slate-200`
- **EntityCard**: `border-l-4` accent, `minWidth: 265`, `maxWidth: 322`, `height: 128`
- **Search**: Debounced (300ms), `Search` icon, clear button
- **Sort**: `SortButton` with `ArrowUp`/`ArrowDown` for asc/desc
- **Filters**: `MultiSelectFilter` with checkboxes, All/None

### 1.4 Navigation
- **Sidebar**: Collapsible, icon mode; `SidebarHeader`, `SidebarContent`, `SidebarFooter`
- **NavMain** with `NavItem[]`: `{ title, href, icon }`
- **Icons**: Lucide (e.g. `LayoutDashboard`, `FileText`, `Briefcase`, `Receipt`, etc.)

---

## 2. Global Navigation Structure

### 2.1 Sidebar (Level 1)
| Nav Item | Route | Icon | Notes |
|----------|-------|------|-------|
| Dashboard | `/dashboard` | LayoutDashboard | Default landing |
| Claims | `/claims` | FileText | List claims |
| Jobs | `/jobs` | Briefcase | List jobs |
| Quotes | `/quotes` | FileSpreadsheet | List quotes |
| Purchase Orders | `/purchase-orders` | ShoppingCart | List POs |
| Invoices | `/invoices` | Receipt | List invoices |
| Reports | `/reports` | ClipboardList | List reports |
| Vendors | `/vendors` | Building2 | Vendor management (PRD) |
| Messages | `/messages` | MessageSquare | Optional top-level or in Job context |

### 2.2 Top Bar
- **Tenant selector**: Dropdown showing `active-tenant-id` (tenant name)
- **User menu**: Avatar, name, logout
- **Notifications**: Bell icon; webhook-driven alerts (new jobs, approvals needed)

---

## 3. Page Specifications

---

### 3.1 Public Website

#### 3.1.1 Landing Page
- **Route:** `/`
- **Layout:** Marketing layout (no sidebar)
- **Content:**
  - Hero section
  - Marketing content
  - Login / Register buttons → Kinde hosted auth
  - Pricing (future placeholder)

---

### 3.2 Dashboard

#### 3.2.1 Dashboard Page
- **Route:** `/dashboard`
- **Layout:** Authenticated app layout
- **Breadcrumbs:** `[{ title: 'Dashboard', href: '/dashboard' }]`
- **Components:**
  - **KPI widgets** (cards): Claim count, Job count, Pending approvals, Open invoices
  - **Recent activity** (list): Recent jobs, new quotes, new reports (from webhook events)
  - **Alerts** (banner/list): New jobs, approvals needed
- **API:** Aggregated from `GET /claims`, `GET /jobs`, cached data
- **Style:** Card grid; use `Card` + `EntityCard`-like layout for widgets

---

### 3.3 Claims Module

#### 3.3.1 Claims List
- **Route:** `/claims`
- **Layout:** Authenticated app layout
- **Breadcrumbs:** `[{ title: 'Claims', href: '/claims' }]`
- **Components:**
  - **EntityPanel** with:
    - Search: "Search claims by claim number or external reference..."
    - Sort: `claimNumber`, `lodgementDate`, `status`, `updatedAt`
    - Filters: `status` (multi-select), `account` (optional)
  - **EntityCard** per claim:
    - Icon: FileText (accent: `border-l-blue-500`)
    - Title: `claimNumber` or `externalReference`
    - Subtitle: Address (e.g. `streetNumber streetName, suburb`)
    - TopRight: `StatusBadge` (status.name)
    - Footer: `lodgementDate`, `account.name`
- **Click:** Navigate to `/claims/{id}`
- **API:** `GET /claims`, `GET /claims?claimNumber=...`, `GET /claims?externalReference=...`

#### 3.3.2 Claim Detail
- **Route:** `/claims/{id}`
- **Layout:** Authenticated app layout
- **Breadcrumbs:** `[{ title: 'Claims', href: '/claims' }, { title: claimNumber, href: `/claims/${id}` }]`
- **Content:**
  - **Header:** Claim number, status badge, address
  - **Sections (read-only):**
    - Address (unitNumber, streetNumber, streetName, suburb, postcode, state, country)
    - Policy (policyName, policyNumber, policyType, policyInceptionDate)
    - Loss (lossType, lossSubType, dateOfLoss, incidentDescription)
    - Contacts (firstName, lastName, email, type, mobilePhone, etc.)
    - Assignees
  - **Linked Jobs:** Table or card list of jobs; link to `/jobs/{jobId}`
- **API:** `GET /claims/{id}` (includes jobs when available)

---

### 3.4 Jobs Module (Core)

#### 3.4.1 Jobs List
- **Route:** `/jobs`
- **Layout:** Authenticated app layout
- **Breadcrumbs:** `[{ title: 'Jobs', href: '/jobs' }]`
- **Header action:** "Create Job" button → opens `JobFormDrawer` (if API supports `POST /jobs`)
- **Components:**
  - **EntityPanel** with:
    - Search: "Search jobs by external reference or address..."
    - Sort: `requestDate`, `status`, `jobType`, `updatedAt`
    - Filters: `status`, `jobType`
  - **EntityCard** per job:
    - Icon: Briefcase (accent: `border-l-amber-500`)
    - Title: `externalReference` or job id
    - Subtitle: Address from claim
    - TopRight: `StatusBadge` (status.name)
    - Footer: `jobType.name`, `requestDate`, link to claim
- **Click:** Navigate to `/jobs/{id}`
- **API:** `GET /jobs` (or via claim context)

#### 3.4.2 Job Detail (Entity Context Navigation)
- **Route:** `/jobs/{id}`
- **Layout:** Authenticated app layout
- **Breadcrumbs:** `[{ title: 'Jobs', href: '/jobs' }, { title: jobRef, href: `/jobs/${id}` }]`
- **Tabs (Level 2):**
  | Tab | Content | API |
  |-----|---------|-----|
  | Overview | Job fields, address, claim link, status | `GET /jobs/{id}` |
  | Quotes | List of quotes | `GET /jobs/{id}/quotes` |
  | POs | List of purchase orders | `GET /jobs/{id}/purchase-orders` |
  | Tasks | List of tasks | `GET /jobs/{id}/tasks` |
  | Messages | Job-level messages | `GET /jobs/{id}/messages` |
  | Reports | Assessment/completion reports | `GET /jobs/{id}/reports` (or reports linked to job) |
  | Status | Status update form (Vendor) | `POST /jobs/{id}/status` |

- **Overview tab:**
  - Job type, status, external reference
  - Address (from claim)
  - Claim link
  - Vendor (if allocated)
  - jobInstructions, makeSafeRequired, collectExcess, excess
  - Appointments (if any)

- **Quotes tab:**
  - List of quotes (card or table)
  - "Create Quote" → `QuoteFormDrawer` (Vendor)
  - Link to quote detail

- **POs tab:**
  - List of POs
  - Link to PO detail

- **Tasks tab:**
  - List of tasks; status; assignee
  - "Create Task" (if supported)

- **Messages tab:**
  - Message list (sender, body, timestamp)
  - "Send Message" form
  - Acknowledge action → `POST /messages/{id}/acknowledge`

- **Reports tab:**
  - List of reports
  - "Create Report" (Vendor)

---

### 3.5 Quotes Module

#### 3.5.1 Quotes List
- **Route:** `/quotes`
- **Layout:** Authenticated app layout
- **Breadcrumbs:** `[{ title: 'Quotes', href: '/quotes' }]`
- **Components:**
  - **EntityPanel** with search, sort (submittedAt, status), filters (status)
  - **EntityCard** per quote:
    - Icon: FileSpreadsheet
    - Title: Quote ref or id
    - Subtitle: Job ref
    - TopRight: StatusBadge
    - Footer: Total amount, job link
- **API:** Quotes are typically fetched via job (`GET /jobs/{id}/quotes`); standalone list may require backend aggregation

#### 3.5.2 Quote Detail
- **Route:** `/quotes/{id}`
- **Layout:** Authenticated app layout
- **Breadcrumbs:** `[{ title: 'Quotes', href: '/quotes' }, { title: quoteRef, href: `/quotes/${id}` }]`
- **Content:**
  - Quote groups, combos, items (from API Quote structure)
  - Totals
  - "Submit for Approval" button (Vendor)
  - Link to job

---

### 3.6 Purchase Orders Module

#### 3.6.1 POs List
- **Route:** `/purchase-orders`
- **Layout:** Authenticated app layout
- **Breadcrumbs:** `[{ title: 'Purchase Orders', href: '/purchase-orders' }]`
- **Components:**
  - **EntityPanel** with search, sort, filters (status)
  - **EntityCard** per PO:
    - Icon: ShoppingCart
    - Title: PO number
    - Subtitle: Job ref
    - TopRight: StatusBadge
    - Footer: Total, vendor
- **API:** `GET /purchase-orders/{id}`; list may be via job or aggregated

#### 3.6.2 PO Detail
- **Route:** `/purchase-orders/{id}`
- **Layout:** Authenticated app layout
- **Content:**
  - PO groups, combos, items
  - Vendor allocation
  - Status
  - Linked invoices

---

### 3.7 Invoices Module

#### 3.7.1 Invoices List
- **Route:** `/invoices`
- **Layout:** Authenticated app layout
- **Breadcrumbs:** `[{ title: 'Invoices', href: '/invoices' }]`
- **Header action:** "Submit Invoice" → `InvoiceFormDrawer`
- **Components:**
  - **EntityPanel** with search, sort, filters
  - **EntityCard** per invoice:
    - Icon: Receipt
    - Title: Invoice ref
    - Subtitle: PO ref
    - TopRight: StatusBadge
    - Footer: Amount, status
- **API:** `POST /invoices`, `GET /invoices/{id}`

#### 3.7.2 Invoice Detail
- **Route:** `/invoices/{id}`
- **Content:** Invoice line items, status, linked PO

---

### 3.8 Reports Module

#### 3.8.1 Reports List
- **Route:** `/reports`
- **Layout:** Authenticated app layout
- **Components:**
  - **EntityPanel** with search, sort, filters (type: assessment, completion)
  - **EntityCard** per report
- **API:** Reports via job; list may be aggregated

#### 3.8.2 Report Detail
- **Route:** `/reports/{id}`
- **Content:** Report type, body, attachments, job link

---

### 3.9 Messages

- **Option A:** Top-level `/messages` (inbox-style)
- **Option B:** Only in Job context (`/jobs/{id}` → Messages tab)
- **Recommendation:** Option B per PRD ("Job-level communication")
- **Actions:** Send message, acknowledge (`POST /messages/{id}/acknowledge`)

---

### 3.10 Attachments

- **No standalone page**
- **Usage:** Upload/download within entity context (Job, Quote, Report, etc.)
- **Components:**
  - Upload zone (drag-drop or file picker)
  - Attachment list with download links
- **API:** `POST /attachments`, `GET /attachments/{id}`, `GET /attachments/{id}/download`

---

### 3.11 Appointments

- **Context:** Job-level (job has appointments)
- **Display:** In Job Detail → Overview or dedicated "Appointments" tab
- **Actions:** Create, Update, Cancel (`POST /appointments/{id}/cancel`)
- **API:** `POST /appointments`, `POST /appointments/{id}`, `GET /appointments/{id}`

---

### 3.12 Vendors

- **Route:** `/vendors`
- **Layout:** Authenticated app layout
- **Content:** List vendors (from `GET /vendors/allocation` or equivalent)
- **Purpose:** Vendor allocation for jobs (Phase 4 API)

---

## 4. Form Drawers (Create/Edit)

All create/edit flows use **Sheet** (drawer) from the right, matching `WorkflowFormDrawer` pattern:

| Form | Trigger | Fields (key) | API |
|------|---------|--------------|-----|
| JobFormDrawer | Jobs list "Create Job" | claimId, jobType, status, jobInstructions, etc. | `POST /jobs` |
| QuoteFormDrawer | Job Quotes tab "Create Quote" | jobId, groups, items | `POST /quotes` |
| InvoiceFormDrawer | Invoices list "Submit Invoice" | PO ref, line items | `POST /invoices` |
| MessageFormDrawer | Job Messages tab | body, recipient | `POST /messages` |
| ReportFormDrawer | Job Reports tab | type, body | `POST /reports` |
| AppointmentFormDrawer | Job Overview/Appointments | attendees, date/time | `POST /appointments` |

**Drawer pattern:**
- Slide from right
- Header: Title + close (X)
- Form: Label + Input/Select/Textarea
- Footer: Cancel, Submit
- Use `useForm` or similar for validation/errors

---

## 5. Role-Based Visibility

| Role | Visible Pages / Actions |
|------|-------------------------|
| Admin | All |
| Claims Manager | Dashboard, Claims, Jobs, Quotes, POs, Invoices, Reports |
| Assessor | Dashboard, Claims, Jobs (read), Reports (create) |
| Vendor | Dashboard, Jobs (assigned), Quotes (create), POs (read), Invoices (submit), Reports (create), Messages |
| Finance | Dashboard, POs, Invoices |

---

## 6. API Endpoint Mapping Summary

| Page / Action | API |
|---------------|-----|
| Claims list | `GET /claims`, `GET /claims?claimNumber=`, `GET /claims?externalReference=` |
| Claim detail | `GET /claims/{id}` |
| Jobs list | Via claims or `GET /jobs` (if available) |
| Job detail | `GET /jobs/{id}`, `POST /jobs/{id}` |
| Job quotes | `GET /jobs/{id}/quotes` |
| Job POs | `GET /jobs/{id}/purchase-orders` |
| Job tasks | `GET /jobs/{id}/tasks` |
| Job messages | `GET /jobs/{id}/messages` |
| Job reports | `GET /jobs/{id}/reports` (Phase 2) |
| Job status | `POST /jobs/{id}/status` (Phase 2, Vendor) |
| Quote create | `POST /quotes` |
| Quote detail | `GET /quotes/{id}` |
| PO detail | `GET /purchase-orders/{id}` |
| Invoice create | `POST /invoices` |
| Invoice detail | `GET /invoices/{id}` |
| Message create | `POST /messages` |
| Message acknowledge | `POST /messages/{id}/acknowledge` |
| Report create | `POST /reports` |
| Report detail | `GET /reports/{id}` |
| Appointment create | `POST /appointments` |
| Appointment update | `POST /appointments/{id}` |
| Appointment cancel | `POST /appointments/{id}/cancel` |
| Attachments | `POST /attachments`, `GET /attachments/{id}`, `GET /attachments/{id}/download` |

---

## 7. Open Questions for Product

1. **Claims list source:** Does `GET /claims` return a paginated list, or is filtering only by `claimNumber`/`externalReference`? If no list endpoint, how should the Claims list be populated (cache, webhooks)?
2. **Jobs list source:** Is there a `GET /jobs` list endpoint, or are jobs only accessible via `GET /claims/{id}` (with included jobs)?
3. **Quotes/POs/Invoices list:** Are there top-level list endpoints, or only via job context?
4. **Vendors page:** What data does `GET /vendors/allocation` return? Is it a simple list or allocation matrix?
5. **Command palette:** PRD mentions Command palette — should we add a global Cmd+K style quick navigation?
6. **Real-time updates:** Should the UI poll or use Supabase realtime for webhook-driven updates?

---

## 8. File Structure (Suggested)

```
apps/frontend/
├── app/
│   ├── (auth)/           # Public + auth pages
│   │   ├── page.tsx      # Landing
│   │   └── ...
│   └── (app)/            # Authenticated
│       ├── layout.tsx    # App layout with sidebar
│       ├── dashboard/
│       ├── claims/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx
│       ├── jobs/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx
│       ├── quotes/
│       ├── purchase-orders/
│       ├── invoices/
│       ├── reports/
│       └── vendors/
├── components/
│   ├── layout/           # AppShell, Sidebar, Header
│   ├── claims/           # ClaimCard, ClaimDetail, etc.
│   ├── jobs/             # JobCard, JobDetail, JobTabs
│   ├── quotes/
│   ├── invoices/
│   └── ui/               # shadcn components
```

---

*End of UI Specification*
