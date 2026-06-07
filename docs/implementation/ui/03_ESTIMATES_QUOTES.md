# 03 — Estimates/Quotes

**Route:** `/quotes` (list), `/quotes/[id]` (detail)
**Sidebar group:** CUSTOMERS
**Accent:** Amber
**Chain context:** Created by this tenant, sent upstream. Appears as "Proposal" in upstream's VENDORS group.

---

## List Page

**Header actions:** CREATE NEW QUOTE, CREATE FROM CSV

**Columns:**

| Column | Field | Sortable |
|--------|-------|----------|
| Date | `quoteDate` | Yes |
| Quote # | `quoteNumber` | Yes |
| Title | `name` | Yes |
| Total | `totalAmount` | Yes |
| Status | `status.name` | No |
| Type | `quoteType.name` | No |
| Actions | VIEW | No |

**Sort options:** Updated, Created, Quote Number, Total
**Search:** Quote number, name, job reference
**Filters:** Status (Draft, Published, Approved, Resubmission Required, Cancelled), Quote Type

---

## Detail Page

### Header
- Back → /quotes
- FileSpreadsheet icon (amber)
- Title: `quoteNumber` or `name`
- StatusBadge
- Type badge (if not "Quote")
- Links: View Job, View Claim

### Tabs

| Tab | ID |
|-----|----|
| Overview | `overview` |
| Line Items | `line-items` |
| Parties | `parties` |
| Activities | `activities` |
| Communications | `communications` |
| Timeline | `timeline` |
| Attachments | `attachments` |

### Overview Tab

**KPI Row (4 cards):**
- Status
- Quote Type
- Total (currency)
- Quote Date

**Section: Identifiers**

| Field | Source |
|-------|--------|
| Name | `name` |
| Quote number | `quoteNumber` |
| Reference | `reference` |
| CW ID | `externalReference` |
| Status type | `status.type` |
| Created | `createdAt` |
| Updated | `updatedAt` |

**Section: Financials**

| Field | Source |
|-------|--------|
| Sub total (ex. tax) | `subTotal` |
| Total tax | `totalTax` |
| Total (incl. tax) | `totalAmount` |
| Expires in | `expiresInDays` days |

**Section: Schedule**

| Field | Source |
|-------|--------|
| Estimated start | `estimatedStartDate` |
| Estimated completion | `estimatedCompletionDate` |
| Reason for variation | `reasonForVariation` |

**Section: Approval**

| Field | Source |
|-------|--------|
| Auto-approved | `isAutoApproved` (BoolPill) |
| Status name | `status.name` |
| Quote type | `quoteType.name` |
| Created by | `createdBy.name` |
| Updated by | `updatedBy.name` |

**Section: Note**
- `note` (if present, rendered as pre-wrap text)

### Line Items Tab

Hierarchy: Groups → Combos → Items

**Group card:**

| Field | Type |
|-------|------|
| Group label | Lookup name (room/area) |
| Description | Text |
| Dimensions (L × W × H) | Numbers |
| Sub-total / Tax / Total | Currency |

**Combo block (within group):**

| Field | Type |
|-------|------|
| Name | Text |
| Description | Text |
| Category / Sub-category | Text |
| Quantity | Number |
| Scope status | Lookup |
| Sub-total / Tax / Total | Currency |
| Allocated / Committed cost | Currency |

**Item row (within group or combo):**

| Field | Type |
|-------|------|
| Name | Text |
| Description | Text |
| Type | Text |
| Category / Sub-category | Text |
| Quantity | Number |
| Unit type | Lookup (m², m, each, hour) |
| Unit cost | Currency |
| Buy cost | Currency |
| Tax % | Number |
| Markup type | Percentage / Fixed |
| Markup value | Number |
| PCPS | Text |
| Scope status | Lookup |
| Tags | Array |
| Internal | Boolean badge |
| Note | Text |
| Catalog mismatches | Warning badges |
| Line total | Currency |

### Parties Tab

Three party cards (3-column grid):

**Quote To (recipient):**

| Field | Source |
|-------|--------|
| Name | `quoteTo.name` |
| Contact | `quoteTo.contactName` |
| Email | `quoteTo.email` |
| Phone | `quoteTo.phoneNumber` |
| Company reg # | `quoteTo.companyRegistrationNumber` |
| Client reference | `quoteTo.clientReference` |
| Address | Full address fields |

**Quote For (customer):** Same structure from `quoteFor`
**Quote From (vendor):** Same structure from `quoteFrom`

### Activities Tab
Tasks + Appointments (standard pattern, see 00_OVERVIEW §3.2)

### Communications Tab
Emails (standard pattern)

### Timeline Tab
Notes + audit (standard pattern)

---

## Create Quote Form

**Trigger:** From Job detail Quotes tab, or from Quotes list
**Drawer:** BottomFormDrawer

**Step 1 — Setup:**

| Field | Type | Required |
|-------|------|----------|
| Job | Pre-filled or select | Yes |
| Claim | Pre-filled from job | Yes |
| Quote Type | Select (Initial, Variation, Supplementary) | No |
| Name | Text | No |
| Note | Textarea | No |
| Estimated Start | Date picker | No |
| Estimated Completion | Date picker | No |

**Step 2 — Line Items (future, complex editor):**

Currently creates an empty quote via API; line items managed in CW.

---

## Status Flow

```
Draft → Published → Approved → (PO generated)
                  → Resubmission Required → Published
                  → Cash Settled
                  → Cancelled
```
