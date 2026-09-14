# ea18d6ad — Cannot accept work order from “Issued”

| Field | Value |
|-------|-------|
| ID | `ea18d6ad-6ebe-4958-8724-a67b32c2b915` |
| Type / priority / status | bug / medium / open |
| Reporter | Robert Evenden |
| Created | 2026-09-09T01:18:24Z |
| Page | WO Detail `/work-orders/4da0f797-0206-486e-824d-73138db6a1ef` · job `da8e03c5-…` |

## User report

WO in “Issued” status but Accept/Decline not visible. Sees Edit Scope / Assign Vendor / Close Work Order instead. Cannot change Issued → Accepted.

## Root cause

Triple mismatch:

1. Header Accept/Decline only if `status === 'Issued'` (`WorkOrderDetail.tsx` ~132).
2. Inbound CW PO **Issued → Open** (`mapPoStatusToWorkOrderStatus`); seeds often Draft/Active/Completed/Archived; workflow expects Received/Accepted/….
3. Dashboard accepts `Received|Issued|Draft` but detail UI does not.
4. `WorkOrdersService.update` may not resolve `{ status: { name } }` → `statusLookupId` (unlike proposals) — Accept could no-op even if shown.
5. “Edit Scope / Assign Vendor / Close” are **AI page hints** (`page-context.ts`), not real buttons — confuses users via Help.

## Key files

- `apps/frontend/src/components/work-orders/WorkOrderDetail.tsx`
- `apps/api/src/modules/domain/transformers/purchase-order.transformer.ts`
- `apps/api/src/modules/domain/workflows/definitions/work-order.workflows.ts`
- `apps/api/src/modules/work-orders/work-orders.service.ts` — `update`
- `apps/api/src/modules/ai-chat/page-context.ts` — work-order `detailHints`
- `apps/api/src/modules/dashboard/dashboard.utils.ts` — `WO_ACCEPT_STATUS_NAMES`

## Proposed solution

**Recommended:** Align UI accept gate with real WO statuses and dashboard rules.

1. Show Accept/Decline for `WO_ACCEPT_STATUS_NAMES` plus Open (and/or map inbound CW Issued → Received).
2. Seed/sync full WO lifecycle lookups.
3. Resolve status by name in `WorkOrdersService.update` (mirror proposals); prefer workflow `accept`.
4. Fix AI `detailHints` to Accept/Decline/Start Work (stop advertising non-existent Edit Scope / Assign Vendor as primary actions).

## Acceptance criteria

- [ ] Waiting WOs show Accept/Decline.
- [ ] Accept → Accepted; Decline → Declined/Rejected.
- [ ] Dashboard queue items open to actionable detail.
- [ ] AI hints match real actions.

## Repro

1. Open WO `4da0f797-…`; note actual `status.name` (likely Open/Active, not Issued).
2. Observe Accept visibility vs AI hints.
