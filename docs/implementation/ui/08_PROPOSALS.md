# 08 — Proposals

**Route:** `/proposals` (list), `/proposals/[id]` (detail)
**Sidebar group:** VENDORS
**Accent:** Violet
**Chain context:** Proposals received FROM downstream sub-contractors. A Proposal is the downstream tenant's Estimate/Quote as seen by this tenant. May be in response to an RFQ.

---

## List Page

**Columns:**

| Column | Field | Sortable |
|--------|-------|----------|
| Proposal # | `proposalNumber` or quote number | Yes |
| Status | `status.name` | No |
| Vendor (sub) | source vendor name | No |
| RFQ # | linked RFQ (if any) | No |
| Total | `totalAmount` | Yes |
| Received | `receivedDate` | Yes |
| Updated | `updatedAt` | Yes |

**Sort options:** Updated, Received, Total
**Search:** Proposal number, vendor name
**Filters:** Status (Received, Under Review, Accepted, Rejected)

---

## Detail Page

### Header
- Back → /proposals
- FileInput icon (violet)
- Title: proposal number
- StatusBadge
- Vendor badge
- Links: View RFQ (if linked), View Job

### Tabs

| Tab | ID |
|-----|----|
| Overview | `overview` |
| Line Items | `line-items` |
| Activities | `activities` |
| Communications | `communications` |
| Timeline | `timeline` |

### Overview Tab

**Section: Proposal Details**

| Field | Source | Type |
|-------|--------|------|
| Proposal number | reference | Text |
| Status | `status.name` | Badge |
| Vendor (from) | source vendor | Text + link |
| RFQ | linked RFQ reference | Link |
| Job | job reference | Link |
| Total | `totalAmount` | Currency |
| Received date | `receivedDate` | Date |
| Estimated start | from quote schedule | Date |
| Estimated completion | from quote schedule | Date |

### Line Items Tab

Same group → combo → item structure as Estimates/Quotes, showing the sub-contractor's pricing.

### Activities / Communications / Timeline
Standard pattern.

---

## Actions

| Action | Condition | Result |
|--------|-----------|--------|
| Accept | Under Review | Creates PO to downstream vendor |
| Reject | Under Review | Status → Rejected, notifies vendor |
| Request Revision | Under Review | Status → Revision Requested |

---

## Notes

- Proposals are **read-only** (created by downstream tenant)
- This tenant reviews and accepts/rejects
- Accepting a Proposal triggers PO creation in VENDORS → POs
