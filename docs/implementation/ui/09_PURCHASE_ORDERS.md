# 09 — Purchase Orders (POs)

**Route:** `/purchase-orders` (list), `/purchase-orders/[id]` (detail)
**Sidebar group:** VENDORS
**Accent:** Orange
**Chain context:** POs sent TO downstream sub-contractors. Appears as "Work Order" in downstream tenant's CUSTOMERS group.

---

## List Page

**Header action:** CREATE PO button

**Columns:**

| Column | Field | Sortable |
|--------|-------|----------|
| PO # | `purchaseOrderNumber` | Yes |
| Status | `status.name` | No |
| Type | `purchaseOrderType.name` | No |
| Vendor (sub) | target vendor name | No |
| Job Ref | linked job | No |
| Total | `totalAmount` | Yes |
| Start | `startDate` | Yes |
| Updated | `updatedAt` | Yes |

**Sort options:** Updated, Created, PO Number, Total
**Search:** PO number, vendor name, job reference
**Filters:** Status, PO Type

---

## Detail Page

### Header
- Back → /purchase-orders
- ShoppingCart icon (orange)
- Title: `purchaseOrderNumber`
- StatusBadge, Type badge, Vendor badge
- Stats: Total, Start date, End date
- Links: View Job, View Claim, View Quote

### Tabs

| Tab | ID |
|-----|----|
| Overview | `overview` |
| Parties | `parties` |
| Line Items | `line-items` |
| Allocation | `allocation` |
| Bills | `bills` |
| Activities | `activities` |
| Communications | `communications` |
| Timeline | `timeline` |
| Attachments | `attachments` |
| Audit | `audit` |

### Overview Tab

**KPI Row (4 cards):** Status, Type, Total, Adjusted Total

**Section: Identifiers**

| Field | Source |
|-------|--------|
| PO number | `purchaseOrderNumber` |
| External ID | `externalId` |
| Name | `name` |
| Status | `status.name` |
| Type | `purchaseOrderType.name` |
| Vendor (sub) | `vendor.name` |

**Section: Linked Entities**

| Field | Value |
|-------|-------|
| Job | link |
| Claim | link |
| Vendor | link to `/vendors/{id}` |
| Source Quote | quote ref |

**Section: Service Window**

| Field | Source |
|-------|--------|
| Start date | `startDate` |
| End date | `endDate` |
| Start time | `startTime` |
| End time | `endTime` |
| Expires in | `expiresInDays` |

**Section: Financial**

| Field | Source |
|-------|--------|
| Total | `totalAmount` |
| Adjusted total | `adjustedTotal` |
| Adjustment amount | `adjustedTotalAdjustmentAmount` |

### Parties Tab (3 cards)

- **PO To** (vendor/recipient): name, contact, company reg, invoice number, phone, email, address
- **PO For** (insured/customer): same fields
- **PO From** (this tenant/issuer): same fields

### Line Items Tab
Group → Combo → Item hierarchy (same as quotes).

### Allocation Tab

| Field | Source |
|-------|--------|
| Vendor allocation job type ID | `allocationContext.vendorAllocationJobTypeId` |
| Vendor allocation report type ID | `allocationContext.vendorAllocationReportTypeId` |
| Quote revision ID | `allocationContext.quoteRevisionId` |
| Expires in (days) | `allocationContext.expiresInDays` |
| Adjusted total | `adjustmentInfo.adjustedTotal` |
| Adjustment amount | `adjustmentInfo.adjustedTotalAdjustmentAmount` |

### Bills Tab

Bills (invoices) received from the downstream vendor against this PO:

| Column | Field |
|--------|-------|
| Bill # | invoice number |
| Status | badge |
| Amount | total |
| Received | date |
| Actions | VIEW |

### Audit Tab

| Field | Source |
|-------|--------|
| Created | `createdAt` |
| Updated | `updatedAt` |
| Deleted | `deletedAt` |
| Created by | user |
| CW created | `apiPayload.createdAtDate` |
| CW updated | `apiPayload.updatedAtDate` |
| CW created by | `apiPayload.createdBy.name` |
| CW updated by | `apiPayload.updatedBy.name` |

### Activities / Communications / Timeline / Attachments
Standard pattern.

---

## Create PO Form

**Trigger:** From accepted Proposal, or standalone
**Drawer:** BottomFormDrawer

| Field | Type | Required |
|-------|------|----------|
| Job | Select | Yes |
| Source Quote/Proposal | Select | Yes |
| Vendor (sub-contractor) | Select | Yes |
| PO Type | Select (Standard, Variation) | Yes |
| Start Date | Date picker | Yes |
| End Date | Date picker | Yes |
| Start Time | Time picker | No |
| End Time | Time picker | No |
| Note | Textarea | No |

---

## Status Flow

```
Draft → Issued → Accepted → In Progress → Completed
              → Rejected
              → Expired
              → Cancelled
```
