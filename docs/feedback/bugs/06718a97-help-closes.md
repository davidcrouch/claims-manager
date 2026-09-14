# 06718a97 / c9b4eb25 — Help tab closes / conversation “lost”

| Field | Value |
|-------|-------|
| IDs | `06718a97-64c5-4200-b5dc-7fda0d4f12d0` (bug), `c9b4eb25-dcd4-4621-82d5-39faf35d8dca` (feature; **dup UX**) |
| Status | open (notes from David Crouch already explain history) |
| Reporter | Robert Evenden |

## User report

Help tab closed without warning mid-conversation; felt like all answers lost. Feature request to log previous conversations.

## Root cause / current behaviour

Overlay click, Escape, and X close `ChatDrawer`. Closing feels like data loss though **history persists** (History icon left of X). David’s notes on both items already point users to the history drawer.

## Key files

- `apps/frontend/src/components/chat/ChatDrawer.tsx`
- `apps/frontend/src/components/chat/ChatHistoryPanel.tsx`
- `apps/frontend/src/components/layout/AppShell.tsx`

## Proposed solution

**Recommended:** Preserve threads and make History obvious — do not build a new logging feature.

1. Confirm-before-close if mid-stream; do not close on accidental backdrop while streaming.
2. Toast “Conversation saved — open History”.
3. Improve History affordance (tooltip / first-run tip on the icon left of X).
4. Close `c9b4eb25` as duplicate once discoverability lands; resolve `06718a97` with the same note.

## Acceptance criteria

- [ ] Accidental close doesn’t drop thread; History recovers it.
- [ ] Esc/backdrop behaviour clear in UI.

## Repro

Help open → Esc / click dimmed backdrop → reopen → History icon left of X.
