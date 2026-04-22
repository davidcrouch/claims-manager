# 32 — UI: Job Detail Page Revamp

## Objective

Redesign the Job detail page (`/jobs/[id]`) as a **professional, information-dense detail page** that fully surfaces the Crunchwork **Job** entity defined in the Insurance REST API spec (§3.3.2) and persisted in the `jobs` table and its related tables.

The new layout groups data into logical tabs, renders job-type-specific fields conditionally, exposes the full sub-resource graph (quotes, POs, invoices, tasks, messages, reports, appointments, attachments, contacts), and matches the professional styling introduced by the Claim detail revamp (plan 25c / recent refactor).

This is a **frontend-only** plan. It does **not** require any API, DB schema, or webhook changes.

---

## Context

### Source 1 — Insurance REST API v17 (PDF)

- **§3.3.2 Job — Contract:** Full field list for the Job entity including common job fields, vendor, contacts, appointments, and **job-type-conditional** fields (Temporary Accommodation, Specialist, Rectification, Internal Audit).
- **§3.3.3 Job (when included in Claim):** Slimmed-down representation: `id`, `jobType`, `status`, `vendor`, `externalReference`. The Job detail page must show the full Job contract — this slim shape is only used when nested inside a Claim response.
- **§3.2.2 Methods:**
  - `POST /jobs` (create) — Phase 1
  - `GET /jobs` (list) / `GET /jobs/{id}` (read) — Phase 1
  - `POST /jobs/{id}` (update, full) — Phase 1
  - `GET /jobs/{id}/quotes` — Phase 1
  - `POST /jobs/{id}/status` (Vendor, status-only update) — Phase 2
  - `GET /jobs/{id}/purchase-orders`, `/messages`, `/reports`, `/tasks`, `/invoices` — Phase 2

### Source 2 — Database schema

From `apps/api/src/database/schema/index.ts`:

**`jobs` table** — core persisted fields:

| Column | Notes |
|---|---|
| `id`, `tenantId`, `claimId`, `parentClaimId`, `parentJobId` | Identity + hierarchy |
| `externalReference`, `jobTypeLookupId`, `statusLookupId` | Core classifiers |
| `vendorId` | Optional vendor allocation |
| `requestDate`, `collectExcess`, `excess`, `makeSafeRequired` | Scheduling + finance |
| `jobInstructions` (HTML) | Instructions |
| `address` (jsonb) + promoted `addressPostcode/Suburb/State/Country` | Risk address |
| `vendorSnapshot` (jsonb) | Vendor snapshot at time of sync |
| `temporaryAccommodationDetails` (jsonb) | TA-type fields |
| `specialistDetails` (jsonb) | Specialist-type fields |
| `rectificationDetails` (jsonb) | Rectification-type fields |
| `auditDetails` (jsonb) | Audit-type fields |
| `mobilityConsiderations` (jsonb array) | TA accessibility |
| `apiPayload` (jsonb) | Full raw Crunchwork payload |
| `customData` (jsonb), `createdAt`, `updatedAt`, `deletedAt` | Housekeeping |

**Related tables** (job has many):

| Table | Relationship | Source |
|---|---|---|
| `job_contacts` → `contacts` | Contacts linked to job (sorted by `sort_index`) | DB |
| `appointments` → `appointment_attendees` | `appointments.job_id` | DB |
| `quotes` | `quotes.job_id` | DB |
| `purchase_orders` | `purchase_orders.job_id` | DB |
| `invoices` | `invoices.job_id` (via PO) | DB |
| `tasks` | `tasks.job_id` | DB |
| `messages` | `messages.from_job_id` / `to_job_id` | DB |
| `reports` | `reports.job_id` | DB |
| `attachments` | `related_record_type='Job'` | DB |
| `vendors` | `jobs.vendor_id` | DB |
| `claims` | `jobs.claim_id` (parent claim summary) | DB |

### Source 3 — Current UI

**`apps/frontend/src/components/jobs/JobDetail.tsx`** today has:

- Simple header: `Briefcase` icon, title, single status badge, `View claim` link.
- **5 tabs:** Overview · Quotes · Purchase Orders · Messages · Reports.
- **Missing from current UI:**
  - Tasks, Invoices, Appointments, Attachments, Contacts, Parent-claim summary, Vendor panel.
  - No rendering of job-type-specific fields (TA, Specialist, Rectification, Audit).
  - Overview lacks KPI row, request/lodgement dates, make-safe/excess visualization, HTML-safe instructions rendering.
  - No "Update status" affordance for Vendor role (Phase 2).

