# e85a8ca7 — Cannot reorder estimate line items

| Field | Value |
|-------|-------|
| ID | `e85a8ca7-94eb-4774-8c8c-043a48eb4d42` |
| Type / priority / status | bug / medium / open |
| Reporter | Chris Wood |
| Created | 2026-09-14T01:15:50Z |
| Page | Estimates Detail `/quotes/f624eacd-4338-4859-9d50-d9bf9fe3a42c` |
| Related | Autosave reload in `54832ec0` undoes optimistic order |

## User report

Cannot reorder estimate line items into proper chronological order.

## Root cause

**Primary:** Scope reorder never persists.

- Drag sends `scopes: [...]` (`use-line-item-drag.ts`).
- Optimistic UI applies via `applyReorderParams`.
- `reorderQuoteLineItemsAction` / API / `ReorderLineItemsDto` / `reorderQuoteLineItems` only accept **`items` + `combos`**.
- `scopes` dropped; empty/partial body still returns success.
- Reload (or autosave from `54832ec0`) snaps order back.

**Secondary:** `GroupCard` always renders **group items → assemblies → scopes**. Cross-type chronological interleaving is impossible by layout.

## Key files

- `apps/frontend/src/components/line-items/hooks/use-line-item-drag.ts`
- `apps/frontend/src/app/(app)/quotes/actions.ts` — `reorderQuoteLineItemsAction`
- `apps/frontend/src/lib/api-client.ts` — `reorderQuoteLineItems`
- `apps/api/src/modules/quotes/dto/quote-group.dto.ts` — `ReorderLineItemsDto`
- `apps/api/src/modules/catalog/services/catalog-selection.service.ts` — `reorderQuoteLineItems`
- `apps/frontend/src/components/line-items/GroupCard.tsx`
- Same gap likely on PO reorder action

## Proposed solution

**Recommended (v1):** Persist scope reorder by mapping dragged `scopes` → `combos` (or plumb `scopes` through action → API → `quote_combos.sort_index`). Verify item/assembly reorder still survives refresh. Apply the same fix to PO reorder if it drops scopes the same way.

**v2 (only if reporter needs mixed-type chronology):** Redesign Take Off as one ordered stream instead of fixed group→assembly→scope sections.

## Acceptance criteria

- [ ] Scope reorder survives refresh.
- [ ] Item/assembly reorder still works.
- [ ] Failed reorder shows toast and reloads; success stays stable.
- [ ] Clarify with reporter if mixed-type order is required.

## Repro

1. Unlocked estimate with ≥2 scopes.
2. Drag scopes → UI moves.
3. Refresh / wait for autosave reload → order reverts.
