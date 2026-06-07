# 04 — Work Orders

**Route:** `/work-orders` (list), `/work-orders/[id]` (detail)
**Sidebar group:** CUSTOMERS
**Accent:** Indigo
**Chain context:** A Work Order is a PO received FROM upstream. It represents committed scope of work delegated to this tenant.

---

## List Page

**Columns:**

| Column | Field | Sortable |
|--------|-------|----------|
| WO # | `purchaseOrderNumber` | Yes |
| Status | `status.name` | No |
| Type | `purchaseOrderType.name` | No |
| From (upstream) | source org name | No |
| Job Ref | linked job ref | No |
| Total | `totalAmount` | Yes |
| Start | `startDate` | Yes |
| Updated | `updatedAt` | Yes |

**Sort options:** Updated, Created, WO Number, Start Date
**Search:** WO number, job reference
**Filters:** Status (multi-select)

---

## Detail Page

### Header
- Back → /work-orders
- ClipboardCheck icon (indigo)
- Title: `purchaseOrderNumber`
- StatusBadge, Type badge, Source org badge
- Total / Start / End in header stats
- Links: View Job, View Claim

### Tabs

| Tab | ID |
|-----|----|
| Overview | `overview` |
| Parties | `parties` |
| Line Items | `line-items` |
| Activities | `activities` |
| Communications | `communications` |
| Timeline | `timeline` |
| Attachments | `attachments` |

### Overview Tab

**KPI Row (4 cards):** Status, Type, Total, Adjusted Total

**Section: Identifiers**

| Field | Source |
|-------|--------|
| WO / PO Number | `purchaseOrderNumber` |
| External ID | `externalId` |
| Name | `name` |
| Status | `status.name` |
| Type | `purchaseOrderType.name` |
| Vendor (this tenant) | `vendor.name` |

**Section: Linked Entities**

| Field | Value |
|-------|-------|
| Job | link to `/jobs/{jobId}` |
| Claim | link to `/claims/{claimId}` |
| Source Quote | quote reference |

**Section: Service Window**

| Field | Source |
|-------|--------|
| Start date | `startDate` |
| End date | `endDate` |
| Start time | `startTime` |
| End time | `endTime` |
| Expires in (days) | `expiresInDays` |

**Section: Financial**

| Field | Source |
|-------|--------|
| Total | `totalAmount` |
| Adjusted total | `adjustedTotal` |
| Adjustment amount | `adjustedTotalAdjustmentAmount` |

**Section: Note**
- `note` (pre-wrap text if present)

### Parties Tab

Three party cards:
- **WO To** (this tenant / vendor): name, contact, company reg, phone, email, address
- **WO For** (insured / customer): name, contact, phone, email, address
- **WO From** (issuing upstream): name, contact, phone, email, address

### Line Items Tab

Same group → combo → item hierarchy as Estimates/Quotes (see 03_ESTIMATES_QUOTES.md).

### Activities Tab
Tasks + Appointments (standard)

### Communications Tab
Emails (standard)

### Timeline Tab
Notes + audit (standard)

---

## Actions

| Action | Condition | Result |
|--------|-----------|--------|
| Accept | Status = Issued | Status → Accepted |
| Decline | Status = Issued | Status → Rejected |
| Start Work | Status = Accepted | Status → In Progress |
| Complete | Status = In Progress | Status → Completed |
| Create Invoice | Status = In Progress / Completed | Opens Invoice form |

---

## Notes

- Work Orders are **read-only** structurally (created by upstream)
- Vendor can update status (accept, progress, complete)
- Vendor can create Invoices against Work Orders
- Same underlying data as PO in the upstream tenant's view
