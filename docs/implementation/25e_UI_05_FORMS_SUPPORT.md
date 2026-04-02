# 25e — UI Plan E: Forms, Drawers & Support

## Objective

Implement form drawers for create/edit flows, Messages (Job context), Vendors page, Attachments/Appointments in-context, and role-based visibility per UI spec §4, §5, §3.9–3.12.

---

## Prerequisites

- Plans A–D complete: API client, layout, all list/detail pages

---

## 1. Form Drawer Pattern

### 1.1 Shared Drawer Structure (per UI spec §4)

- **Component:** Sheet (shadcn) sliding from right
- **Header:** Title + close (X)
- **Body:** Form with Label + Input/Select/Textarea
- **Footer:** Cancel, Submit
- **Validation:** `react-hook-form` + `zod` (or `useForm` equivalent)
- **API calls:** Client-side; use API client with token from auth context

### 1.2 Drawer State

- Each drawer: `open` state (boolean)
- Trigger: Button click sets `open = true`
- On success: Close drawer, invalidate/refetch list (React Query or callback)
- On cancel: Set `open = false`

---

## 2. Form Drawers to Implement

### 2.1 JobFormDrawer

**Trigger:** Jobs list "Create Job" button

**Fields:** claimId, jobType, status, jobInstructions, makeSafeRequired, collectExcess, excess, etc.

**API:** `POST /jobs`

**Dependencies:** Claim selector (from `GET /claims` or search), Job type selector (from `GET /lookups`)

### 2.2 QuoteFormDrawer

**Trigger:** Job Detail → Quotes tab "Create Quote"

**Fields:** jobId (pre-filled), groups, items (per API Quote structure)

**API:** `POST /quotes`

**Context:** Job id from URL/context

### 2.3 InvoiceFormDrawer

**Trigger:** Invoices list "Submit Invoice"

**Fields:** PO ref, line items

**API:** `POST /invoices`

**Dependencies:** PO selector (from `GET /purchase-orders` or job context)

### 2.4 MessageFormDrawer

**Trigger:** Job Detail → Messages tab "Send Message"

**Fields:** body, recipient (if applicable)

**API:** `POST /messages`

**Context:** Job id from URL; include in payload

### 2.5 ReportFormDrawer

**Trigger:** Job Detail → Reports tab "Create Report"

**Fields:** type, body, attachments (optional)

**API:** `POST /reports`

**Context:** Job id from URL

### 2.6 AppointmentFormDrawer

**Trigger:** Job Detail → Overview or Appointments section "Create Appointment"

**Fields:** attendees, date/time, etc.

**API:** `POST /appointments`

**Context:** Job id from URL

---

## 3. API Client Mutations

Add to `api-client.ts`:

| Method | Endpoint | Use |
|--------|----------|-----|
| `createJob(body)` | `POST /jobs` | JobFormDrawer |
| `createQuote(body)` | `POST /quotes` | QuoteFormDrawer |
| `createInvoice(body)` | `POST /invoices` | InvoiceFormDrawer |
| `createMessage(body)` | `POST /messages` | MessageFormDrawer |
| `acknowledgeMessage(id)` | `POST /messages/:id/acknowledge` | Message acknowledge |
| `createReport(body)` | `POST /reports` | ReportFormDrawer |
| `createAppointment(body)` | `POST /appointments` | AppointmentFormDrawer |
| `updateAppointment(id, body)` | `POST /appointments/:id` | Appointment edit |
| `cancelAppointment(id)` | `POST /appointments/:id/cancel` | Appointment cancel |
| `updateJobStatus(id, body)` | `POST /jobs/:id/status` | Job status (Vendor) |

---

## 4. Messages (Job Context)

**Per UI spec §3.9:** Option B — Messages only in Job context (`/jobs/[id]` → Messages tab)

### 4.1 Messages Tab Content

- **List:** Message list (sender, body, timestamp) — from `GET /jobs/:jobId/messages` or `GET /messages` with job filter
- **Send:** "Send Message" → MessageFormDrawer
- **Acknowledge:** Action on message → `POST /messages/:id/acknowledge`

### 4.2 API

- List: `GET /jobs/:jobId/messages` or `GET /messages?jobId=`
- Create: `POST /messages` with `jobId` in body
- Acknowledge: `POST /messages/:id/acknowledge`

---

## 5. Vendors Page

### 5.1 Route

- `(app)/vendors/page.tsx` → `/vendors`

### 5.2 Rendering

- **SSR:** Fetch vendors on server

