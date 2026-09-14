# 068be261 / 12244c74 — Attachments not in WO vendor / send section

| Field | Value |
|-------|-------|
| IDs | `068be261-b5cf-45aa-9504-afa1825c305d`, `12244c74-ae0e-48d3-b9d9-2a3abac0158d` (**dup**) |
| Type / priority / status | bug / medium / open |
| Reporter | Mitchell Turnbull |
| Created | 2026-09-14T01:19Z |
| Page | `/rfqs` · job `7be5773d-5048-4bc7-bc04-15b6e77edfe4` |
| Related | `f72ca77c` (email delivery) |

## User report

Attachments/photos available under Documents operations, but not in the attachment section within work order / vendor send. System says “attachments unavailable”.

## Root cause

Two gaps:

1. **PO Attachments tab is a stub** (“attachments API is connected” placeholder) — empty/unavailable surface.
2. **Send wizards** (`IssuePoDrawer` / `SendRfqRequestDrawer`) only attach the **generated** PDF/DOCX — never load job Documents/photos for selection.

Working pattern already exists: `EntityAttachmentsTab` + `ProjectDocumentsPickerDrawer` on Job/Quote/Invoice.

## Key files

- `apps/frontend/src/components/purchase-orders/PurchaseOrderDetail.tsx` — `AttachmentsTab` stub
- `apps/frontend/src/components/purchase-orders/IssuePoDrawer.tsx`
- `apps/frontend/src/components/rfqs/SendRfqRequestDrawer.tsx`
- `apps/frontend/src/components/shared/EntityAttachmentsTab.tsx`
- `apps/frontend/src/components/shared/ProjectDocumentsPickerDrawer.tsx`

## Proposed solution

**Recommended:** Wire real attachments end-to-end (UI + send), same PR as feature `545ef1b0`.

1. Replace PO Attachments stub with `EntityAttachmentsTab` (`relatedRecordType` + `jobId`).
2. Add job document multi-select on Issue PO / Send RFQ (`ProjectDocumentsPickerDrawer`); pass selected docs into `po-issues` / `rfq-requests` email attachments.
3. Ensure staging email provider is Resend (`f72ca77c`) or attachments still will not arrive in inboxes.

## Acceptance criteria

- [ ] Job docs visible/selectable in send flow for that job.
- [ ] Selected files arrive on recipient email (with real email provider).
- [ ] PO Attachments tab lists linked files (not stub).

## Repro

Job `7be5773d` → Documents has photos → RFQs or PO Issue → attachment step → no job files / stub copy.
