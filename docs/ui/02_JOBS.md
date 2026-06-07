# 02 — Jobs UI Specification

**Source:** Crunchwork Pulse vendor portal — staging-iag (observed 2026-06-07)
**Route:** `/pulse/vendor/jobs`
**CW API reference:** Insurance REST API v17 §3.3.2 (Job)

---

## 1. Jobs List Page

### 1.1 URL
`https://staging-iag.crunchwork.com/pulse/vendor/jobs`

### 1.2 Layout

**Left filter sidebar:**
| Element | Type |
|---------|------|
| "Search jobs" heading | — |
| Job Type | Dropdown |
| Reference | Text input |
| Search | Text input |
| Filter By: Reference | Filter option |
| Filter By: Account | Filter option |
| Filter By: Zone | Filter option |
| Filter By: User | Filter option |
| Filter By: Status | Filter option |
| By Role section | Section |
| CLEAR button | Resets all filters |

**Main content area:**
| Element | Position | Details |
|---------|----------|---------|
| "Search Results" heading | Top left | |
| "Total Item Count: 4846" | Top left | Total matching |
| ACTIONS dropdown | Top right | Bulk actions |
| Help icon (?) | Top right | |

### 1.3 Table Columns

| Column | Sortable | Description |
|--------|----------|-------------|
| Project Ref | ↕ Yes | Job reference number |
| Address | No | Site/property address |
| Created | ↕ Yes | Creation timestamp |
| Last Update | ↕ Yes | Last modification |
| Status | No | Badge — "Allocated" (yellow), "Awaiting Review" (yellow), "Completed" (green) |
| Actions | No | EDIT or VIEW buttons |

### 1.4 Status Badge Colours

| Status | Colour |
|--------|--------|
| Allocated | Yellow |
| Awaiting Review | Yellow |
| Completed | Green |
| In Progress | Blue (inferred) |
| Cancelled | Red (inferred) |

### 1.5 Pagination
- Bottom page numbers: 1, 2, 3, 4, ..., 203
- ~24 items per page (4846 / 203)

---

## 2. Job Detail Page

### 2.1 URL Pattern
`/pulse/vendor/jobs/{job-id}/details`

### 2.2 Header

