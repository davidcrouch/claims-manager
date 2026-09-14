# 4988fefc — Cannot issue PO without catalogued line item

| Field | Value |
|-------|-------|
| ID | `4988fefc-5a54-428f-84e7-9950caa913ca` |
| Type / priority / status | bug / medium / open |
| Reporter | Robert Evenden |
| Created | 2026-09-10T03:08:31Z |
| Page | PO `/purchase-orders/48106168-0319-47e7-bd24-18ba31aedef4` · job `482b542a-…` |
| Cluster | `268f334f`, `c575ae01` |

## User report

“I can not issue test PO-200019 in test job 200600 without a catalogued line item?”

## Root cause

Not a hard `catalogItemId` check in `PoIssuesService`. Users cannot populate freeform lines:

- No blank/manual “add line” on PO Take Off — catalogue (or WO/proposal copy) is the path.
- Catalogue drag onto empty PO fails (`268f334f`).
- Send PO still available when unlocked; empty groups → PDF with no lines (`c575ae01`).
- Catalogue button may be hidden when PO has `sourceWorkOrderId` / `sourceProposalId`.

## Key files

- `apps/frontend/src/components/purchase-orders/PurchaseOrderDetail.tsx` — `showLineItemActions`
- `apps/frontend/src/components/purchase-orders/IssuePoDrawer.tsx`
- `apps/api/src/modules/po-issues/po-issues.service.ts`
- `PurchaseOrderLineItemsTab` — catalog drop only

## Proposed solution

**Recommended:** Unblock stocking lines first (implement `268f334f`), then harden issue.

1. Fix empty-table catalogue drop so users can add lines without a pre-existing group.
2. If sourced POs should accept extras, show Catalogue even when `poHasSourceLines`.
3. Block Send when zero line items with a clear message (do not issue blank PDFs silently).
4. Freeform (non-catalog) lines only if product confirms — default is catalogue-based.

## Acceptance criteria

- [ ] Clear path to add ≥1 line and issue.
- [ ] Empty PO cannot be issued silently with blank lines (or explicit warning — product call).
- [ ] Document whether freeform (non-catalog) lines are supported.

## Repro

1. Open PO `48106168-…` (or empty test PO).
2. Try add lines without catalogue / with empty groups.
3. Send PO → note errors vs empty PDF.
