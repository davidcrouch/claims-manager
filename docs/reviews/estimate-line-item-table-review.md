# Estimate Take-Off Line Item Table — Architecture & UX Review

**Date:** 2026-08-23  
**Scope:** `apps/frontend/src/components/quotes/QuoteLineItemsTable.tsx` (4 614 lines), `QuoteLineItemsTab.tsx` (653 lines), supporting utilities, actions, and backend endpoints.  
**Reviewer context:** Code review of drag-and-drop behaviour, optimistic UI patterns, internal consistency, and overall architecture.

---

## 1. Executive Summary

The line-item table is the primary authoring surface for estimates. It handles groups → scopes → assemblies → items as a nested tree rendered inside collapsible `<table>` sections. The implementation is feature-rich but has accumulated inconsistencies in how operations interact with the server, particularly around drag-and-drop reordering, which is not optimistic despite being a natural candidate.

| Area | Verdict |
|------|---------|
| **Drag-and-drop (reorder same parent)** | Partially optimistic for one legacy path (`onReorderItems`), not optimistic for the primary `onReorderLineItems` path. UI blocks while backend settles. |
| **Drag-and-drop (move across parents)** | Not optimistic. Full round-trip + reload before UI reflects the change. |
| **Drag-and-drop (duplicate via Ctrl)** | Not optimistic. Backend call + full reload. |
| **Group reorder (up/down arrows)** | Not optimistic. Backend call + full reload. |
| **Catalog drop (adding items)** | Not optimistic. Backend call + toast + reload + `router.refresh()`. |
| **Inline-edit save** | Not optimistic. Blocks via `startTransition`, then reloads. |
| **Dimension update** | Optimistic local state update, then backend call. Sole example of correct pattern. |

**Key finding:** Only `handleUpdateGroupDimensions` follows an optimistic pattern. Every other mutating interaction follows a **pessimistic await-then-reload** cycle, which is acceptable for destructive operations (delete) but makes drag-and-drop feel sluggish.

---

## 2. Drag-and-Drop Implementation Details

### 2.1 Architecture

The system uses the **native HTML5 Drag and Drop API** (`draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`) rather than a library (e.g. dnd-kit, react-beautiful-dnd). State is held in `useRef` values:

```
dragRowKey, dragType, dragId, dragParentGroupId, dragParentComboId
```

**Pros:** Zero dependency overhead, full control over behaviour.  
**Cons:** Manual DOM manipulation for visual feedback (`row.style.borderTop`, `row.style.opacity`), no accessibility (keyboard reorder), and the HTML5 drag API has well-documented cross-browser quirks with touch devices.

### 2.2 Inconsistent Reorder Callbacks

The table exposes **two** reorder mechanisms to its parent, used for different scenarios:

| Callback | Purpose | Optimistic? | Who calls the API? |
|----------|---------|-------------|-------------------|
| `onReorderItems(groupId, fromIndex, toIndex)` | Legacy local-only reorder within a group | **Yes** — mutates `dbGroups` state in `QuoteLineItemsTab` but only sets `structurallyDirty` flag. Never calls backend. | Nobody — the reorder is lost unless the user later saves field edits. |
| `onReorderLineItems({ items, combos })` | Sends `sortIndex` array to `PATCH /quotes/:id/line-items/reorder` | **No** — awaits backend, then calls `loadLineItems()` | `QuoteLineItemsTab.handleReorderLineItems` |
| `onMoveLineItem(...)` | Sends move to `PATCH /quotes/:id/line-items/move` | **No** — awaits backend, then calls `loadLineItems()` | `QuoteLineItemsTab.handleMoveLineItem` |

The co-existence of `onReorderItems` and `onReorderLineItems` is confusing:

- `onReorderItems` only fires for **group-level items** when `sourceType === 'item' && !sourceComboId` (line 2765). It performs a local splice on `dbGroups` and marks `structurallyDirty` but **never persists** unless the user happens to edit a field and trigger a save. If they navigate away, the reorder is silently lost.
- `onReorderLineItems` fires for **all other** same-parent reorders (items within combos/scopes, combo-to-combo, scope-to-scope) and does persist via the API.

This means the same drag gesture has different persistence semantics depending on *where* the item lives in the hierarchy. That is a bug.

### 2.3 Flow for `handleReorderLineItems` (non-optimistic)

```
User drops item → handleRowDrop → calls onReorderLineItems
  → QuoteLineItemsTab.handleReorderLineItems
    → startTransition(async () => {
        result = await reorderQuoteLineItemsAction(...)  // network round-trip
        if (!result.success) { toast.error(...); return; }
        await loadLineItems();      // second network call
        router.refresh();           // third (ISR revalidation)
      })
```

