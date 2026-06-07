# 10 — Bills

**Route:** `/bills` (list), `/bills/[id]` (detail)
**Sidebar group:** VENDORS
**Accent:** Rose
**Chain context:** Bills received FROM downstream sub-contractors. A Bill is the downstream tenant's Invoice as seen by this tenant. Represents Accounts Payable.

---

## List Page

**Columns:**

| Column | Field | Sortable |
|--------|-------|----------|
| Bill # | invoice number from sub | Yes |
| Status | `status.name` | No |
| Vendor (sub) | source vendor | No |
| PO # | linked PO | No |
| Amount | `totalAmount` | Yes |
| Received | `receivedDate` | Yes |
| Due Date | `dueDate` | Yes |
| Updated | `updatedAt` | Yes |

**Sort options:** Updated, Received, Due Date, Amount
**Search:** Bill number, vendor name, PO number
**Filters:** Status (Received, Approved, Rejected, Paid, Overdue)

---

## Detail Page

### Header
- Back → /bills
- ReceiptText icon (rose)
- Title: bill number
- StatusBadge
- Vendor badge
- Links: View PO, View Job

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

**Section: Bill Details**

| Field | Source | Type |
|-------|--------|------|
| Bill number | vendor's invoice number | Text |
| Status | `status.name` | Badge |
| Vendor (from) | source vendor | Link |
| PO | linked PO | Link |
| Job | linked job | Link |
| Amount | `totalAmount` | Currency |
| Received date | `receivedDate` | Date |
| Due date | `dueDate` | Date |
| Note | `note` | Text |

### Line Items Tab
Items from the linked PO that this bill covers.

### Activities / Communications / Timeline / Attachments
Standard pattern.

---

## Actions

| Action | Condition | Result |
|--------|-----------|--------|
| Approve | Received | Status → Approved |
| Reject | Received | Status → Rejected |
| Mark Paid | Approved | Status → Paid |

---

## Notes

- Bills are **read-only** (created by downstream tenant submitting invoice)
- This tenant reviews and approves/rejects/pays
- Finance AP page shows bills from accounting perspective
