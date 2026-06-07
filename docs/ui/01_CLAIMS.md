# 01 — Claims (Projects) UI Specification

**Source:** Crunchwork Pulse vendor portal — staging-iag (observed 2026-06-07)
**Route:** `/pulse/vendor/projects`
**CW terminology:** "Projects" (maps to Claims in the CW API)

---

## 1. Projects List Page

### 1.1 URL
`https://staging-iag.crunchwork.com/pulse/vendor/projects?&sort.columnKey=updatedAt&sort.order=DESC`

### 1.2 Layout

**Left filter sidebar:**
| Element | Type |
|---------|------|
| "Search projects" heading | — |
| Project Type | Dropdown |
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
| "Total Item Count: 2946" | Top left, below heading | Total matching records |
| ACTIONS dropdown | Top right | Bulk actions |
| Help icon (?) | Top right | Context help |

### 1.3 Table Columns

| Column | Sortable | Description |
|--------|----------|-------------|
| Project Ref | ↕ Yes | Claim/project reference number |
| Address | No | Property/risk location address |
| Created | ↕ Yes | Creation timestamp |
| Last Update | ↕ Yes | Last modification timestamp |
| Job Indicator | No | Circular status icons — blue/filled circles showing job progress |
| Actions | No | EDIT button per row |

### 1.4 Pagination
- Page numbers at bottom: 1, 2, 3, 4, ..., 105
- Default page size appears to be ~28 items (2946 items / 105 pages)

### 1.5 Row Interaction
- Click EDIT → navigates to project detail
- Job indicator circles show visual summary of linked job statuses

---

## 2. Project Detail Page

### 2.1 URL Pattern
`/pulse/vendor/projects/{project-id}/details`

### 2.2 Header

```
┌──────────────────────────────────────────────────────────────────────────┐
│ {ORG NAME} | {Project Type} | {Reference} | {Address}                    │
│                                                                          │
│ [ACCOUNT ▼]  [ZONE ▼: "VIC Metro - Vic Metro South East"]               │
│ [Open - yellow badge]  [JUMP TO]  [TEAMS]  [CREATE]  [Save]             │
└──────────────────────────────────────────────────────────────────────────┘
```

**Header fields:**
| Element | Example |
|---------|---------|
| Organisation | ENSURE CONSTRUCTIONS AND RESTORATION PTY LTD |
| Project type | Insurance Claim |
| Reference | MIL260121220 |
| Address | 46 BLOOM AV, WANTIRNA SOUTH, VIC 3152, Australia |
| Account dropdown | Account selector |
| Zone dropdown | Geographic zone (e.g., "VIC Metro - Vic Metro South East") |
| Status badge | "Open" (yellow/gold) |
| JUMP TO button | Quick navigation |
| TEAMS button | Team management |
| CREATE button | Create sub-entities |
| Save button | Save changes |

### 2.3 Right Sidebar

| Section | Content |
|---------|---------|
| DETAILS | Expandable project details |
| Internal Team Member | "No one — assign yourself" + CHOOSE button |
| Address | Full address text + interactive Google Map (Leaflet) with Street/Satellite toggle |

### 2.4 Tab Navigation

| # | Tab | Description |
|---|-----|-------------|
| 1 | **OVERVIEW** | Core project/claim fields (default) |
| 2 | **JOBS** | Internal and linked jobs |
| 3 | **COMMUNICATIONS** | Emails (sent and shared) |
| 4 | **ACTIVITIES** | Tasks and Appointments |
| 5 | **ASSETS** | Related assets |
| 6 | **ATTACHMENTS** | File attachments |
| 7 | **TIMELINE** | Notes and audit trail |

---

## 3. OVERVIEW Tab

### 3.1 Basic Information (collapsible section)

| Field | Value Example |
|-------|---------------|
| CAT Code | Mike's Event |
| Loss Type | Storm/ Flood/ Earthquake |
| Loss Sub Type | Earthquake |
| Address | 46 BLOOM AV, WANTIRNA SOUTH, VIC 3152, Australia |

### 3.2 Incident Information (collapsible section)

| Field | Type | Example |
|-------|------|---------|
| Lodgement Date | Readonly date | 05/06/2026 10:41 am |
| Date of Loss | Readonly date | 01/08/2025 02:00 am |
| Claim Consultant | Text (empty) | |
| Property Assessor | Text (empty) | |
| Internal Auditor | Text (empty) | |
| Desktop Assessor | Text (empty) | |
| Technical Assessor | Text (empty) | |
| Vulnerable Customer | Yes/No radio | |
| Vulnerability Category | Text (empty) | |
| Total Loss | Yes/No radio | |
| Priority | Text | Low |
| Claim Decision | Text | Claim Accepted |
| Auto Approval Applies | Yes/No radio | |
| Contentious Claim | Yes/No radio | |
| Contentious Activity Flag | Yes/No radio | |
| Contentious Activity Details | Text (empty) | |
| Accommodation Benefit Limit | Number | 0 |
| Maximum Accommodation Duration Limit | Text | N/A |
| Broker reference number | Text (empty) | |
| Hazardous Waste | Yes/No radio | |
| Incident Description | Rich text editor (TinyMCE) | |

### 3.3 Policy Information (collapsible section)

| Field | Type | Example |
|-------|------|---------|
| Flood Coverage Flag | Text (empty) | |
| Policy Type | Text | Home |
| Policy Number | Text | 06L484071301 |
| Line of Business | Text | Personal Property |
| Policy Inception Date | Date (empty) | |
| Policy Name | Text | April Duck |
| ABN | Text (empty) | |
| Building Sum Insured | Currency | 44200 |
| Contents Sum Insured | Currency (empty) | |
| Excess | Currency | 700 |
| Collect Excess | Yes/No radio | |

