# 79fc7c06 — Poor assistant (Error code 400)

| Field | Value |
|-------|-------|
| ID | `79fc7c06-295a-48b0-84e8-1b515a528620` |
| Type / priority / status | bug / medium / open |
| Reporter | Robert Evenden |
| Created | 2026-09-08T00:58:20Z |
| Page | Jobs Detail `/jobs/edcc4437-38c1-4107-a947-e0af844b3539` |
| Related | `d8719548`, `06718a97` |

## User report

Help assistant returns Error code 400 quickly (permissions / log conversation / report bug). Once 400 appears, no way to restart conversation.

## Root cause

Vertex/Gemini tool-loop 400 when `thoughtSignature` missing on functionCall parts — documented in code:

```ts
// vertex-gemini.provider.ts
// Gemini 3.x attaches thoughtSignature to functionCall parts; streaming
// chunks often omit it, which causes a 400 on the next tool-loop turn.
```

Mitigation already partially present (non-stream generate for tool turns) — staging still logs frequent `thoughtSignature safe` paths. After error, chat stays on broken conversation; **New conversation** only in History panel (`+`), not on error banner.

## Staging evidence

```text
2026-09-14 … VertexGeminiProvider.stream using non-stream generate for tool turn (thoughtSignature safe)
```

(Many hits same day — mitigation active but UX still fragile.)

## Key files

- `apps/api/src/modules/ai-chat/providers/vertex-gemini.provider.ts`
- `apps/api/src/modules/ai-chat/stream/stream-completion.ts`
- `apps/frontend/src/components/chat/ChatInterface.tsx`
- `apps/frontend/src/components/chat/ChatDrawer.tsx`
- `apps/frontend/src/components/chat/ChatHistoryPanel.tsx`

## Proposed solution

**Recommended:** Harden Vertex tool-loop signatures and add a one-click recovery path.

1. Ensure `thoughtSignature` round-trips on every tool turn; harden the missing-sig path in `vertex-gemini.provider.ts`.
2. On stream error: show **Start new conversation**, disable send until cleared; optionally auto-branch a new thread.
3. Toast that history is preserved (History icon left of X).

## Acceptance criteria

- [ ] Tool-using help turn completes without 400.
- [ ] After error, one-click new chat works; prior thread still in history.

## Repro

Job `edcc4437-…` → Help → ask about permissions / “log this” / “report as bug” → 400; try continue without opening History.
