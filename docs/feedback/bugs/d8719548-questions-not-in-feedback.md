# d8719548 — Chat/help questions not in feedback log

| Field | Value |
|-------|-------|
| ID | `d8719548-4397-4311-a00e-7af1a508f8ec` |
| Type / priority / status | bug / medium / open |
| Reporter | Robert Evenden |
| Created | 2026-09-14T00:56:24Z |
| Page | Feedback List |
| Related | `79fc7c06` (tool failures prevent logging) |

## User report

Questions asked in chat/help do not appear in the feedback log. Also asks whether chat/help logs are reviewed as part of construction process.

## Root cause

**By design today:** Chat Qs are **not** auto-written to `feedback_items`. Admin Feedback = MCP `create_feedback` / `log_feedback` only. Thumbs → `ai_message_feedback` (separate table). Tool failures (`79fc7c06`) also prevent intentional logging.

## Key files

- `apps/claims-mcp/src/tools/ai.tool.ts` — feedback tools
- `apps/api/src/modules/feedback/feedback.service.ts`
- `apps/api/src/modules/ai-chat/ai-feedback.service.ts`
- `apps/api/packs/help-system/agents/help-assistant.yaml`

## Proposed solution

**Recommended:** Do **not** auto-dump every chat turn into Feedback (noise). Instead:

1. In Admin Feedback and Help empty states, state clearly: “Feedback items are created when you ask Help to log feedback / report a bug — chat transcripts live under Help → History.”
2. Harden `create_feedback` / `log_feedback` so tool-loop 400s (`79fc7c06`) cannot block intentional logging; after a failed log, offer “Start new conversation” and retry.
3. Optional later: admin conversation audit viewer (separate from Feedback) if ops need to review help Qs.

## Acceptance criteria

- [ ] Documented path works for users and admins.
- [ ] Optional auto-log if product chooses it.
- [ ] Thumbs stay separate from Feedback admin.

## Repro

Ask Help a question (no “log this”) → Feedback list empty; thumbs ≠ feedback item.
