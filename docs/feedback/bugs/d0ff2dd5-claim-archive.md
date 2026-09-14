# d0ff2dd5 — Archive option missing on Claims Detail

| Field | Value |
|-------|-------|
| ID | `d0ff2dd5-80ee-4dfa-a9b9-ca3c74d9b73e` |
| Type / priority / status | bug / medium / open |
| Reporter | Robert Evenden |
| Created | 2026-09-09T00:59:15Z |
| Page | Claims Detail `/claims/043739c0-b2b1-4efc-b696-35ae79ab076d` |

## User report

Expects Archive in header toolbar / claim detail tab per help docs. Not present / hard to find.

## Root cause

Archive exists as **trash icon** via `ArchiveEntityButton` in `ClaimDetail` header — not labeled “Archive”. Hidden when `isArchivedStatus(status)` (`archived` / `closed` / `closed *`). Claims with insurer status **Closed** look active but have no archive control — conflicts with help copy.

## Key files

- `apps/frontend/src/components/claims/ClaimDetail.tsx`
- `apps/frontend/src/components/shared/ArchiveEntityButton.tsx`
- Archive helpers / `mutations-archive.ts`
- Help guides mentioning claim archive

## Proposed solution

**Recommended:** Make Archive discoverable and stop conflating insurer Closed with app Archived.

1. Label/tooltip the header control **Archive** (not only a trash icon).
2. Do not treat insurer **Closed** as app-archived for hiding the control (or still offer Archive / show Archived badge clearly).
3. Update help docs to match the real UI location.

## Acceptance criteria

- [ ] Active claims show clear Archive control.
- [ ] Already-app-archived hide it.
- [ ] Closed vs Archived clarified in UI/docs.

## Repro

Open claim `043739c0-…`; look for “Archive” text; note trash icon / status name.
