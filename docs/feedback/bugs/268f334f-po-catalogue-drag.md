# 268f334f — Cannot drag catalogue items to PO line items

| Field | Value |
|-------|-------|
| ID | `268f334f-d43d-4a8d-beca-9418817caced` |
| Type / priority / status | bug / medium / open |
| Reporter | Robert Evenden |
| Created | 2026-09-09T00:46:03Z |
| Page | PO Detail `/purchase-orders/cdff2931-c5dc-4fc2-bf91-59d0c4ee583f` |
| Cluster | `4988fefc`, `c575ae01` |

## User report

Cannot drag catalogue items (e.g. plastering remove/replace) onto PO line items. Browser shows 🚫 over drop zone. Chrome.

## Root cause

HTML5 drop rules reject catalogue drops on the **table** target:

```ts
// catalog-drag.ts
case 'table':
  return false; // isValidCatalogDropTarget
```

Empty PO only shows the dashed table zone → `preventDefault` never runs → native 🚫. Group labels **can** drop on table; catalogue items need an existing group/scope/assembly. Quotes default empty state to Groups tab; PO does not.

## Key files

- `apps/frontend/src/components/catalog/catalog-drag.ts` — `isValidCatalogDropTarget`, `getCatalogDragOverDecision`
- `apps/frontend/src/components/line-items/hooks/use-catalog-drop.ts`
- `apps/frontend/src/components/line-items/LineItemsTable.tsx`
- `apps/frontend/src/components/line-items/PurchaseOrderLineItemsTab.tsx`
- `apps/api/.../catalog-selection.service.ts` — `ensureDefaultPurchaseOrderGroup`

## Proposed solution

**Recommended:** Allow catalogue drops on an empty PO table by auto-creating a default group.

1. On valid catalogue dragover of empty table: allow drop → `ensureDefaultPurchaseOrderGroup` → add item/assembly.
2. Add visual affordance for valid vs invalid targets (not only native 🚫).
3. Optional UX: PO empty state `defaultTab="groups"` with short copy as a fallback if auto-group is deferred.

## Acceptance criteria

- [ ] Drag catalogue item onto empty PO creates default group and adds the line.
- [ ] Valid drops onto existing groups/scopes/assemblies still work.
- [ ] Chrome shows allow cursor/highlight on allowed targets.

## Repro

1. PO with no groups (or only empty dashed area).
2. Catalogue → drag primitive/assembly onto empty area → 🚫.
3. Drop a group label first, then item onto group → should work.
