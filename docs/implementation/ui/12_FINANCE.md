# 12 — Finance Pages

**Sidebar group:** FINANCE
**Pages:** Accounts Receivable, Accounts Payable, Reports

---

## Accounts Receivable (`/finance/ar`)

**Accent:** Emerald
**Data source:** Invoices sent upstream (same data as /invoices, accounting view)

### List Columns

| Column | Field | Sortable |
|--------|-------|----------|
| Invoice # | `invoiceNumber` | Yes |
| Customer | upstream org name | No |
| Amount | `totalAmount` | Yes |
| Issue Date | `issueDate` | Yes |
| Due Date | `dueDate` | Yes |
| Status | Unpaid / Paid / Overdue | No |
| Age (days) | computed from issue date | Yes |
| Actions | VIEW | No |

**Filters:** Status (Unpaid, Paid, Overdue), Date range, Customer
**Summary stats:** Total outstanding, Total overdue, Average days to pay

---

## Accounts Payable (`/finance/ap`)

**Accent:** Rose
**Data source:** Bills received from downstream (same data as /bills, accounting view)

### List Columns

| Column | Field | Sortable |
|--------|-------|----------|
| Bill # | vendor's invoice number | Yes |
| Vendor | downstream vendor name | No |
| Amount | `totalAmount` | Yes |
| Received | `receivedDate` | Yes |
| Due Date | `dueDate` | Yes |
| Status | Unpaid / Paid / Overdue | No |
| Age (days) | computed | Yes |
| Actions | VIEW, Approve, Pay | No |

**Filters:** Status, Date range, Vendor
**Summary stats:** Total payable, Total overdue, Due this week

---

## Reports (`/reports`)

**Accent:** Slate

### List Columns

| Column | Field | Sortable |
|--------|-------|----------|
| Report # | reference | Yes |
| Type | Assessment / Completion | No |
| Job Ref | linked job | No |
| Status | badge | No |
| Created | `createdAt` | Yes |
| Actions | VIEW | No |

**Filters:** Type, Status, Date range
**Header action:** CREATE REPORT

### Report Detail

**Section: Report Information**

| Field | Source |
|-------|--------|
| Type | Assessment / Completion |
| Status | `status.name` |
| Job | link |
| Body | rich text / HTML content |
| Attachments | file list |
| Created | datetime |
| Created by | user |

### Create Report Form

| Field | Type | Required |
|-------|------|----------|
| Job | Select | Yes |
| Type | Select (Assessment, Completion) | Yes |
| Body | Rich text editor | Yes |
| Attachments | File upload | No |
