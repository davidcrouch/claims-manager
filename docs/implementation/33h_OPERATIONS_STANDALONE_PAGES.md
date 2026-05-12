# 33h — Operations: Standalone Pages

## Objective

Implement the remaining Operations group pages as standalone cross-entity views: Schedule/Calendar, Messages + Attachments, Appointments/Meetings, and Contacts.

---

## Prerequisites

- Plan 33a (Sidebar Restructure) complete — stub routes exist
- Plan 33g (Tasks Polymorphic Expansion) complete — Tasks standalone page done
- Existing API modules: messages, appointments, contacts, attachments

---

## Steps

---

### 33h.1 Schedule / Calendar Page

**Route:** `/schedule`

The Schedule page provides a calendar view showing appointments and task due dates across all entities.

#### API

**New endpoint** on existing modules or a new lightweight `ScheduleController`:

| Method | Route | Description |
|---|---|---|
| `GET` | `/schedule` | Combined events for a date range |

Query params: `from` (ISO date), `to` (ISO date), `types` (comma-separated: `appointment`, `task`, `dueDate`)

Response shape:

```typescript
interface ScheduleEvent {
  id: string;
  type: 'appointment' | 'task_due';
  title: string;
  start: string;       // ISO datetime
  end?: string;        // ISO datetime (appointments only)
  entityType: string;  // 'Job', 'Claim', etc.
  entityId: string;
  status?: string;
  priority?: string;   // tasks only
  location?: string;   // appointments only
}
```

Implementation: query `appointments` table (by `start_date` range) + `tasks` table (by `due_date` range), merge and sort.

#### Frontend

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/schedule/page.tsx` | Server page — fetch current month events |
| `app/(app)/schedule/actions.ts` | Server actions for date range navigation |
| `components/schedule/SchedulePageClient.tsx` | Calendar layout |
| `components/schedule/CalendarView.tsx` | Month/week/day calendar component |
| `components/schedule/EventCard.tsx` | Event detail popover |

**Calendar component options:**
- **Option A:** Use `@fullcalendar/react` — full-featured, supports month/week/day views
- **Option B:** Custom calendar grid with shadcn styling — lighter weight, consistent design
- **Recommended: Option A** for initial build (rich interaction), with custom styling to match the app theme

**Features:**
- Month, week, day view toggles
- Color-coded events (appointments = blue, task due dates = amber)
- Click event → popover with details + link to entity
- Date navigation (prev/next month)
- Quick-create appointment or task from calendar click

---

### 33h.2 Messages Page

**Route:** `/messages`

A standalone cross-entity message view aggregating all messages across jobs and claims.

#### API Changes

The existing `messages` controller already has `GET /messages` (list). Verify it supports:
- Pagination
- Sort by `created_at`
- Filter by `acknowledged` status (acknowledged_at IS NULL or NOT NULL)
- Search by subject/body

If missing, extend the `MessagesService.findAll()` to accept these params.

Add new query capabilities:

| Method | Route | Description |
|---|---|---|
| `GET` | `/messages` | List all messages (existing, possibly needs enhancement) |
| `GET` | `/messages/unread` | Messages where `acknowledgement_required = true AND acknowledged_at IS NULL` |

#### Frontend

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/messages/page.tsx` | Server page |
| `app/(app)/messages/actions.ts` | Server actions |
| `components/messages/MessagesPageClient.tsx` | Client wrapper |
| `components/messages/MessagesListClient.tsx` | Message list with inbox-style layout |
| `components/messages/MessagePreview.tsx` | Inline message preview card |

**Layout:**

- **View tabs:** All, Unread, Requiring Acknowledgement
- **List:** Inbox-style — subject, sender context (from job/claim), date, acknowledgement badge
- **Preview panel:** Click a message to show full body in a side panel or expanded row
- **Actions:** Acknowledge (for messages requiring it), link to source job/claim
- **Attachments:** Show attachment counts and inline download links from the `attachments` table where `related_record_type = 'Message'` (if applicable) or attachments linked to the same job

---

### 33h.3 Appointments / Meetings Page

**Route:** `/appointments`

Cross-entity appointment list showing all appointments across all jobs.

#### API Changes

