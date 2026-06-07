# 06 — Entity Activities UI Specification

**Source:** Crunchwork Pulse vendor portal — staging-iag (observed 2026-06-07)
**Context:** Activity types associated with Projects, Jobs, Quotes, POs, and Invoices

---

## 1. Overview of Activity Types

Each entity (Project/Claim, Job, Quote, PO, Invoice) can have one or more associated activity types. These are distributed across three entity detail tabs:

| Tab | Activity Types |
|-----|---------------|
| **COMMUNICATIONS** | Emails |
| **ACTIVITIES** | Tasks, Appointments |
| **TIMELINE** | Notes (+ system-generated audit events) |

---

## 2. Notes (TIMELINE Tab)

### 2.1 Location
- Tab: **TIMELINE** on entity detail pages
- Button: **ADD NOTE** (dark teal)

### 2.2 Timeline Table

| Column | Sortable | Description |
|--------|----------|-------------|
| Date | ↕ Yes | Event/note timestamp |
| Type | No | Event type classification |
| Summary | No | Brief description |
| Description | No | Full text |
| User | ↕ Yes | Creator or "System Generated" |
| Actions | No | VIEW button (eye icon) |

### 2.3 Timeline Event Types

| Type | Source | Example |
|------|--------|---------|
| Note | Manual (ADD NOTE) | User-created note |
| Task created | System | "Call to Schedule #1 created on Builder-Make Safe..." |
| Job status set | System/User | "Builder-Make-Safe status set to ASSIGNED" |
| Job created | System/User | "Builder-Make-Safe - MIL260121220-BHS2 created" |
| Project status set | System | "Insurance Claim status set to Open" |
| Project created | System | "Insurance Claim - MIL260121220 created" |

### 2.4 Timeline Filters

| Filter | Type | Description |
|--------|------|-------------|
| Filter set | Dropdown | Preset filter collections (e.g., "Overview" with 20 event types) |
| Hide system generated | Toggle | Hides automated entries |
| Job selector | Dropdown | Filter by specific job |
| From date | Date picker | Start of date range |
| To date | Date picker | End of date range |
| Event type | Multi-select | Filter by type (e.g., "20 selected") |
| Record type | Multi-select | Filter by record (e.g., "2 selected") |
| Summary | Text | Text search in summary |
| Description | Text | Text search in description |
| User | Text | Filter by user name |

### 2.5 Add Note Form (expected)

| Field | Type | Required |
|-------|------|----------|
| Summary / Title | Text input | Yes |
| Description / Body | Rich text (TinyMCE) | Yes |
| Visibility | Dropdown (Internal/External) | No |

### 2.6 Export
- **EXPORT** button (dark teal) exports timeline data

---

## 3. Emails (COMMUNICATIONS Tab)

### 3.1 Location
- Tab: **COMMUNICATIONS** on entity detail pages
- Button: **NEW EMAIL** (dark teal)

### 3.2 Sections

The Communications tab has two sections:

#### 3.2.1 Email Correspondence (outbound/direct)
- **COMPACT VIEW** toggle switch
- **NEW EMAIL** button

#### 3.2.2 Shared Email Correspondence (from other contexts)
- **COMPACT VIEW** toggle switch
- Read-only (shared from project or job level)

### 3.3 Email Filters

| Filter | Type |
|--------|------|
| Subject | Text input |
| Sent from | Text input |
| Sent to | Text input |
| Date | Date picker (dd/mm/yyyy) |
| RESET FILTER | Link (top right) |

### 3.4 Email Table Columns

| Column | Description |
|--------|-------------|
| Type | Email icon indicator |
| Subject | Email subject line |
| From | Sender email address |
| To | Recipient email address |
| Date | Send date and time |
| Shared From | Source entity (for shared emails) |
| Attachments | File attachment indicators |
| Actions | VIEW button (eye icon) |

### 3.5 New Email Form (expected)

| Field | Type | Required |
|-------|------|----------|
| To | Email input / contact picker | Yes |
| CC | Email input | No |
| Subject | Text input | Yes |
| Body | Rich text editor (TinyMCE) | Yes |
| Attachments | File upload | No |
| Template | Dropdown (email templates) | No |

### 3.6 Email Subject Patterns

Observed format: `{Project-Ref} - {Job Type Description}...`
- Example: "MIL260121220 - Builder Make ..."
- Example: "MIL260121220 - Builder Scope..."
- Sender: `iagadmin@crunchwork.com` (system)
- Recipient: vendor email address

---

## 4. Tasks (ACTIVITIES Tab)

### 4.1 Location
- Tab: **ACTIVITIES** on entity detail pages
- Section: First section within the Activities tab
- Button: **CREATE TASK** (dark teal)

### 4.2 Task Filters (horizontal bar)

| Filter | Type | Options |
|--------|------|---------|
| Priority | Dropdown | Low, Medium, High, Urgent |
| Type | Dropdown | Task type categories |
| Assigned To | Dropdown | Team members |
| Due Date | Date picker | dd/mm/yyyy |
| RESET FILTERS | Link | |

### 4.3 Task Table Columns