### 3.4 Postal Address (collapsible section)

| Field | Type | Example |
|-------|------|---------|
| Same as Project Address | Checkbox | |
| Postal Address | Text | 51 BRENTWOOD DR, WANTIRNA, VIC, 3152, Australia |

### 3.5 Contacts (collapsible section)

- **ADD CONTACTS** button
- Table with "Contact Role" column (dropdown showing "Insured")

---

## 4. JOBS Tab

### 4.1 Internal Jobs (collapsible section)

**Table columns:**
| Column | Sortable | Description |
|--------|----------|-------------|
| Job Type | No | Radio icon + type name |
| Job Reference | No | e.g., MIL260121220-BHS2 |
| Assigned to | No | Assignee name |
| Last Updated | ↕ Yes | Timestamp |
| Status | No | Badge (e.g., "Allocated" yellow) |
| Actions | No | EDIT button |

### 4.2 Linked Jobs (collapsible section)

**Table columns:**
| Column | Sortable |
|--------|----------|
| Job Type | ↕ Yes |
| Job Reference | ↕ Yes |
| Vendor Name | No |
| Vendor Contact Number | No |
| Vendor Contact Email | No |
| Status | No |
| Actions | No |

---

## 5. COMMUNICATIONS Tab (Emails)

### 5.1 Email Correspondence

| Element | Description |
|---------|-------------|
| COMPACT VIEW toggle | Switch between normal and compact view |
| NEW EMAIL button | Dark teal, creates new email |

**Filters (collapsible):**
| Filter | Type |
|--------|------|
| Subject | Text |
| Sent from | Text |
| Sent to | Text |
| Date | Date picker (dd/mm/yyyy) |
| RESET FILTER link | Top right |

**Table columns:**
| Column | Description |
|--------|-------------|
| Type | Email icon |
| Subject | Email subject line |
| From | Sender address |
| To | Recipient address |
| Date | Send date/time |
| Shared From | Source (for shared emails) |
| Attachments | File indicators |
| Actions | VIEW button (eye icon) |

### 5.2 Shared Email Correspondence

Same structure as Email Correspondence but for emails shared from other contexts.

---

## 6. ACTIVITIES Tab (Tasks + Appointments)

### 6.1 Tasks Section

| Element | Description |
|---------|-------------|
| CREATE TASK button | Dark teal, top right |

**Filters (horizontal):**
| Filter | Type |
|--------|------|
| Priority | Dropdown |
| Type | Dropdown |
| Assigned To | Dropdown |
| Due Date | Date picker (dd/mm/yyyy) |
| RESET FILTERS | Link |

**Table columns:**
| Column | Example |
|--------|---------|
| Priority | Badge: "Low" (green) |
| Name | "Call to Schedule #1" (with link icon) |
| Project Ref | Project reference |
| Job Ref | Job reference |
| Tag | Tags |
| Assigned to | Assignee name |
| Due Date | Date in orange (08/06/2026 01:56 AM) |
| Actions | EDIT (pencil icon) + dropdown menu |

### 6.2 Appointments Section

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

## 7. TIMELINE Tab (Notes + Audit)

### 7.1 Controls

| Element | Description |
|---------|-------------|
| Search field | "Search all items" |
| ADD NOTE button | Dark teal — creates a new note |
| EXPORT button | Dark teal — exports timeline |

### 7.2 Filters (collapsible)

| Filter | Type | Example |
|--------|------|---------|
| Filter set | Dropdown | "Overview" (20 selected event types) |
| HIDE SYSTEM GENERATED RECORDS | Toggle | |
| Job selector | Dropdown | "Select a job to view its timeline" |
| From date | Date picker | dd/mm/yyyy |
| To date | Date picker | dd/mm/yyyy |
| Event type | Multi-select | "20 selected" |
| Record type | Multi-select | "2 selected" |
| Summary | Text | |
| Description | Text | |
| User | Text | |
| RESET FILTERS | Link | |

### 7.3 Table Columns

| Column | Sortable | Description |
|--------|----------|-------------|
| Date | ↕ Yes | Event timestamp |
| Type | No | Event type (e.g., "Task created", "Job status set", "Project created") |
| Summary | No | Brief description |
| Description | No | Detailed description |
| User | ↕ Yes | User or "System Generated" |
| Actions | No | VIEW button (eye icon) |

### 7.4 Example Timeline Entries

| Date | Type | Summary | User |
|------|------|---------|------|
| 07/06/2026 09:20 PM | Task created | Call to Schedule #1 created on Builder-Make Safe... | System Generated |
| 07/06/2026 09:20 PM | Job status set | Builder-Make-Safe status set to ASSIGNED | David Adams |
| 07/06/2026 09:20 PM | Job created | Builder-Make-Safe - MIL260121220-BHS2 created | David Adams |
| 05/06/2026 10:01 AM | Task created | Call to Schedule #1 created on Builder Assessment... | System Generated |
| 05/06/2026 10:01 AM | Job status set | Builder Assessment status set to ASSIGNED | System Generated |
| 05/06/2026 10:01 AM | Project status set | Insurance Claim status set to Open | System Generated |
| 03/06/2026 10:01 AM | Project created | Insurance Claim - MIL260121220 created | System Generated |

---

## 8. Key Observations

- CW labels claims as "Projects" in the vendor portal
- The vendor portal is largely read-only for project fields (incident info, policy info)
- Activity types are spread across three tabs: COMMUNICATIONS (email), ACTIVITIES (tasks + appointments), TIMELINE (notes + audit)
- Status badges use colour coding: yellow = allocated/open, green = completed/approved
- Rich text fields use TinyMCE editor
- Google Maps integration for property addresses
- Job indicators on the list view show visual progress circles
