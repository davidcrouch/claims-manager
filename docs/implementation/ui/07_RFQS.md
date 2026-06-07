# 07 — RFQs (Requests for Quote)

**Route:** `/rfqs` (list), `/rfqs/[id]` (detail)
**Sidebar group:** VENDORS
**Accent:** Violet
**Chain context:** RFQs sent TO downstream sub-contractors. Generated from a subset of this tenant's Estimate/Quote line items. Appears as Work Order (scope) in downstream's CUSTOMERS group.

---

## List Page

**Header action:** CREATE RFQ button

**Columns:**

| Column | Field | Sortable |
|--------|-------|----------|
| RFQ # | `rfqNumber` | Yes |
| Status | `status.name` | No |
| Vendor (sub) | target vendor name | No |
| Job Ref | linked job | No |
| Total | estimated total | Yes |
| Sent | `sentDate` | Yes |
| Updated | `updatedAt` | Yes |

**Sort options:** Updated, Created, RFQ Number
**Search:** RFQ number, vendor name, job reference
**Filters:** Status (Draft, Sent, Responded, Expired, Cancelled)

---

## Detail Page

### Header
- Back → /rfqs
- FileQuestion icon (violet)
- Title: `rfqNumber`
- StatusBadge
- Vendor (sub-contractor) badge
- Links: View Job, View Source Quote

### Tabs

| Tab | ID |
|-----|----|
| Overview | `overview` |
| Scope Items | `scope-items` |
| Proposals | `proposals` |
| Activities | `activities` |
| Communications | `communications` |
| Timeline | `timeline` |

### Overview Tab

**Section: RFQ Details**

| Field | Source | Type |
|-------|--------|------|
| RFQ number | `rfqNumber` | Text |
| Status | `status.name` | Badge |
| Vendor (sub) | target vendor | Text + link |
| Job | job reference | Link |
| Source quote | parent quote ref | Link |
| Sent date | `sentDate` | Date |
| Response due | `responseDueDate` | Date |
| Note / Instructions | `note` | Text |

### Scope Items Tab

Line items selected from the parent quote, optionally with pricing stripped:

| Column | Description |
|--------|-------------|
| Item name | From quote line |
| Category | Trade category |
| Quantity | Required qty |
| Unit type | m², each, hour, etc. |
| Unit cost | Shown or hidden (config) |
| Scope status | In Scope / Out of Scope |

### Proposals Tab

List of proposals received from this vendor in response:

| Column | Field |
|--------|-------|
| Proposal # | number |
| Status | badge |
| Total | amount |
| Received | date |
| Actions | VIEW |

### Activities / Communications / Timeline
Standard pattern.

---

## Create RFQ Form

**Trigger:** From Job detail or standalone
**Drawer:** BottomFormDrawer

| Field | Type | Required |
|-------|------|----------|
| Job | Select | Yes |
| Source Quote | Select (from approved quotes) | Yes |
| Vendor (sub-contractor) | Select from vendor list | Yes |
| Response Due Date | Date picker | No |
| Note / Instructions | Textarea | No |
| Include pricing | Toggle (default: off) | No |
| Line items | Multi-select from quote items | Yes |

---

## Status Flow

```
Draft → Sent → Responded (proposal received)
            → Expired (no response by due date)
            → Cancelled
```
