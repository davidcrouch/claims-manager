# c575ae01 — Converted PO PDFs not showing line items

| Field | Value |
|-------|-------|
| ID | `c575ae01-4e99-4d0e-b280-578ade50d7b1` |
| Type / priority / status | bug / medium / open |
| Reporter | Mitchell Turnbull |
| Created | 2026-09-14T02:02:59Z |
| Page | Documents List · job `7be5773d-5048-4bc7-bc04-15b6e77edfe4` |
| Cluster | `268f334f`, `4988fefc` |

## User report

POs converted to PDF do not show line items after opening.

## Root cause (investigate in order)

1. **Template / transform** — Default transform exposes `groups[].items|combos|scopes`. Template that only loops `groups.items` misses nested scopes/assemblies.
2. **Data path** — `enrichWithContext` copies mapper `groups` onto `_context.groups`. Empty mapper groups → headers without lines.
3. **Mapper query** — `PurchaseOrderMapper` loads broad combo/item sets then filters; RFQ mapper scopes with `inArray` by group ids — prefer RFQ pattern.
4. Less likely: issue API stripping lines (it does not).

Also: issuing empty POs (cluster above) produces legitimately empty PDFs.

## Key files

- `apps/api/src/modules/document-generation/data-mappers/purchase-order.mapper.ts`
- `apps/api/src/modules/document-generation/data-mappers/line-items.helper.ts` — `buildTemplateGroups`
- `apps/api/src/modules/document-generation/document-generation.service.ts` — `enrichWithContext`
- `apps/api/src/modules/document-generation/schemas/target/defaults.ts` — `groupedItemsJsonataCtx`
- `apps/frontend/src/components/purchase-orders/IssuePoDrawer.tsx`
- Compare: `rfq.mapper.ts`

## Proposed solution

**Recommended:** Diagnose data vs template on one failing PO, then fix the broken layer.

1. Staging: dump `PurchaseOrderMapper.aggregate` / generation sample `_context.groups` for a PO that has UI lines but an empty PDF.
2. If data OK → fix Word/JSONata template loops to include items + scopes + combos.
3. If data empty → fix mapper filters (prefer RFQ-style `inArray` by group ids) and/or CW PO line sync.
4. Align tenant transform with default field names; regenerate affected docs.

## Acceptance criteria

- [ ] Regenerated PO PDF shows same lines as Take Off (incl. under scopes/assemblies).
- [ ] Sample/preview `_context.groups` non-empty when UI has lines.
- [ ] Stale docs noted if template-only fix.

## Repro / logs

1. Job `7be5773d-…` → Documents: open PO PDF expected to have lines.
2. Confirm same PO Take Off has lines in UI.
3. Regenerate; inspect generation sample `_context.groups`.

```powershell
gcloud logging read 'resource.labels.service_name="api-server" AND textPayload:"document-generation"' --project=claims-manager-staging-493807 --limit=30 --freshness=7d --format="value(timestamp,textPayload)"
```
