# 05 — Invoices UI Specification

**Source:** Crunchwork Pulse vendor portal — staging-iag (observed 2026-06-07)
**Route:** Hamburger menu → Invoices
**CW API reference:** Insurance REST API v17 §3.3.8 (Invoice)

---

## 1. Invoices List Page

### 1.1 URL
`https://staging-iag.crunchwork.com/pulse/vendor/invoices` (via hamburger menu)

### 1.2 Layout

Follows the same consistent pattern as Quotes and POs:

**Left filter sidebar — "Search Invoices":**
| Filter | Type |
|--------|------|
| Title/Name | Text input |
| Invoice Number | Text input |
| Status | Dropdown |
| Total To | Currency input |
| Total From | Currency input |
| From Date | Date picker (dd/mm/yyyy) |
| To Date | Date picker (dd/mm/yyyy) |
| CLEAR link | Resets all |

**Main content area:**
| Element | Details |
|---------|---------|
| Heading | "All Items" or "Search Results" |
| Total count | "Total Items found: N" |

### 1.3 Table Columns (expected based on consistent patterns)

| Column | Sortable | Description |
|--------|----------|-------------|
| Date | ↕ Yes | Invoice submission date |
| Invoice No | ↕ Yes | Invoice number |
| Title | ↕ Yes | Invoice title |
| Total | ↕ Yes | Invoice amount |
| Status | No | Status badge |
| Actions | No | VIEW button (eye icon) |

### 1.4 Status Values (expected)

| Status | Colour | Description |
|--------|--------|-------------|
| Draft | Grey | Being composed |
| Submitted | Blue | Sent for approval |
| Approved | Green | Insurer accepted |
| Rejected | Red | Insurer declined |
| Paid | Green | Payment received |
| Cancelled | Red | Voided |

---

## 2. Invoice Detail Page

### 2.1 URL Pattern
`/pulse/vendor/invoices/{invoice-id}` (inferred)

### 2.2 Expected Layout

**Header:**
- Organisation name | Invoice Number | Amount
- Status badge
- Action buttons

**Tabs (expected):**
| Tab | Content |
|-----|---------|
| OVERVIEW | Invoice details, linked PO, financial |
| ACTIVITIES | Tasks |
| COMMUNICATIONS | Emails |
| ATTACHMENTS | Supporting documents |
| TIMELINE | Notes and audit |

### 2.3 Overview Content (expected)

| Field | Description |
|-------|-------------|
| Invoice Number | Vendor's reference |
| Status | Current status |
| Total Amount | Invoiced amount |
| Issue Date | Date raised |
| Due Date | Payment due |
| Purchase Order | Link to parent PO |
| Job | Link to parent job |
| Note | Additional notes |

### 2.4 Line Items

Invoices reference PO line items:
| Column | Description |
|--------|-------------|
| Item Name | From PO/quote line |
| Quantity | Invoiced qty |
| Unit Cost | Per-unit cost |
| Total | Line total |

---

## 3. Create Invoice Flow

### 3.1 Trigger
- Likely from PO detail or via dedicated creation button
- May require PO to be in "Completed" or "In Progress" status

### 3.2 Form Fields (expected)

| Field | Type | Required |
|-------|------|----------|
| Purchase Order | Select from available POs | Yes |
| Invoice Number | Text (vendor's own ref) | Optional |
| Total Amount | Currency (auto from PO or manual) | Yes |
| Issue Date | Date picker (default: today) | Yes |
| Due Date | Date picker | Optional |
| Note | Textarea | No |
| Attachments | File upload | No |

### 3.3 Submission Behaviour
- Submit → Status becomes "Submitted"
- Insurer reviews → Approved or Rejected
- If rejected, vendor can revise and resubmit

---

## 4. Invoice Status Flow

```
Draft → Submitted → Approved → Paid
                  → Rejected → (Revised) → Submitted
                  → Cancelled
```

| From | To | Actor |
|------|----|-------|
| (new) | Draft | Vendor |
| Draft | Submitted | Vendor |
| Submitted | Approved | Insurer |
| Submitted | Rejected | Insurer |
| Rejected | Submitted | Vendor (resubmit) |
| Approved | Paid | Insurer/System |
| Any | Cancelled | Insurer |

---

## 5. Key Observations

- Invoices are accessed via the hamburger menu
- Invoice creation is the primary vendor financial action
- Invoices are linked to POs (which are linked to approved quotes)
- Partial invoicing is likely supported (multiple invoices per PO)
- PDF generation/download expected for approved invoices
- The vendor's invoice number is separate from the system-generated one