Between the drop and the UI reflecting the new order, the user sees the **old** arrangement because the local `dbGroups` state is never updated optimistically. The `useTransition` `pending` flag could be used to show a loading indicator but currently isn't connected to the table's visual state.

### 2.4 Missing Optimistic Update for Reorder

The correct pattern (already demonstrated by `handleUpdateGroupDimensions` on line 262–293) is:

1. Immediately update local state with the expected result.
2. Fire the backend request.
3. On failure, revert local state and show error.
4. On success, optionally refresh from server for reconciliation.

For reorder within the same parent this is straightforward because the operation is a deterministic array splice. The table component already computes the new order (`reordered` array at line 2786) — it just discards it after building the `sortIndex` payload rather than applying it to local state first.

### 2.5 Group Reorder (Up/Down Arrows)

`handleMoveGroup` (line 464–488 in `QuoteLineItemsTab`) constructs the new `groupIds` order and immediately calls `reorderQuoteGroupsAction`. It does not apply the swap locally first, so the user sees the group stay in place until the server responds and `loadLineItems()` completes.

---

## 3. File Size and Component Structure

At **4 614 lines**, `QuoteLineItemsTable.tsx` is well beyond a maintainable single-file threshold. It contains:

- ~15 sub-components (`ItemRow`, `AssemblyBlock`, `ScopeBlock`, `GroupNoteHoverBar`, etc.)
- Financial computation (`computeItemMoney`)
- Drag-and-drop logic (~300 lines)
- Inline-edit state machine (~200 lines)
- Keyboard navigation (~120 lines)
- Client-side filtering & pagination (~100 lines)
- Column visibility toggles
- Bulk selection

None of these are split into separate modules. The rendering JSX itself (`QuoteLineItemsTable` return) spans ~1 000 lines with deeply nested ternaries.

**Recommendation:** Extract into focused modules:

| Module | Responsibility |
|--------|---------------|
| `line-item-drag.ts` | All drag state, `parseRowKeyType`, `canDropInTarget`, visual feedback helpers |
| `line-item-edit-state.ts` | Edit inputs, dirty tracking, navigation, keyboard handler |
| `line-item-computations.ts` | `computeItemMoney`, totals, `buildLineItemOriginals` |
| `ItemRow.tsx`, `AssemblyBlock.tsx`, `ScopeBlock.tsx` | Already exist as internal functions; promote to separate files |

---

## 4. Consistency Issues

### 4.1 Dual Row-Key Indexing

The component builds `itemRowIndex` (line 2997) for dirty tracking and `visibleRowIndex` (line 3514) for keyboard navigation. Both iterate the same nested structure with the same key logic but are separate memos. A shared `buildRowIndex(groups)` utility would eliminate this duplication.

### 4.2 Redundant `normalizeLineItemGroups` Application

`normalizeLineItemGroups` is called inside `QuoteLineItemsTable` (line 2505) on every render of `rawGroups`. The parent `QuoteLineItemsTab` already receives normalized groups from the server (the API endpoint performs scope/combo splitting). The function is defensive but allocates new arrays on every render for groups that are already normalized.

### 4.3 DOM Manipulation for Drag Feedback

Drag visual feedback uses imperative DOM manipulation:

```typescript
row.style.borderTop = '2px solid #2563eb';
row.style.opacity = '0.4';
```

Cleanup in `handleRowDragEnd` uses `document.querySelectorAll('tr[data-row-key]')` to reset styles globally. This is brittle — if a React re-render replaces the DOM node between `dragStart` and `dragEnd`, the cleanup misses it. A controlled approach (e.g. `dragOverRowKey` state that conditionally applies a class) would be more robust.

### 4.4 `onReorderItems` Never Persists

As noted in §2.2, `handleReorderItems` in `QuoteLineItemsTab` (line 490–503) splices `dbGroups` locally and sets `structurallyDirty = true`, but there is no mechanism that later translates this structural change into a backend call. The `handleSaveLineItems` function only persists **field edits** (items/combos with changed name, quantity, etc.) — it does not transmit sort order. So the local splice is a no-op that misleads the user into thinking the reorder was saved.

### 4.5 Triple Redundant Server Refresh

Many handlers follow the pattern:

```typescript
await loadLineItems();   // fetches fresh groups
router.refresh();        // triggers RSC revalidation
```

`loadLineItems()` already updates the page's state via `setDbGroups`. The subsequent `router.refresh()` causes Next.js to refetch server components, which then re-render with potentially the same data. For mutations that don't affect server-rendered portions of the page (e.g. reorder), the `router.refresh()` is unnecessary overhead.

---

## 5. Specific Recommendations

### 5.1 Make Drag-and-Drop Optimistic (Priority: High)