---

## Gap Analysis

| Requirement (from PDF + DB) | Covered today? | Action |
|---|---|---|
| Identity: claim #, external ref, status, job type | Partial (title + status only) | Promote to professional header + KPI row |
| Risk address (full + geo) | Overview card — basic | Full address block, copy-to-clipboard |
| Vendor details (name, ext ref, phone, snapshot) | ❌ | New "Vendor" card on Overview |
| Request date, make-safe, collect excess, excess | Overview card — minimal | Rework into Details card with consistent `DefRow` |
| Job instructions (HTML) | Plain text | Render HTML via `dangerouslySetInnerHTML` (already done for Claim incident description) |
| Contacts (job_contacts) | ❌ | New "Parties" tab (contacts + assignees when applicable) |
| Appointments | Overview footer list | New dedicated "Appointments" tab with attendees |
| Tasks | ❌ | New "Tasks" tab |
| Invoices | ❌ | New "Invoices" tab |
| Attachments | ❌ | New "Attachments" tab |
| Job-type-specific fields (TA / Specialist / Rectification / Audit) | ❌ | Conditional "Job Type Details" tab driven by `jobTypeLookup.name` / `externalReference` |
| Parent claim context | "View claim" link only | Breadcrumbs already show it; add a compact claim summary card on Overview |
| Status update (Vendor, Phase 2) | ❌ | Add disabled-with-tooltip placeholder; wire up when Phase 2 ships |
| Audit trail (createdAt/updatedAt) | ❌ | Add to Overview footer / Compliance-style Audit block |

---

## Information Architecture

### Header (always visible)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Job · <externalReference / id>        Lodged  Request  Excess  Jobs #   │
│ <Large title: externalReference>                                         │
│ [Status badge] [Job Type pill] [Vendor pill] [Address pill]              │
│ Parent claim: <link to /claims/:claimId>                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

- Title: `externalReference` → fallback to `id`.
- Status + job type always visible as chips.
- Vendor chip only when `vendorId` / `apiPayload.vendor` present.
- Right meta row: **Request date**, **Updated**, **Excess** (if set), **Make-safe required** (Yes/No pill).
- Parent-claim link: `claimId` → `/claims/{claimId}` with the claim's `claimNumber` when available from `apiPayload.claim`.

### Tabs (proposed — 8, with conditional 9th)

| # | Tab | Purpose | Data source |
|---|---|---|---|
| 1 | **Overview** | KPI row + Details / Address / Vendor / Instructions / Parent claim summary cards | Job row + `apiPayload` |
| 2 | **Type Details** *(conditional)* | Only rendered when job type is TA, Specialist, Rectification, or Audit. Uses `temporaryAccommodationDetails` / `specialistDetails` / `rectificationDetails` / `auditDetails` JSONB + `mobilityConsiderations`. | Job row |
| 3 | **Parties** | Contacts (via `/jobs/:id` payload `contacts[]` or `job_contacts`) with type, phones, email, preferred method, notes | Job `apiPayload.contacts` |
| 4 | **Appointments** | List + create, with attendees, cancellation details | `GET /jobs/:id/appointments` |
| 5 | **Quotes** | Existing tab, restyled to match claim tables | `GET /jobs/:id/quotes` |
| 6 | **Purchase Orders** | Existing tab, restyled to match | `GET /jobs/:id/purchase-orders` |
| 7 | **Invoices** | New — mirror of PO table with invoice totals, excess amount, status | `GET /jobs/:id/invoices` (Phase 2) |
| 8 | **Tasks** | New — tasks scoped to this job, status + priority + due date | `GET /jobs/:id/tasks` (Phase 2) |
| 9 | **Messages** | Existing, restyled; keep acknowledge action | `GET /jobs/:id/messages` |
| 10 | **Reports** | Existing, restyled | `GET /jobs/:id/reports` |
| 11 | **Attachments** | New — list files with download links (title, type, size, uploaded by) | `GET /attachments?relatedRecordType=Job&relatedRecordId=:id` *(may require new API route; see §Out of Scope)* |

**Tab ordering logic:** Static/property info first (Overview, Type Details, Parties), then schedule (Appointments), then commercial flow in execution order (Quotes → Purchase Orders → Invoices), then operational (Tasks, Messages, Reports, Attachments).

