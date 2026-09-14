# f72ca77c — Recipient not receiving RFQ/Work Order emails

| Field | Value |
|-------|-------|
| ID | `f72ca77c-0439-4c27-8bc9-9b8e51f2d758` |
| Type / priority / status | bug / medium / open |
| Reporter | Mitchell Turnbull |
| Created | 2026-09-14T01:15:50Z |
| Page | `/rfqs` · job `7be5773d-5048-4bc7-bc04-15b6e77edfe4` |
| Related | WO attachments bugs `068be261` / `12244c74` |

## User report

RFQ and two work orders sent to “Chris” for the active job were not received after 10+ minutes. No error in UI.

## Staging evidence (logs)

**Root cause confirmed — email provider is console on staging:**

```text
2026-09-14T13:28:47Z  EmailService  communications:email-service:constructor - Provider: console
```

Sends are logged as success (never leave the API process):

```text
2026-09-14T00:59:31Z  EmailService send - To: chris@ensureconstructions.com.au | Subject: Request for Quotation
2026-09-14T00:59:31Z  RfqRequestsService.executeDispatch - Batch 7836cebe-… complete: 1 sent, 0 failed
2026-09-14T00:59:31Z  RfqRequestsService.trySavePdfToJobFolder - Saved PDF … job 7be5773d-…
2026-09-14T01:59:35Z  EmailService send - To: chris@… | Subject: Purchase Order: PO-200025
… (many PO sends to chris@ / gmail later same day)
```

So the application pipeline **believes** it sent; Resend/SMTP never ran.

## Root cause

1. **Primary (ops/config):** `EMAIL_PROVIDER=console` (or unset → console) on staging `api-server`. Console transport logs and returns success.
2. **Secondary (product):** Send wizards only attach the generated RFQ/PO PDF — not job Documents/photos (see `068be261`). Users may also mean “attachments missing” when they say email not received.

## Key files

- `apps/api/src/modules/communications/email/email.service.ts` — provider selection
- `apps/api/src/modules/rfq-requests/rfq-requests.service.ts` — `executeDispatch`
- `apps/api/src/modules/po-issues/po-issues.service.ts`
- Terraform / secrets: staging Cloud Run env for `EMAIL_PROVIDER`, `RESEND_API_KEY`
- UI: `SendRfqRequestDrawer.tsx`, `IssuePoDrawer.tsx`, Request/Issue batch detail

## Proposed solution

**Recommended:** Fix staging email delivery first (ops), then harden UX.

1. Set staging (and confirm prod) `EMAIL_PROVIDER=resend` + valid `RESEND_API_KEY` + verified from-domain.
2. In non-local envs, refuse silent “sent” success when provider is console (UI warning: “Email not delivered — console provider”).
3. Surface recipient `status` / `errorMessage` in RFQ/PO request detail toast after send.
4. Ship with attachment picker work (`068be261`) so “received” includes expected job photos when selected.

## Acceptance criteria

- [ ] Staging EmailService boot log shows `Provider: resend` (not console).
- [ ] Sending RFQ/PO to a real mailbox delivers within ~2 minutes with PDF attached.
- [ ] Failed sends show failed recipient status + actionable error (not silent success).
- [ ] Ops doc notes staging previously used console.

## Repro

1. Confirm current provider via log grep above.
2. Job `7be5773d` → Send RFQ to `chris@ensureconstructions.com.au`.
3. Observe UI success + Cloud Logging `EmailService.send` + `executeDispatch … 1 sent`.
4. Inbox empty while provider=console.