| Column | Description | Example |
|--------|-------------|---------|
| Priority | Badge with colour | "Low" (green badge) |
| Name | Task name (clickable link icon) | "Call to Schedule #1" |
| Project Ref | Parent project reference | MIL260121220 |
| Job Ref | Parent job reference | MIL260121220-BHS2 |
| Tag | Task tags | |
| Assigned to | Person assigned | |
| Due Date | Due date (orange when approaching) | 08/06/2026 01:56 AM |
| Actions | EDIT (pencil) + overflow menu | |

### 4.4 Task Priority Colours

| Priority | Badge Colour |
|----------|-------------|
| Low | Green |
| Medium | Yellow/Amber |
| High | Orange |
| Urgent | Red |

### 4.5 Auto-Generated Tasks

The system auto-creates tasks when jobs are allocated:
- **"Call to Schedule #1"** — auto-created for each new job
- Creator shown as "System Generated"
- Linked to both the project and job

### 4.6 Create Task Form (expected)

| Field | Type | Required |
|-------|------|----------|
| Name | Text input | Yes |
| Type | Dropdown | Yes |
| Priority | Dropdown (Low/Medium/High/Urgent) | Yes |
| Assigned To | Dropdown (team members) | No |
| Due Date | Date/time picker | Yes |
| Description | Rich text / textarea | No |
| Tag | Tag input | No |
| Job | Select (or pre-filled from context) | No |

### 4.7 Task Actions (overflow menu)

| Action | Description |
|--------|-------------|
| Edit | Open task for editing |
| Complete | Mark task as done |
| Reassign | Change assignee |
| Delete | Remove task |

---

## 5. Appointments (ACTIVITIES Tab)

### 5.1 Location
- Tab: **ACTIVITIES** on entity detail pages
- Section: Second section within the Activities tab (below Tasks)
- Button: **CREATE APPOINTMENT** (dark teal)

### 5.2 Appointment Table Columns

| Column | Sortable | Description |
|--------|----------|-------------|
| Start date & time | ↕ Yes | Appointment start |
| Duration | No | Length of appointment |
| Title | ↕ Yes | Appointment name |
| Project Ref | No | Parent project |
| Job Ref | No | Parent job |
| Assignees/Contacts | No | Who's attending |
| Location | ↕ Yes | On-site / Digital |
| Address | ↕ Yes | Physical address |
| Status | ↕ Yes | Scheduled / Completed / Cancelled |
| Actions | No | Action buttons |

### 5.3 Create Appointment Form

| Field | Type | Required |
|-------|------|----------|
| Name / Title | Text input | Yes |
| Location | Dropdown (On-site / Digital) | Yes |
| Address | Text or auto-populated | Conditional (if On-site) |
| Start Date | Date picker | Yes |
| Start Time | Time picker | Yes |
| End Date | Date picker | Yes |
| End Time | Time picker | Yes |
| Attendees | Multi-select (contacts + users) | No |
| Description | Textarea | No |

### 5.4 Appointment Statuses

| Status | Description |
|--------|-------------|
| Scheduled | Future appointment |
| Completed | Attended |
| Cancelled | Cancelled (with reason) |

### 5.5 Location Types

| Value | Description |
|-------|-------------|
| ONSITE | Physical location (property address) |
| DIGITAL | Virtual meeting |

---

## 6. Calls (via Tasks)

### 6.1 Observation

There is **no dedicated "Call" entity** in Crunchwork. Phone calls are tracked as **Tasks** with a specific type:
- Task name pattern: "Call to Schedule #1"
- Auto-generated when jobs are created
- Managed within the Tasks section of the ACTIVITIES tab

### 6.2 Call-as-Task Fields

| Field | Value |
|-------|-------|
| Name | "Call to Schedule #1" (or custom) |
| Type | Call/Contact type |
| Priority | Low (default for auto-generated) |
| Due Date | Set based on job timeline |
| Assigned to | Vendor team member |

---

## 7. Activity Distribution by Entity

| Entity | Notes | Emails | Tasks | Appointments |
|--------|-------|--------|-------|-------------|
| Project/Claim | ✅ TIMELINE | ✅ COMMUNICATIONS | ✅ ACTIVITIES | ✅ ACTIVITIES |
| Job | ✅ TIMELINE | ✅ COMMUNICATIONS | ✅ ACTIVITIES | ✅ ACTIVITIES |
| Quote | ✅ (expected) | ✅ (expected) | ✅ (expected) | ✅ (expected) |
| Purchase Order | ✅ (expected) | ✅ (expected) | ✅ (expected) | ✅ (expected) |
| Invoice | ✅ (expected) | ✅ (expected) | ✅ (expected) | ✅ (expected) |

---

## 8. Key Observations

1. **No standalone "Call" entity** — calls are tracked as Tasks with a call-type classification
2. **Notes live in TIMELINE** — the Timeline tab serves dual purpose: user notes + system audit trail
3. **System-generated records** — many timeline entries are auto-created (job creation, status changes, task creation)
4. **Filter presets** — Timeline has predefined filter sets (e.g., "Overview" with 20 event types)
5. **Shared emails** — emails can be "shared" from project level down to job level (or vice versa)
6. **Auto-tasks** — "Call to Schedule" tasks are auto-created when jobs are allocated to vendors
7. **Consistent UI** — all activity types use the same teal action buttons and table patterns
8. **Due date urgency** — task due dates display in orange when approaching/overdue