**Conditional tabs:**
- Show "Type Details" only when `jobType.name` matches one of: `Temporary Accommodation`, `Specialist`, `Rectification Assessment`, `Builder Rectification Work`, `Internal Audit`. For unknown types, omit.
- Hide any tab whose data endpoint returns 404 / not-yet-available (Phase 2 endpoints) — render a small "Not available yet" placeholder instead of failing.

---

## Component Breakdown

### New files

```
apps/frontend/src/components/jobs/
├── JobHeader.tsx                # Professional header (icon, title, chips, meta row, parent claim)
├── tabs/
│   ├── JobOverviewTab.tsx       # Rewritten — KPI + Details + Address + Vendor + Instructions + Claim summary
│   ├── JobTypeDetailsTab.tsx    # Conditional — dispatches to one of 4 sub-panels
│   ├── JobTypePanels/
│   │   ├── TemporaryAccommodationPanel.tsx
│   │   ├── SpecialistPanel.tsx
│   │   ├── RectificationPanel.tsx
│   │   └── InternalAuditPanel.tsx
│   ├── JobPartiesTab.tsx        # Contacts table
│   ├── JobAppointmentsTab.tsx   # Replaces Overview's inline appointments
│   ├── JobInvoicesTab.tsx       # NEW (Phase 2 ready; graceful fallback)
│   ├── JobTasksTab.tsx          # NEW (Phase 2 ready; graceful fallback)
│   └── JobAttachmentsTab.tsx    # NEW (stub if endpoint not yet exposed)
└── parts/
    ├── DefRow.tsx               # Hoisted from ClaimDetail for reuse
    ├── SectionCard.tsx          # Hoisted from ClaimDetail for reuse
    └── BoolPill.tsx             # Hoisted from ClaimDetail for reuse
```

> **Note on shared parts:** the `DefRow`, `SectionCard`, `BoolPill` helpers were inlined into `ClaimDetail.tsx` in the recent claim revamp. As part of step 3 below they should be extracted once so both `ClaimDetail` and `JobDetail` consume the same primitives, avoiding drift.

### Updated files

| File | Change |
|---|---|
| `apps/frontend/src/components/jobs/JobDetail.tsx` | Rewritten as thin shell: renders `JobHeader` + tabbed layout; removes inline data fetching |
| `apps/frontend/src/components/jobs/JobQuotesTab.tsx` | Restyle tables to match claim-style presentation; keep existing actions |
| `apps/frontend/src/components/jobs/JobPurchaseOrdersTab.tsx` | Same |
| `apps/frontend/src/components/jobs/JobMessagesTab.tsx` | Same; keep acknowledge action |
| `apps/frontend/src/components/jobs/JobReportsTab.tsx` | Same |
| `apps/frontend/src/app/(app)/jobs/[id]/page.tsx` | Fetch parent claim summary on SSR (optional) + pass to detail; add `getJobContacts`, `getJobInvoices`, `getJobTasks`, `getJobAttachments` primers when endpoints exist |
| `apps/frontend/src/app/(app)/jobs/[id]/actions.ts` | Add server actions for invoices, tasks, attachments, contacts |
| `apps/frontend/src/app/(app)/jobs/[id]/loading.tsx` | Match the new layout (header block + KPI grid + tabs) |
| `apps/frontend/src/lib/api-client.ts` | Add `getJobInvoices`, `getJobTasks`, `getJobAttachments` (behind Phase-2 graceful 404) |
| `apps/frontend/src/types/api.ts` | Extend `Job` with flags used in UI (`makeSafeRequired`, `collectExcess`, `excess`, `parentClaimId`, plus `vendorId`, `vendorSnapshot`, `temporaryAccommodationDetails`, `specialistDetails`, `rectificationDetails`, `auditDetails`, `mobilityConsiderations`) and add `Attachment` type |

---

## Implementation Steps

### 1. Extract shared detail primitives

- Create `apps/frontend/src/components/shared/detail/{DefRow,SectionCard,BoolPill}.tsx`.
- Refactor `ClaimDetail.tsx` to import them (remove local copies).
- Nothing else should import from the old inline versions.

### 2. `Job` type extensions

Update `apps/frontend/src/types/api.ts`:

```typescript
export interface Job {
  id: string;
  tenantId: string;
  claimId: string;
  parentClaimId?: string | null;
  vendorId?: string | null;
  externalReference?: string | null;
  jobTypeLookupId: string;
  statusLookupId?: string | null;
  requestDate?: string | null;
  collectExcess?: boolean | null;
  excess?: string | null;
  makeSafeRequired?: boolean | null;
  address?: AddressPayload | Record<string, unknown>;
  addressSuburb?: string | null;
  addressPostcode?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  jobInstructions?: string | null;

  vendorSnapshot?: Record<string, unknown>;
  temporaryAccommodationDetails?: Record<string, unknown>;
  specialistDetails?: Record<string, unknown>;
  rectificationDetails?: Record<string, unknown>;
  auditDetails?: Record<string, unknown>;
  mobilityConsiderations?: Array<{ name?: string; externalReference?: string }>;

  apiPayload?: Record<string, unknown>;
  customData?: Record<string, unknown>;

  createdAt?: string;
  updatedAt?: string;

  status?: LookupRef;
  jobType?: LookupRef;
  claim?: Claim;          // slim, §3.3.3 shape
  vendor?: VendorRef;
}

export interface VendorRef {
  id?: string;
  name?: string;
  externalReference?: string;
}
```

Also add `Attachment` type for the new Attachments tab.

### 3. Build `JobHeader`

- Mirror the claim-header layout introduced in the recent claim revamp.
- Right-side meta row: Request date, Updated, Excess, Make-safe required.
- Chips: Status, Job Type, Vendor, Address (all omitted if empty).
- Parent claim line: `claim-number (external ref)` linking to `/claims/:claimId`.

### 4. Rebuild Overview tab

Six cards:

1. **KPI row (4 cards):** Status · Job Type · Vendor · Request date
2. **Core Details** — `DefRow`s for external reference, claim number, parent claim, request date, make-safe, collect excess, excess.
3. **Vendor** — name, external reference, snapshot phone/after-hours (from `vendorSnapshot` / `apiPayload.vendor`).
4. **Risk Location** — full address + suburb/state/postcode/country + lat/lng (when present).
5. **Parent Claim Summary** — slim Claim subset: claim #, status, account, address. Link to `/claims/:id`.
6. **Instructions** — HTML-rendered `jobInstructions` (same `prose` block used in `ClaimDetail`).

### 5. Build conditional `JobTypeDetailsTab`

Dispatch by `jobType.name`:

| Job type | Panel | Fields rendered |
|---|---|---|
| Temporary Accommodation | `TemporaryAccommodationPanel` | `emergency`, `habitableProperty`, `estimatedStayStartDate`, `estimatedStayEndDate`, `numberOfAdults`, `numberOfChildren`, `numberOfBedrooms`, `numberOfCots`, `numberOfVehicles`, `petsInformation`, `accommodationBenefitLimit`, `maximumAccommodationDurationLimit`, `mobilityConsiderations[]` as chips |
| Specialist | `SpecialistPanel` | `specialistCategory`, `specialistReport`, `isSpecificSpecialistRequired`, `specialistBusinessName` (when `isSpecificSpecialistRequired===true`), `locationOfDamage`, `typeOfDamage` |
| Rectification Assessment / Builder Rectification Work | `RectificationPanel` | `originalJobReference`, `originalJobType.name` (with link to original job when resolvable via external reference), `paidJob` |
| Internal Audit | `InternalAuditPanel` | `auditType` |

Rule: omit the tab entirely when `jobType.name` is outside this set, to avoid an empty tab.

### 6. Build `JobPartiesTab`

- Table of contacts pulled from `apiPayload.contacts` (authoritative shape per PDF) with columns: Name, Type, Email (mailto), Phones (M/H/W icons), Preferred method, Notes.
- Mirrors the claim's Parties tab styling for consistency.

### 7. Rebuild `JobAppointmentsTab`

- Keep existing `AppointmentFormDrawer` "Create Appointment" action.
- Table with columns: Name, Type, Location (`ONSITE`/`DIGITAL`), Start, End, Status, Attendees count.
- Expanded row per appointment showing attendees (`CONTACT` vs `USER` with badge).
- Cancel appointment action (Phase 5) — disabled with tooltip until endpoint is confirmed.

### 8. Add `JobInvoicesTab`, `JobTasksTab`, `JobAttachmentsTab`

