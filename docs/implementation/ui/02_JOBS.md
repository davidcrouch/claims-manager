# 02 — Jobs

**Route:** `/jobs` (list), `/jobs/[id]` (detail)
**Sidebar group:** CUSTOMERS
**Accent:** Emerald

---

## List Page

**Columns:**

| Column | Field | Sortable |
|--------|-------|----------|
| Job Ref | `externalReference` | Yes |
| Status | `status.name` | No |
| Type | `jobType.name` | No |
| Address | `address.streetNumber + streetName, suburb` | No |
| Requested | `requestDate` | Yes |
| Updated | `updatedAt` | Yes |

**Sort options:** Updated, Created, Job Ref
**Search:** Reference, suburb
**Filters:** Status (multi-select), Job Type (multi-select)

---

## Detail Page

### Header
- Back button → /jobs
- Briefcase icon (emerald)
- Title: `externalReference`
- StatusBadge
- Job type badge
- Vendor badge
- Links: View Claim, View parent job (if child)

### Tabs

| Tab | ID |
|-----|----|
| Overview | `overview` |
| Type Details | `type-details` (conditional) |
| Parties | `parties` |
| Quotes | `quotes` |
| Purchase Orders | `purchase-orders` |
| Invoices | `invoices` |
| Tasks | `tasks` |
| Appointments | `appointments` |
| Messages | `messages` |
| Reports | `reports` |
| Attachments | `attachments` |
| Timeline | `timeline` |

### Overview Tab

**KPI Row (4 cards):**
- Status
- Job Type
- Request Date
- Make Safe Required (Yes/No)

**Section: Job Details**

| Field | Source | Type |
|-------|--------|------|
| External reference | `externalReference` | Text |
| Job type | `jobType.name` | Lookup |
| Status | `status.name` | Badge |
| Request date | `requestDate` | Date |
| Make safe required | `makeSafeRequired` | BoolPill |
| Collect excess | `collectExcess` | BoolPill |
| Excess amount | `excess` | Currency |
| Vendor job number | editable | Text input |
| Contact date | editable | Date picker |
| Booked date | editable | Date picker |
| Attendance due date | editable | Date picker |
| Attendance date | editable | Date picker |
| Completed date | editable | Date picker |
| Auto approval applies | `autoApproval` | BoolPill |
| Claim recommendation | lookup | Text |

**Section: Instructions**

| Field | Source | Type |
|-------|--------|------|
| Job instructions | `jobInstructions` | HTML (rendered) |

**Section: Address**

| Field | Source |
|-------|--------|
| Unit number | `address.unitNumber` |
| Street number | `address.streetNumber` |
| Street name | `address.streetName` |
| Suburb | `address.suburb` |
| Postcode | `address.postcode` |
| State | `address.state` |
| Country | `address.country` |

**Section: Vendor**

| Field | Source |
|-------|--------|
| Vendor name | `vendor.name` |
| External reference | `vendor.externalReference` |
| Phone | `vendor.phoneNumber` |

**Section: Claim Context (compact)**

| Field | Source |
|-------|--------|
| Claim number | parent claim |
| CAT code | `claim.catCode` |
| Loss type | `claim.lossType` |
| Loss sub-type | `claim.lossSubType` |
| Date of loss | `claim.dateOfLoss` |
| Priority | `claim.priority` |
| Policy name | `claim.policyName` |

### Type Details Tab (conditional)

Shown when job type is TA, Specialist, Rectification, or Internal Audit.

**Temporary Accommodation:**
- Accommodation type, start/end dates, daily rate, occupants, mobility considerations

**Specialist:**
- Specialist type, scope

**Rectification:**
- Original job reference, reason

**Internal Audit:**
- Audit type, scope

### Parties Tab

Table of job contacts:

| Column | Field |
|--------|-------|
| Name | `firstName + lastName` |
| Role | `type.name` (e.g., Insured) |
| Email | `email` |
| Phone | `mobilePhone` |
| Sort | `sortIndex` |

### Activities Tab

**Tasks section** (CREATE TASK button):

| Column | Field |
|--------|-------|
| Priority | badge (Low/Med/High/Urgent) |
| Name | task name (link) |
| Type | `taskType.name` |
| Assigned to | assignee |
| Due date | date (orange if approaching) |
| Actions | Edit, Complete |

**Appointments section** (CREATE APPOINTMENT button):

| Column | Field |
|--------|-------|
| Start | datetime |
| Duration | computed |
| Title | name |
| Location | On-site / Digital |
| Attendees | count |
| Status | Scheduled/Completed/Cancelled |
| Actions | expand for attendees |

### Communications Tab

**Email Correspondence:**
- NEW EMAIL button
- Compact view toggle
- Filters: Subject, From, To, Date
- Table: Type, Subject, From, To, Date, Attachments, Actions (VIEW)

**Shared Email Correspondence:**
- Same structure, read-only shared emails

### Timeline Tab

- ADD NOTE button
- EXPORT button
- Filters: date range, event type, record type, user, hide system records
- Table: Date, Type, Summary, Description, User, Actions (VIEW)

### Quotes Tab
Table of quotes linked to this job. CREATE QUOTE button.

### Purchase Orders Tab
Table of POs linked to this job.

### Invoices Tab
Table of invoices (via POs on this job). SUBMIT INVOICE button.

### Messages Tab
Message list + SEND MESSAGE form (subject + body).

### Reports Tab
Report list. CREATE REPORT button.

### Attachments Tab
File list with download links. Upload zone.

---

## Create Job Form

**Trigger:** Header action or from Claim detail
**Drawer:** BottomFormDrawer

| Field | Type | Required |
|-------|------|----------|
| Claim | Select (from claims) | Yes |
| Job Type | Select (lookup) | Yes |
| Request Date | Date picker | No |
| Instructions | Rich text / textarea | No |
| Make Safe Required | Toggle | No |
| Collect Excess | Toggle | No |
| Excess Amount | Currency (conditional) | No |
| Vendor | Select | No |