For **same-parent reorder** (`onReorderLineItems` path):

```typescript
// In QuoteLineItemsTab.handleReorderLineItems:
function handleReorderLineItems(params) {
  // 1. Apply optimistic state
  setDbGroups(prev => applyReorder(prev, params));
  
  // 2. Fire backend (no await before UI update)
  startTransition(async () => {
    const result = await reorderQuoteLineItemsAction({ quoteId: quote.id, ...params });
    if (!result.success) {
      toast.error(result.error ?? 'Failed to reorder');
      await loadLineItems(); // revert to server truth
    }
    // Skip loadLineItems on success — local state is already correct
  });
}
```

For **move across parents** (`onMoveLineItem`): same pattern but the local state transformation is more complex (remove from source, insert at target). Consider building a helper `applyMoveToGroups(groups, params)`.

### 5.2 Remove or Unify `onReorderItems`

Either:
- **Remove** `onReorderItems` entirely and always use `onReorderLineItems` (preferred — single code path, always persists).
- **Or** make `onReorderItems` call `onReorderLineItems` internally so it persists.

The current situation where group-level items use a non-persisting local splice while combo/scope items use a persisting API call is a correctness bug.

### 5.3 Group Reorder Should Be Optimistic

```typescript
function handleMoveGroup(groupId, direction) {
  const newOrder = /* compute new ID array */;
  
  // Optimistic: reorder groupSummaries + dbGroups locally
  setGroupSummaries(prev => reorderById(prev, newOrder));
  setDbGroups(prev => reorderById(prev, newOrder));
  
  startTransition(async () => {
    const result = await reorderQuoteGroupsAction({ quoteId: quote.id, groupIds: newOrder });
    if (!result.success) {
      toast.error(result.error ?? 'Failed to reorder groups');
      await loadLineItems(); // revert
    }
  });
}
```

### 5.4 Consider dnd-kit for Accessibility and Touch

The native HTML5 Drag API lacks:
- Keyboard-based reordering (a11y requirement for WAI-ARIA drag-and-drop)
- Touch device support (mobile/tablet)
- Smooth animations during drag

`@dnd-kit/core` + `@dnd-kit/sortable` would provide all three with a small bundle cost. This is a lower priority than the optimistic update fix but important for production polish.

### 5.5 Decompose `QuoteLineItemsTable.tsx`

A 4 600-line component is a maintenance hazard. Suggested extraction order:
1. Drag logic → `use-line-item-drag.ts` (custom hook)
2. Edit state → `use-line-item-edit.ts` (custom hook)
3. Sub-components → individual files
4. Financial computations → `line-item-money.ts`

---

## 6. Backend Observations

The backend `CatalogSelectionService.reorderQuoteLineItems` (line 576–610 of `catalog-selection.service.ts`) performs sequential `UPDATE` statements inside a transaction — one per item/combo. For large estimates (100+ items), this creates N sequential DB round-trips within the transaction.

**Recommendation:** Use a single `CASE WHEN` update or unnest + join pattern:

```sql
UPDATE quote_items SET sort_index = v.sort_index
FROM (VALUES ($1, $2), ($3, $4), ...) AS v(id, sort_index)
WHERE quote_items.id = v.id AND quote_items.tenant_id = $tenant;
```

This reduces the transaction to a single statement regardless of item count.

---

## 7. Summary of Bugs

| # | Severity | Description |
|---|----------|-------------|
| 1 | **High** | `onReorderItems` (group-level item drag) performs a local splice but never persists to the backend. The reorder is silently lost on page navigation. |
| 2 | **Medium** | Same-parent reorder via `onReorderLineItems` is non-optimistic — user sees stale order until server round-trip completes (~200-500ms). |
| 3 | **Medium** | Cross-parent move (`onMoveLineItem`) is non-optimistic. |
| 4 | **Low** | Group reorder (up/down arrows) is non-optimistic. |
| 5 | **Low** | Drag visual feedback uses imperative DOM mutation that can leak if React replaces nodes mid-drag. |
| 6 | **Low** | Redundant `router.refresh()` after operations that only affect client state. |

---

## 8. Proposed Fix Priority

1. **Fix bug #1** — Make `onReorderItems` actually persist (or remove it and route through `onReorderLineItems`).
2. **Make reorder optimistic** — Apply local state immediately, roll back on failure.
3. **Make group reorder optimistic** — Same pattern.
4. **Remove redundant `router.refresh()`** after reorder-only mutations.
5. **Decompose file** — Extract drag logic and sub-components.
6. **Batch backend updates** — Single SQL statement for sortIndex writes.
7. **Evaluate dnd-kit** — For accessibility and touch support.
