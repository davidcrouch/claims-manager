# 2b246cc6 — Unable to acknowledge Crunchwork notifications

| Field | Value |
|-------|-------|
| ID | `2b246cc6-9efb-4df6-ae6e-db40e9fcf57d` |
| Type / priority / status | bug / medium / open |
| Reporter | Robert Evenden |
| Created | 2026-09-08T22:23:28Z |
| Page | `/messages` |

## User report

CW messages show “Acknowledgement required” but no Acknowledge button / reply in drawer. Cannot clear notifications. Help guide also obscures page.

## Root cause

API acknowledge gated by env flag (default **off**):

```ts
// messages.service.ts
private readonly acknowledgeEnabled = process.env.MESSAGE_ACKNOWLEDGE_ENABLED === 'true';
// → NotImplementedException if false
```

UI shows Acknowledge when `acknowledgementRequired && !acknowledgedAt`. Also needs external link or BadRequest. Help overlay can cover drawer footer.

No `MESSAGE_ACKNOWLEDGE` hits in staging logs (feature never successfully used).

## Key files

- `apps/api/src/modules/messages/messages.service.ts` — `acknowledge`
- `apps/frontend/src/components/messages/MessageDetailDrawer.tsx`
- `apps/frontend/src/components/messages/MessagesListClient.tsx`
- Staging Cloud Run env / secrets for `MESSAGE_ACKNOWLEDGE_ENABLED`

## Proposed solution

**Recommended:** Enable the feature flag when CW ack is ready; fix UX either way.

1. Set `MESSAGE_ACKNOWLEDGE_ENABLED=true` on staging/prod once CW acknowledgement API is confirmed.
2. Surface flag/CW errors in UI (do not silently omit the button when the API errors).
3. Keep Acknowledge above the fold; ensure inbound msgs carry CW external link.
4. Help overlay must not block the drawer footer actions.

## Acceptance criteria

- [ ] Ack succeeds; badge clears; list updates.
- [ ] Failures show actionable error.
- [ ] Feature flag documented in deploy docs.

## Repro

`/messages` → CW msg with “Acknowledgement required” → try Acknowledge; check staging env + toast.
