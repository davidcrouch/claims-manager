# 05 — Invoices

**Route:** `/invoices` (list), `/invoices/[id]` (detail)
**Sidebar group:** CUSTOMERS
**Accent:** Teal
**Chain context:** Invoices sent TO upstream (insurer/head contractor). Appears as "Bill" in upstream's VENDORS group.

---

## List Page

**Header action:** SUBMIT INVOICE button

**Columns:**

| Column | Field | Sortable |
|--------|-------|----------|
| Invoice # | `invoiceNumber` | Yes |
| Status | `status.name` | No |
| PO / WO # | linked PO number | No |
| Job Ref | via PO → Job | No |
| Amount | `totalAmount` | Yes |
| Issue Date | `issueDate` | Yes |
| Updated | `updatedAt` | Yes |

**Sort options:** Updated, Created, Invoice Number, Amount
**Search:** Invoice number, PO number, job reference
**Filters:** Status (Draft, Submitted, Approved, Rejected, Paid, Cancelled)

---

## Detail Page

### Header
- Back → /invoices
- Receipt icon (teal)
- Title: `invoiceNumber`
- StatusBadge
- Links: View Purchase Order, View Job

### Tabs

| Tab | ID |
|-----|----|
| Overview | `overview` |
| Line Items | `line-items` |
| Activities | `activities` |
| Communications | `communications` |
| Timeline | `timeline` |
| Attachments | `attachments` |

### Overview Tab

**KPI Row (4 cards):** Status, Total Amount, Issue Date, Due Date

**Section: Invoice Details**

| Field | Source | Type |
|-------|--------|------|
| Invoice number | `invoiceNumber` | Text |
| Status | `status.name` | Badge |
| Total amount | `totalAmount` | Currency |
| Issue date | `issueDate` | Date |
| Due date | `dueDate` | Date |
| Purchase order | link to PO/WO | Link |
| Note | `note` | Text |

**Section: Linked Entities**

| Field | Value |
|-------|-------|
| Purchase Order / Work Order | link |
| Job | link |
| Claim | link |

**Section: Audit**

| Field | Source |
|-------|--------|
| Created | `createdAt` |
| Updated | `updatedAt` |
| Created by | `createdByUserId` |

### Line Items Tab

Items from the linked PO:

| Column | Description |
|--------|-------------|
| Item name | From PO line |
| Quantity | Invoiced qty |
| Unit cost | Per-unit |
| Tax | Percentage |
| Total | Line total |

### Activities / Communications / Timeline / Attachments
Standard pattern (see 00_OVERVIEW §3.2)

---

## Create Invoice Form

**Trigger:** "Submit Invoice" from list header, or from Job Invoices tab, or from Work Order detail
**Drawer:** BottomFormDrawer

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Purchase Order / Work Order | Select dropdown | Yes | Shows PO number + job ref + amount |
| Invoice Number | Text input | No | Vendor's own reference (e.g. INV-001) |
| Total Amount | Currency | No | Auto-calculated from PO if blank |
| Issue Date | Date picker | No | Default: today |
| Due Date | Date picker | No | Based on payment terms |
| Note | Textarea | No | |

**PO dropdown shows:** PO number, job reference, PO total, PO status. Only valid-status POs shown.

---

## Status Flow

```
Draft → Submitted → Approved → Paid
                  → Rejected → Submitted (resubmit)
                  → Cancelled
```
