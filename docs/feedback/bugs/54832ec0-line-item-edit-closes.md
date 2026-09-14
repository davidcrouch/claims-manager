# 54832ec0 / 46c673f5 — Line item description closes mid-type

| Field | Value |
|-------|-------|
| IDs | `54832ec0-d1a6-4aea-84d6-214d4076b6d5`, `46c673f5-c918-4aff-b6d4-a188d5bde4af` (**same bug**) |
| Type / priority / status | bug / medium / open |
| Reporter | Chris Wood |
| Created | 2026-09-14T01:18–01:22Z |
| Page | Estimates Detail `/quotes/f624eacd-4338-4859-9d50-d9bf9fe3a42c` |

## User report

When renaming / retyping a line item description, the text box closes after ~½ second while still typing.

## Root cause

Autosave debounce is **600 ms**. Typing dirties line items → timer fires → save reloads groups → `resetEdits()` clears `editState` → input exits edit mode.

Chain:

1. `ItemRow` / `ScopeCard` `handleInputChange` → dirty
2. `LineItemsProvider` → `onDirtyChange`
3. `QuoteDetail.handleLineItemsDirtyChange` → `lineItemsEditTick`
4. Effect + `AUTOSAVE_DEBOUNCE_MS` (600) → save
5. `QuoteLineItemsTabV2.handleSave` → `loadLineItems()` → `setResetEditsKey`
6. `use-line-item-edit.resetEdits()` → `setEditState(null)`

## Key files

- `apps/frontend/src/components/shared/detail-autosave.ts` — `AUTOSAVE_DEBOUNCE_MS = 600`
- `apps/frontend/src/components/quotes/QuoteDetail.tsx` — autosave effect
- `apps/frontend/src/components/line-items/QuoteLineItemsTabV2.tsx` — `handleSave`
- `apps/frontend/src/components/line-items/LineItemsProvider.tsx`
- `apps/frontend/src/components/line-items/hooks/use-line-item-edit.ts`

## Proposed solution

**Recommended:** Stop wiping edit mode on autosave; keep debounce as-is.

1. **Do not autosave while `editState !== null`** (or while a line-item input is focused).
2. After save, update `groups` **without** calling `resetEdits()` when still editing; only clear dirty keys / bump originals.

Do not “fix” only by lengthening debounce. Apply the same pattern on PO/invoice tabs if they share this autosave.

## Acceptance criteria

- [ ] Can type a long description without the box closing until blur / Enter / Esc / click away.
- [ ] Autosave still persists shortly after leaving the cell.
- [ ] Dirty/undo indicators remain correct.
- [ ] Check shared pattern on PO/invoice tabs if applicable.

## Repro

1. Open unlocked estimate Take Off for quote `f624eacd-…`.
2. Click a description; type with brief pauses.
3. After ~600 ms idle, input exits edit mode.