- Each calls a new server action (`fetchJobInvoicesAction` / `fetchJobTasksAction` / `fetchJobAttachmentsAction`).
- Each action swallows `404` / `NotImplemented` from the API and resolves to `[]` with a `phaseUnavailable: true` flag so the tab can show a muted *"Available in Phase 2"* placeholder rather than a scary error.
- Columns:
  - **Invoices:** Invoice #, Issue date, Status, Sub-total, Tax, Total, Excess, Actions
  - **Tasks:** Name, Type, Priority, Status, Due date, Assignee
  - **Attachments:** Title, Document type, Filename, Size, Uploaded, Download (opens `fileUrl` in new tab)

### 9. Restyle existing tabs

Quotes / POs / Messages / Reports — convert to the same `Card` + table layout used in the claim Jobs tab so the Job detail page is visually consistent across all tabs.

### 10. Update `page.tsx` + actions

- On SSR: prefetch `getJob(id)` and (best-effort) `getClaim(job.claimId)` for the parent-claim summary.
- Thread the slim claim through as a prop to avoid an extra client fetch.
- Add new actions in `actions.ts`: `fetchJobInvoicesAction`, `fetchJobTasksAction`, `fetchJobAttachmentsAction`, `fetchJobContactsAction` (only if contacts must come from a dedicated endpoint; otherwise pass via SSR from `apiPayload.contacts`).

### 11. Loading skeleton

Mirror the new header layout + KPI row + two-column card grid in `apps/frontend/src/app/(app)/jobs/[id]/loading.tsx` (following the pattern set by the claim detail skeleton update).

---

## Technical Considerations

- **HTML rendering:** `jobInstructions` allows HTML per PDF. Reuse the `prose prose-sm` block already used for claim incident description. Do **not** sanitize client-side beyond what the API already returns — document this as an assumption and consider DOMPurify in a future pass.
- **Job-type detection:** compare `jobType.name` (case-insensitive, trimmed) **and** `jobType.externalReference` to tolerate renamed lookups. Centralize detection in `apps/frontend/src/components/jobs/util/jobType.ts`.
- **`apiPayload` is the source of truth** for nested objects (`contacts[]`, `appointments[]`, `vendor`, `claim`, `mobilityConsiderations`) because webhooks persist the raw Crunchwork JSON verbatim. DB columns like `jobs.address` are promoted for querying only.
- **Vendor tenancy conditional data:** `collectExcess`, `excess`, `makeSafeRequired`, `vendor.*` are *"Just Available on Vendor Tenancy"* per the PDF. Hide the whole Vendor card and render `—` for excess / make-safe when the values are `null` so the page stays clean for Insurer tenants.
- **Parent-claim summary:** fetch is best-effort; if it fails or the `GET /claims/{id}` endpoint is not yet available (Phase 3), fall back to a plain link to `/claims/:id`. Wrap in try/catch server-side, same pattern already used on the current job page.
- **Phase-gated tabs:** implement a small `<PhaseUnavailable phase="Phase 2" />` component that renders when an action returns `phaseUnavailable: true`. This keeps the UI honest about integration progress and avoids blank tabs.
- **Number/currency formatting:** reuse `formatCurrency` introduced in `ClaimDetail.tsx` (should also be lifted into `shared/detail/format.ts`).
- **Tab deep-linking:** switch the `Tabs` root to controlled mode driven by `?tab=` search param so e.g. `/jobs/:id?tab=invoices` links deep. Already how `Claim` detail could evolve — keep the pattern consistent.

---

## Acceptance Criteria

- [ ] Job detail page uses the new `JobHeader` with title, status + job-type + vendor + address chips, right-side meta row, and parent-claim link.
- [ ] Overview tab renders all core fields (request date, make-safe, collect excess, excess, job instructions HTML, vendor block, full address, parent claim summary).
- [ ] A **Type Details** tab appears only for TA / Specialist / Rectification / Internal Audit jobs and renders the correct panel with all fields from PDF §3.3.2.
- [ ] **Parties** tab lists contacts sourced from `apiPayload.contacts[]` with phones/email/preferred method/notes.
- [ ] **Appointments** tab shows all appointments with attendees (CONTACT vs USER), location (ONSITE/DIGITAL), and start/end times.
- [ ] **Quotes**, **Purchase Orders**, **Messages**, **Reports** tabs remain functional, restyled to match the new table aesthetic.
- [ ] **Invoices**, **Tasks**, **Attachments** tabs exist and gracefully show *"Available in Phase 2"* when endpoints return 404.
- [ ] Loading skeleton mirrors the live layout (header block + KPI row + tabs + two-column cards).
- [ ] Tab selection is deep-linkable via `?tab=` query param.
- [ ] `DefRow` / `SectionCard` / `BoolPill` / `formatCurrency` are shared primitives under `components/shared/detail/*` and used by both `ClaimDetail` and `JobDetail`.
- [ ] No new linter errors; `pnpm --filter frontend exec tsc --noEmit` is clean.
- [ ] `Job` type in `types/api.ts` reflects the DB columns used by the UI.

