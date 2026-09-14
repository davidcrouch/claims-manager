# 218b9416 — Cannot submit or leave photo upload (CRITICAL)

| Field | Value |
|-------|-------|
| ID | `218b9416-ce10-4889-a59c-a92c7f77c2e3` |
| Type / priority / status | bug / **critical** / open |
| Reporter | Mark Nas |
| Created | 2026-09-09T00:18:16Z |
| Page context | `/reports` · job `9005d180-ac29-4fc6-9823-d09bf5516a63` |
| Pair with | `eafa9ea3` (create report, same session) |

## User report

Dragged a photo into the upload box on the reports page. No way to submit or leave. No error shown. Critical for reporting.

## Staging evidence

No dedicated upload error lines found for this timestamp. `/reports` itself has **no** native photo drop zone — the matching UX is the AI **JournalFileUploadDrawer** (or Documents `DocumentDropZone` if path mislabeled).

## Root cause (ranked)

1. **Drawer opened without journal/folder context** — drop/submit disabled when neither `folderMode` nor `journalId`; feels like a dead upload area.
2. **`preventClose` while uploading** — `BottomFormDrawer` blocks Escape/backdrop/X while `submitting || isUploading`. Hung upload → cannot leave.
3. **MIME validation** — empty MIME / HEIC rejected by `validation.ts`; stage stays empty with easy-to-miss inline error.
4. **Documents overlay** (alt) — `DocumentDropZone` full-screen drag overlay can stick with no dismiss control.

## Key files

- `apps/frontend/src/components/journals/JournalFileUploadDrawer.tsx`
- `apps/frontend/src/components/forms/BottomFormDrawer.tsx` — `preventClose`
- `apps/frontend/src/lib/upload/use-document-upload.ts`
- `apps/frontend/src/lib/upload/validation.ts`
- `apps/frontend/src/components/documents/DocumentDropZone.tsx`
- MCP/skill: `open_journal_file_upload`, `apps/api/packs/journal-ops/skills/upload-journal-files.yaml`

## Proposed solution

**Recommended (ship in this order):** Escape hatch first, then preconditions, then MIME/overlay hardening.

1. Always allow Cancel / Abort; clear uploading state on cancel so users are never trapped by `preventClose`.
2. Timeout hung uploads; treat missing upload task as failure.
3. Block open or show prominent empty state until `jobId` + photos folder or `journalId` is resolved.
4. Toast rejected MIME; allow HEIC or extension fallback.
5. Harden DocumentDropZone: Esc / dragend resets overlay.

## Acceptance criteria

- [ ] On `/reports` with job context, upload JPEG → completes → drawer closes.
- [ ] Missing folder/journal → clear message; Cancel always works.
- [ ] Rejected file → toast; drawer closable.
- [ ] Hung upload → Cancel aborts within ~1s.
- [ ] Documents overlay dismissible.

## Repro

1. Chat on `/reports` with job `9005d180-…` → ask to upload inspection photos.
2. Drag HEIC / empty-MIME file; or valid JPEG then break upload URL.
3. Observe disabled submit / locked drawer / stuck overlay.
