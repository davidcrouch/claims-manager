# 03 — Quotes UI Specification

**Source:** Crunchwork Pulse vendor portal — staging-iag (observed 2026-06-07)
**Route:** Hamburger menu → Quotes
**CW API reference:** Insurance REST API v17 §3.3.6 (Quote, Group, Combo, Item)

---

## 1. Quotes List Page

### 1.1 URL
`https://staging-iag.crunchwork.com/pulse/vendor/quotes`

### 1.2 Layout

**Header actions (above list):**
| Element | Position | Style |
|---------|----------|-------|
| CREATE NEW QUOTE button | Top left | Large, blue/purple |
| CREATE QUOTE FROM CSV button | Top right | Secondary style |

**Left filter sidebar — "Search Quotes":**
| Filter | Type |
|--------|------|
| Title | Text input |
| Quote Number | Text input |
| Status | Dropdown |
| Total To | Currency input |
| Total From | Currency input |
| Quote Type | Dropdown |
| From Date | Date picker (dd/mm/yyyy) |
| To Date | Date picker (dd/mm/yyyy) |
| CLEAR link | Resets all |

**Main content area:**
| Element | Details |
|---------|---------|
| "All Items" heading | |
| "Total Items found: 1046" | Total matching |

### 1.3 Table Columns

| Column | Sortable | Description | Example |
|--------|----------|-------------|---------|
| Date | ↕ Yes | Quote creation/submission date | 03/06/2026 |
| Quote No | ↕ Yes | System-generated quote number | 260, 226, 515, 618 |
| Title | ↕ Yes | Quote title (job ref + sequence) | IAG1-BA1 - Quote - #356 |
| Total | ↕ Yes | Total amount | $0.60 – $39,600.00 |
| Status | No | Status badge | See below |
| Type | No | Quote type | "Quote" |
| Actions | No | VIEW button (eye icon) | |

### 1.4 Status Values and Colours

| Status | Badge Colour | Description |
|--------|-------------|-------------|
| Approved | Green | Insurer accepted |
| Published | Blue/teal | Submitted for review |
| Resubmission Required | Red | Insurer rejected, needs revision |
| Scope Of Work | — | Initial scope definition |
| Draft | — | Being composed (inferred) |
| Cash Settled | — | Settled without PO (inferred) |
| Cancelled | — | Voided (inferred) |

### 1.5 Title Format
Quote titles follow the pattern: `{Job-Ref} - Quote - #{sequence}`
- Example: `IAG1-BA1 - Quote - #356`
- Example: `NRP2304242637-BA1 - Quote - #1276`
- Example: `BAV2104256456-BOS2 - Quote - #387`

### 1.6 Pagination
Bottom of page, numbered pages.

---

## 2. Quote Detail Page

### 2.1 URL Pattern
`/pulse/vendor/quotes/{quote-id}` (inferred)

### 2.2 Expected Sections (based on consistent patterns)

The quote detail view likely contains:

| Section | Content |
|---------|---------|
| Header | Quote number, title, status badge, total |
| Summary | Status, type, total, date |
| Groups | Line item groups (rooms/areas) |
| Items | Individual line items within groups |
| Combos | Bundled items within groups |
| Parties | Quote To, Quote For, Quote From |
| Schedule | Estimated start/completion dates |
| Notes/Timeline | Associated notes |

---

## 3. Create Quote Flow

### 3.1 Triggers
- **CREATE NEW QUOTE** button on quotes list page
- **CREATE QUOTE FROM CSV** button for bulk import

### 3.2 Create New Quote

Based on the quote structure observed, creation likely involves:

#### Step 1: Quote Setup
| Field | Type | Required |
|-------|------|----------|
| Job selection | Dropdown/search | Yes |
| Quote Type | Dropdown (Quote, Variation) | Yes |
| Title | Auto-generated or manual | Yes |

#### Step 2: Line Items (Groups → Items)

The line item structure follows the CW API hierarchy:

```
Quote
 └── Groups[] (rooms/areas)
      ├── Items[] (direct line items)
      └── Combos[] (bundled products)
           └── Items[] (combo line items)
```

**Group fields:**
| Field | Type |
|-------|------|
| Group label | Dropdown (room/area names) |
| Description | Text |
| Length / Width / Height | Number (dimensions) |

**Item fields:**
| Field | Type |
|-------|------|
| Name | Text / catalog lookup |
| Description | Text |
| Category | Dropdown (trade category) |
| Sub-category | Dropdown |
| Quantity | Number |
| Unit Type | Dropdown (m², m, each, hour, day) |
| Unit Cost | Currency |
| Tax (%) | Number (default 10) |
| Markup Type | Dropdown (Percentage/Fixed) |
| Markup Value | Number |
| Scope Status | Dropdown (In Scope/Out of Scope) |
| Tags | Multi-select |
| Note | Text |
| Internal Only | Toggle |

### 3.3 Create Quote from CSV

Alternative flow for bulk import:
- Upload CSV file with line items
- Map columns to quote fields
- Review and submit

### 3.4 Quote Submission Flow
```
Create → Save Draft → Edit items → Publish (submit for approval)
```

---

## 4. Quote Status Flow

```
Draft → Published → Approved → (PO Generated)
                  → Resubmission Required → (Edit) → Published
                  → Cash Settled
                  → Cancelled
```

| From | To | Actor | Action |
|------|----|-------|--------|
| (new) | Draft | Vendor | Create quote |
| Draft | Published | Vendor | Submit for approval |
| Published | Approved | Insurer | Approve |
| Published | Resubmission Required | Insurer | Reject with feedback |
| Resubmission Required | Published | Vendor | Revise and resubmit |
| Published | Cash Settled | Insurer | Settle directly |
| Any | Cancelled | Insurer | Void |

---

## 5. Quote Type Definitions

| Type | Use Case |
|------|----------|
| Quote | Standard quote (initial or revision) |
| Scope Of Work | Initial scope definition before pricing |
| Variation | Change to an approved scope |

---

## 6. Key Observations

- Quotes are accessed via the hamburger menu (not the top navigation bar)
- Quote numbers are simple integers (260, 515, 618, etc.)
- Quote titles embed the job reference for easy identification
- There's a CSV import capability for bulk quote creation
- "Resubmission Required" is the rejection status (not just "Rejected")
- All quotes visible in the list have Type = "Quote" (Scope Of Work may be a separate status)
- Totals range widely ($0.60 to $39,600) suggesting both minimal and full scope quotes