```
┌──────────────────────────────────────────────────────────────────────────┐
│ {ORG NAME} | {Job Type} | {Job Reference} | {Address}                    │
│                                                                          │
│ [ACCOUNT ▼]  [ZONE ▼]  [Allocated - yellow badge]                       │
│ [TEAMS]  [CREATE]  [Save]                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

**Example:**
- Org: ENSURE CONSTRUCTIONS AND RESTORATION PTY LTD
- Job Type: Builder Make Safe
- Reference: MIL260121220-BMS2
- Address: 46 BLOOM AV, WANTIRNA SOUTH, VIC 3152, Australia
- Status: "Allocated" (yellow badge)

### 2.3 Right Sidebar

| Section | Content |
|---------|---------|
| DETAILS | Expandable details panel |
| Internal Team Member | "No one — assign yourself" + CHOOSE button |
| Address | Full address + interactive Google Map |

### 2.4 Tab Navigation

| # | Tab | Description |
|---|-----|-------------|
| 1 | **OVERVIEW** | Core job fields + instructions (default) |
| 2 | **ACTIVITIES** | Tasks and Appointments |
| 3 | **COMMUNICATIONS** | Emails |
| 4 | **ASSETS** | Related assets |
| 5 | **ATTACHMENTS** | File attachments |
| 6 | **TIMELINE** | Notes and audit trail |

**Note:** Jobs do NOT have a "JOBS" tab (unlike Projects). The tab order is slightly different from Projects.

---

## 3. OVERVIEW Tab

### 3.1 Basic Information (collapsible)

| Field | Type | Example |
|-------|------|---------|
| CAT Code | Readonly | Mike's Event |
| Loss Type | Readonly | Storm/ Flood/ Earthquake |
| Loss Sub Type | Readonly | Earthquake |
| Address | Readonly | 46 BLOOM AV, WANTIRNA SOUTH, VIC 3152, Australia |
| Date of Loss | Readonly date | 01/08/2025 02:00 am |
| Priority | Readonly | Low |
| Policy Name | Readonly | April Duck |

### 3.2 Overview & Contact Data (collapsible)

| Field | Type | Example |
|-------|------|---------|
| Vendor Job Number | Text input (editable) | |
| Make Safe required | Yes/No radio | Yes |
| Request Date | Readonly date | 07/06/2026 09:20 pm |
| Contact Date | Date picker (dd/mm/yyyy) | |
| Booked Date | Date picker | |
| Attendance Due Date | Date picker | |
| Attendance Date | Date picker | |
| Completed Date | Date picker | |
| Auto Approval Applies | Yes/No radio | |
| Claim Recommendation | Dropdown (readonly) | "Accept" |

### 3.3 Job Instructions (collapsible)

- **Instructions label**
- **TinyMCE rich text editor** with full formatting toolbar
- Contains job-specific instructions in HTML

### 3.4 Contacts (collapsible)

- **ADD CONTACTS** button
- Contact Role dropdown (e.g., "Insured")
- Table of associated contacts

---

## 4. ACTIVITIES Tab (Tasks + Appointments)

### 4.1 Tasks Section

Identical structure to Project Activities tab:

| Element | Description |
|---------|-------------|
| CREATE TASK button | Dark teal, top right |

**Filters (horizontal):**
| Filter | Type |
|--------|------|
| Priority | Dropdown |
| Type | Dropdown |
| Assigned To | Dropdown |
| Due Date | Date picker |
| RESET FILTERS | Link |

**Table columns:**
| Column | Description |
|--------|-------------|
| Priority | Badge (e.g., "Low" green) |
| Name | Task name with link |
| Project Ref | Parent project |
| Job Ref | This job reference |
| Tag | Tags |
| Assigned to | Assignee |
| Due Date | Date (orange when approaching) |
| Actions | EDIT + menu |

### 4.2 Appointments Section

| Element | Description |
|---------|-------------|
| CREATE APPOINTMENT button | Dark teal, top right |

**Table columns:**
| Column | Sortable |
|--------|----------|
| Start date & time | ↕ Yes |
| Duration | No |
| Title | ↕ Yes |
| Project Ref | No |
| Job Ref | No |
| Assignees/Contacts | No |
| Location | ↕ Yes |
| Address | ↕ Yes |
| Status | ↕ Yes |
| Actions | No |

---

## 5. COMMUNICATIONS Tab (Emails)

Same structure as Project Communications tab:

### 5.1 Email Correspondence
- **COMPACT VIEW** toggle
- **NEW EMAIL** button (dark teal)
- Filters: Subject, Sent from, Sent to, Date
- Table: Type icon, Subject, From, To, Date, Shared From, Attachments, Actions (VIEW)

### 5.2 Shared Email Correspondence
- Same structure for emails shared from project level

---

## 6. TIMELINE Tab (Notes + Audit)

Same structure as Project Timeline:
- **Search** field: "Search all items"
- **ADD NOTE** button (dark teal)
- **EXPORT** button (dark teal)
- Filters: filter set, hide system records toggle, date range, event type, record type, summary, description, user
- Table: Date, Type, Summary, Description, User, Actions

---

## 7. Create Job Flow

### 7.1 Trigger
- **CREATE** button in project detail header
- Or via project's JOBS tab

### 7.2 Job Types Available (IAG tenant)

| Job Type | Reference Pattern |
|----------|-------------------|
| Builder Assessment | {claim}-BA{n} |
| Builder Make Safe | {claim}-BMS{n} / BHS{n} |
| Builder - Scope of Works | {claim}-BOS{n} |
| Contents | {claim}-CON{n} |
| Temporary Accommodation | {claim}-TA{n} |
| Specialist | {claim}-SPE{n} |

### 7.3 Job Creation Fields (inferred from detail)

| Field | Required | Type |
|-------|----------|------|
| Job Type | Yes | Dropdown |
| Make Safe Required | No | Yes/No radio |
| Instructions | No | Rich text |
| Contact Date | No | Date picker |
| Vendor | No (auto-assigned) | — |

---

## 8. Key Observations

- Jobs share the same tab structure as Projects (minus the JOBS tab itself)
- The "Overview & Contact Data" section has vendor-editable date fields
- Job reference numbers follow a pattern: {claim-ref}-{type-code}{sequence}
- Status badges use consistent colour coding across the app
- "Call to Schedule" tasks are auto-created (System Generated) when jobs are created
- The vendor can edit: Vendor Job Number, contact/attendance/completion dates
- Most fields from the parent claim are readonly on the job