### 5.3 Data

- `GET /vendors` — list
- `GET /vendors/allocation` — allocation matrix (Phase 4 API)

### 5.4 Content (per UI spec §3.12)

- List vendors
- Purpose: Vendor allocation for jobs (Phase 4)
- For now: Simple list; allocation UI when API supports it

### 5.5 Breadcrumbs

- `[{ title: 'Vendors', href: '/vendors' }]`

---

## 6. Attachments (In-Context)

**Per UI spec §3.10:** No standalone page. Upload/download within Job, Quote, Report context.

### 6.1 Components

- **Upload zone:** Drag-drop or file picker
- **Attachment list:** List with download links

### 6.2 API

- `POST /attachments` — upload (multipart)
- `GET /attachments/:id` — metadata
- `GET /attachments/:id/download` — file download

### 6.3 Placement

- Job Detail (Overview or Attachments section)
- Quote Detail
- Report Detail

### 6.4 Implementation

- Client component `AttachmentUpload` + `AttachmentList`
- Use `FormData` for upload; API client method `uploadAttachment(file, entityType, entityId)`

---

## 7. Appointments (Job Context)

**Per UI spec §3.11:** Job-level; display in Job Detail → Overview or "Appointments" tab.

### 7.1 Display

- List appointments from job (API: `GET /appointments/job/:jobId` or included in job response)
- Show: attendees, date/time, status

### 7.2 Actions

- Create: AppointmentFormDrawer
- Update: Edit form or drawer
- Cancel: `POST /appointments/:id/cancel`

---

## 8. Role-Based Visibility

**Per UI spec §5**

| Role | Visible Pages / Actions |
|------|-------------------------|
| Admin | All |
| Claims Manager | Dashboard, Claims, Jobs, Quotes, POs, Invoices, Reports |
| Assessor | Dashboard, Claims, Jobs (read), Reports (create) |
| Vendor | Dashboard, Jobs (assigned), Quotes (create), POs (read), Invoices (submit), Reports (create), Messages |
| Finance | Dashboard, POs, Invoices |

### 8.1 Implementation

- **Source of role:** Kinde custom claims or API user profile
- **Components:** `useRole()` or `usePermissions()` hook
- **Conditional rendering:** Hide nav items, buttons, tabs based on role
- **API:** Backend enforces; frontend hides UI for better UX

### 8.2 Nav Filtering

- Filter `NavMain` items by role (e.g. Finance sees only Dashboard, POs, Invoices)
- Use `getKindeServerSession()` or client `useAuth()` for role

### 8.3 Action Filtering

- "Create Job" — Claims Manager, Admin
- "Create Quote" — Vendor
- "Submit Invoice" — Vendor
- "Submit for Approval" (Quote) — Vendor
- Job Status form — Vendor

---

## 9. Dependencies

```bash
pnpm add react-hook-form @hookform/resolvers zod
```

- `react-hook-form` — form state
- `zod` — schema validation
- `@hookform/resolvers` — zod resolver for RHF

---

## 10. Verification

- [ ] JobFormDrawer opens, submits, closes; jobs list refreshes
- [ ] QuoteFormDrawer works from Job Quotes tab
- [ ] InvoiceFormDrawer works from Invoices list
- [ ] MessageFormDrawer works from Job Messages tab
- [ ] ReportFormDrawer works from Job Reports tab
- [ ] AppointmentFormDrawer works from Job Overview/Appointments
- [ ] Message acknowledge action works
- [ ] Vendors page loads
- [ ] Attachments upload/list in Job/Quote/Report context
- [ ] Role-based nav and actions (with test roles)

---

## File Summary

| File | Purpose |
|------|---------|
| `components/forms/JobFormDrawer.tsx` | Create job |
| `components/forms/QuoteFormDrawer.tsx` | Create quote |
| `components/forms/InvoiceFormDrawer.tsx` | Submit invoice |
| `components/forms/MessageFormDrawer.tsx` | Send message |
| `components/forms/ReportFormDrawer.tsx` | Create report |
| `components/forms/AppointmentFormDrawer.tsx` | Create appointment |
| `components/attachments/AttachmentUpload.tsx` | Upload zone |
| `components/attachments/AttachmentList.tsx` | List + download |
| `app/(app)/vendors/page.tsx` | Vendors list |
| `lib/useRole.ts` or `lib/permissions.ts` | Role/permission helpers |

---

*End of UI Implementation Plans. Reference: docs/design/02_UI_SPECIFICATION.md*