---

## Out of Scope

- Backend changes (API/DB/webhook). Any missing Phase 2 endpoint (`/jobs/:id/invoices`, `/jobs/:id/tasks`, `/jobs/:id/attachments`) will be added in its own plan. This plan assumes graceful fallback.
- Edit/update flows for job fields (separate "Job forms" plan).
- Vendor-only `POST /jobs/:id/status` quick-change UI — tracked alongside Phase 2 enablement.
- Sanitization of HTML job instructions (future security hardening).
- Deep-linked sub-tabs inside **Type Details** when both Specialist + TA attributes co-exist (not allowed by the API today).
- Adding a dedicated `GET /attachments?relatedRecordType=Job&relatedRecordId=:id` API route, which may be needed for the Attachments tab — to be scoped separately if not already available.

---

## File Manifest (expected diff)

```
apps/frontend/src/components/shared/detail/DefRow.tsx            (new)
apps/frontend/src/components/shared/detail/SectionCard.tsx       (new)
apps/frontend/src/components/shared/detail/BoolPill.tsx          (new)
apps/frontend/src/components/shared/detail/format.ts             (new)

apps/frontend/src/components/jobs/JobDetail.tsx                  (rewrite)
apps/frontend/src/components/jobs/JobHeader.tsx                  (new)
apps/frontend/src/components/jobs/util/jobType.ts                (new)
apps/frontend/src/components/jobs/tabs/JobOverviewTab.tsx        (rewrite)
apps/frontend/src/components/jobs/tabs/JobTypeDetailsTab.tsx     (new)
apps/frontend/src/components/jobs/tabs/JobTypePanels/*.tsx       (new, 4 files)
apps/frontend/src/components/jobs/tabs/JobPartiesTab.tsx         (new)
apps/frontend/src/components/jobs/tabs/JobAppointmentsTab.tsx    (new; replaces inline list)
apps/frontend/src/components/jobs/tabs/JobInvoicesTab.tsx        (new)
apps/frontend/src/components/jobs/tabs/JobTasksTab.tsx           (new)
apps/frontend/src/components/jobs/tabs/JobAttachmentsTab.tsx     (new)
apps/frontend/src/components/jobs/JobQuotesTab.tsx               (restyle)
apps/frontend/src/components/jobs/JobPurchaseOrdersTab.tsx       (restyle)
apps/frontend/src/components/jobs/JobMessagesTab.tsx             (restyle)
apps/frontend/src/components/jobs/JobReportsTab.tsx              (restyle)

apps/frontend/src/components/claims/ClaimDetail.tsx              (refactor to import shared primitives)

apps/frontend/src/app/(app)/jobs/[id]/page.tsx                   (prefetch parent claim; pass claim summary)
apps/frontend/src/app/(app)/jobs/[id]/actions.ts                 (add invoices/tasks/attachments actions)
apps/frontend/src/app/(app)/jobs/[id]/loading.tsx                (new layout skeleton)

apps/frontend/src/lib/api-client.ts                              (add getJobInvoices/Tasks/Attachments)
apps/frontend/src/types/api.ts                                   (extend Job, add Attachment, VendorRef)
```

---

## References

- `docs/Insurance REST API-v17-20260304_100318.pdf` — §3.3.2 Job (pp 27–35), §3.3.3 Job in Claim (pp 38), §3.2.2 Methods (pp 12–15)
- `apps/api/src/database/schema/index.ts` — `jobs`, `job_contacts`, `appointments`, `appointment_attendees`, `tasks`, `messages`, `reports`, `attachments`, `vendors`
- `docs/implementation/09_JOBS_MODULE.md` — backend module plan (this plan's frontend counterpart)
- `docs/implementation/25c_UI_03_CORE_PAGES.md` — initial jobs-list/detail scaffolding this plan supersedes for the detail page
- `apps/frontend/src/components/claims/ClaimDetail.tsx` — reference implementation pattern (professional header + tabbed groups) to mirror