The existing `appointments` controller has `GET /appointments/job/:jobId` but may not have a top-level `GET /appointments` list. Add:

| Method | Route | Description |
|---|---|---|
| `GET` | `/appointments` | List all appointments (paginated, tenant-scoped) |

Support query params: `page`, `limit`, `sort`, `status`, `from` (date), `to` (date), `location` (ONSITE/DIGITAL).

#### Frontend

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/appointments/page.tsx` | Server page |
| `app/(app)/appointments/actions.ts` | Server actions |
| `components/appointments/AppointmentsPageClient.tsx` | Client wrapper |
| `components/appointments/AppointmentsListClient.tsx` | List with toolbar |
| `components/appointments/AppointmentFormDrawer.tsx` | Create/edit drawer |

**List columns:** Name, Job, Type, Location (ONSITE/DIGITAL badge), Start Date, End Date, Status, Attendees count

**Sort options:** `start_date`, `created_at`, `name`

**Filters:** Location type, status, date range

**Detail:** Click-through to a detail view or expandable row showing:
- Full appointment details
- Attendees list (contacts + users)
- Cancel action (existing API: `POST /appointments/:id/cancel`)
- Link to parent job

---

### 33h.4 Contacts Page

**Route:** `/contacts`

The Contacts module and API already exist (`GET /contacts`, `GET /contacts/:id`). This plan adds the frontend list and detail pages.

#### API Verification

Verify existing endpoints support:
- `GET /contacts` — paginated list with search (by name, email, phone)
- `GET /contacts/:id` — detail with linked claims and jobs

If the list endpoint doesn't support search or pagination, extend `ContactsService.findAll()`.

#### Frontend — List Page

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/contacts/page.tsx` | Server page |
| `app/(app)/contacts/actions.ts` | Server actions |
| `components/contacts/ContactsPageClient.tsx` | Client wrapper |
| `components/contacts/ContactsListClient.tsx` | List with search |

**List columns:** Full Name, Email, Mobile Phone, Type, Linked Jobs (count), Linked Claims (count)

**Sort options:** `last_name`, `email`, `updated_at`, `created_at`

**Search:** By name, email, or phone number

#### Frontend — Detail Page

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/contacts/[id]/page.tsx` | Server page |
| `components/contacts/ContactDetail.tsx` | Detail layout |

**Detail layout (single view, no tabs initially):**

- Contact info card: name, email, phones, type, preferred contact method, notes
- Linked Claims section: list of claims this contact appears on (via `claim_contacts`)
- Linked Jobs section: list of jobs this contact appears on (via `job_contacts`)
- Tasks section: tasks attached to this contact (via plan 33g polymorphic tasks)

---

## Verification

- [ ] `/schedule` shows calendar with appointments and task due dates
- [ ] Calendar supports month/week/day navigation
- [ ] `/messages` shows cross-entity message inbox with acknowledgement workflow
- [ ] `/appointments` lists all appointments with filters
- [ ] Appointment cancel action works from the list
- [ ] `/contacts` lists searchable contacts with linked entity counts
- [ ] `/contacts/[id]` shows full contact details with linked claims/jobs
- [ ] All pages follow the existing list/detail patterns (toolbar, sort tabs, etc.)

---

## File Summary

| Directory | Files |
|---|---|
| `app/(app)/schedule/` | `page.tsx`, `actions.ts` |
| `app/(app)/messages/` | `page.tsx`, `actions.ts` |
| `app/(app)/appointments/` | `page.tsx`, `actions.ts` |
| `app/(app)/contacts/` | `page.tsx`, `actions.ts` |
| `app/(app)/contacts/[id]/` | `page.tsx` |
| `components/schedule/` | `SchedulePageClient.tsx`, `CalendarView.tsx`, `EventCard.tsx` |
| `components/messages/` | `MessagesPageClient.tsx`, `MessagesListClient.tsx`, `MessagePreview.tsx` |
| `components/appointments/` | `AppointmentsPageClient.tsx`, `AppointmentsListClient.tsx`, `AppointmentFormDrawer.tsx` |
| `components/contacts/` | `ContactsPageClient.tsx`, `ContactsListClient.tsx`, `ContactDetail.tsx` |

---

*Next: 33i_ADMIN_PAGES.md*
