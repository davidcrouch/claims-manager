# 11 — Operations Pages

**Sidebar group:** OPERATIONS
**Pages:** Tasks, Schedule, Messages, Appointments, Contacts, Documents

---

## Tasks (`/tasks`)

**Accent:** Slate

Cross-entity standalone view aggregating all tasks across Jobs, Claims, Quotes, WOs, POs, etc.

### List Columns

| Column | Field | Sortable |
|--------|-------|----------|
| Priority | badge (Low/Med/High/Urgent) | Yes |
| Name | `name` (link to entity) | Yes |
| Type | `taskType.name` | No |
| Entity | linked entity type + ref | No |
| Assigned to | `assigneeName` | No |
| Due Date | `dueDate` (orange if approaching) | Yes |
| Status | `status.name` | No |
| Actions | Edit, Complete, menu | No |

**Filters:** Priority, Type, Assigned To, Due Date range, Status, Entity type
**Sort:** Due Date, Priority, Updated
**Header action:** CREATE TASK

### Create Task Form

| Field | Type | Required |
|-------|------|----------|
| Name | Text | Yes |
| Type | Dropdown (lookup) | Yes |
| Priority | Dropdown (Low/Med/High/Urgent) | Yes |
| Entity Type | Dropdown (Job, Claim, Quote, etc.) | No |
| Entity | Search/select | No |
| Assigned To | Dropdown (team members) | No |
| Due Date | Datetime picker | Yes |
| Description | Textarea | No |
| Tags | Tag input | No |

### Priority Colours

| Priority | Badge |
|----------|-------|
| Low | Green |
| Medium | Amber |
| High | Orange |
| Urgent | Red |

---

## Schedule (`/schedule`)

Calendar view combining appointments and task due dates.

### Views
- Month (default), Week, Day

### Event types
- Appointments (blue)
- Task due dates (amber)

### Interactions
- Click event → popover with details + link to entity
- Click date → quick-create appointment or task
- Navigation: prev/next month/week

---

## Messages (`/messages`)

**Accent:** Slate

Cross-entity message inbox.

### List Columns

| Column | Field |
|--------|-------|
| Subject | `subject` |
| From | sender |
| To | recipient |
| Job Ref | linked job |
| Date | `createdAt` |
| Status | Read/Unread |
| Attachments | count |
| Actions | VIEW, Acknowledge |

**Filters:** Date range, From, To, Read/Unread
**Header action:** NEW MESSAGE

### Send Message Form

| Field | Type | Required |
|-------|------|----------|
| Job | Select (context) | Yes |
| Subject | Text | Yes |
| Body | Rich text / textarea | Yes |
| Attachments | File upload | No |

---

## Appointments (`/appointments`)

**Accent:** Slate

Cross-entity appointment list.

### List Columns

| Column | Field | Sortable |
|--------|-------|----------|
| Start | `startDate` | Yes |
| Duration | computed | No |
| Title | `name` | Yes |
| Entity | linked entity ref | No |
| Location | On-site / Digital | Yes |
| Address | physical address | No |
| Attendees | count | No |
| Status | Scheduled/Completed/Cancelled | Yes |
| Actions | Edit, Cancel | No |

**Filters:** Date range, Location, Status
**Header action:** CREATE APPOINTMENT

### Create Appointment Form

| Field | Type | Required |
|-------|------|----------|
| Name / Title | Text | Yes |
| Job | Select (or entity context) | Yes |
| Location | Select (On-site / Digital) | Yes |
| Address | Text (auto from job if on-site) | Conditional |
| Start Date | Date picker | Yes |
| Start Time | Time picker | Yes |
| End Date | Date picker | Yes |
| End Time | Time picker | Yes |
| Attendees | Multi-select (contacts + users) | No |
| Description | Textarea | No |

---

## Contacts (`/contacts`)

Cross-entity contact list.

### List Columns

| Column | Field |
|--------|-------|
| Name | `firstName + lastName` |
| Role | `type.name` |
| Email | `email` |
| Phone | `mobilePhone` |
| Entity | linked entities |
| Actions | Edit |

**Search:** Name, email, phone
**Header action:** ADD CONTACT

---

## Documents (`/admin/documents`)

Document/template management.

### List Columns

| Column | Field |
|--------|-------|
| Name | filename |
| Type | document type |
| Entity | linked entity |
| Uploaded | date |
| Size | file size |
| Actions | Download, Delete |

**Header action:** UPLOAD DOCUMENT
