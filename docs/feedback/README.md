# Staging feedback investigation (2026-09-14)

Agent-ready triage of Ensure Construction staging feedback (`app-staging.branlamie.com`).

## Snapshot

| Metric | Value |
|--------|-------|
| Source | Staging Postgres `feedback_items` + `feedback_notes` (tenant `3032bad6-…`) |
| Dump file | [`_raw-staging-dump.json`](./_raw-staging-dump.json) |
| Total items | 44 |
| Open | 41 |
| Open bugs | 22 (after dedupe → ~18 work items) |
| Resolved / closed | 3 (invoice payment + PO buy cost — skip) |
| GCP project | `claims-manager-staging-493807` |
| Log queries | `gcloud logging read … --project=claims-manager-staging-493807` service `api-server` |

## How to use these docs

1. Pick an item from the priority table below.
2. Open the linked markdown — it has reporter context, staging evidence, root cause, files, **Proposed solution**, AC, and log greps.
3. Implement the **Proposed solution** as written unless product overrides it; prefer fixing **deduped clusters** as one PR (listed under “Clusters”).
4. After fix: update the staging feedback item status/note via Admin → Feedback.

## Priority order (recommended)

| Priority | Cluster / item | Doc |
|----------|----------------|-----|
| P0 | Staging email is `console` — RFQ/PO never reach inboxes | [bugs/f72ca77c-rfq-email-not-received.md](./bugs/f72ca77c-rfq-email-not-received.md) |
| P0 | Critical: report create unavailable (CW API stub) | [bugs/eafa9ea3-unable-to-create-report.md](./bugs/eafa9ea3-unable-to-create-report.md) |
| P0 | Critical: photo upload trap on reports path | [bugs/218b9416-photo-upload-stuck.md](./bugs/218b9416-photo-upload-stuck.md) |
| P1 | Estimate line description closes mid-type (autosave) | [bugs/54832ec0-line-item-edit-closes.md](./bugs/54832ec0-line-item-edit-closes.md) |
| P1 | Estimate scope reorder does not persist | [bugs/e85a8ca7-estimate-reorder.md](./bugs/e85a8ca7-estimate-reorder.md) |
| P1 | Catalogue drag onto empty PO fails | [bugs/268f334f-po-catalogue-drag.md](./bugs/268f334f-po-catalogue-drag.md) |
| P1 | WO Accept/Decline status mismatch | [bugs/ea18d6ad-wo-accept-issued.md](./bugs/ea18d6ad-wo-accept-issued.md) |
| P1 | Job-scoped contact create does not link to job | [bugs/63dde5eb-contact-not-on-job.md](./bugs/63dde5eb-contact-not-on-job.md) |
| P1 | WO/RFQ attachments unavailable in send flow | [bugs/068be261-wo-attachments.md](./bugs/068be261-wo-attachments.md) |
| P1 | Message acknowledge gated off | [bugs/2b246cc6-message-acknowledge.md](./bugs/2b246cc6-message-acknowledge.md) |
| P1 | Help chat 400 / cannot restart | [bugs/79fc7c06-poor-assistant-400.md](./bugs/79fc7c06-poor-assistant-400.md) |
| P2 | Nellie cannot create jobs (RBAC) | [bugs/7c2389b5-nellie-create-jobs.md](./bugs/7c2389b5-nellie-create-jobs.md) |
| P2 | Job list Back loses pagination | [bugs/9209ea7b-job-list-back-page.md](./bugs/9209ea7b-job-list-back-page.md) |
| P2 | PO PDF missing line items | [bugs/c575ae01-po-pdf-line-items.md](./bugs/c575ae01-po-pdf-line-items.md) |
| P2 | Issue PO without catalogue line | [bugs/4988fefc-po-issue-without-catalogue.md](./bugs/4988fefc-po-issue-without-catalogue.md) |
| P2 | Make-Safe while PENDING | [bugs/4de4b163-makesafe-pending.md](./bugs/4de4b163-makesafe-pending.md) |
| P2 | Assessment specialists single-select only | [bugs/8cdc8988-specialists-multi.md](./bugs/8cdc8988-specialists-multi.md) |
| P2 | Claim archive discoverability | [bugs/d0ff2dd5-claim-archive.md](./bugs/d0ff2dd5-claim-archive.md) |
| P2 | Help closes / feedback log expectations | [bugs/06718a97-help-closes.md](./bugs/06718a97-help-closes.md), [bugs/d8719548-questions-not-in-feedback.md](./bugs/d8719548-questions-not-in-feedback.md) |
| P3 | Features / enhancements / questions | [features/README.md](./features/README.md) |

## Clusters (fix as one change)

| Cluster | Feedback IDs | Theme |
|---------|--------------|-------|
| Line-item edit closes | `54832ec0`, `46c673f5` | Autosave resets edit state after 600ms |
| WO attachments | `068be261`, `12244c74` | Same report twice |
| Bill vs PO compare | `22a3d812`, `d975ef83` | Duplicate feature request |
| OOH Make Safe | `747630b4`, `c612dd40` | Duplicate feature request |
| Help close / history | `06718a97`, `c9b4eb25`, `fe0a50a5` | UX + discoverability |
| PO lines / issue / PDF | `268f334f`, `4988fefc`, `c575ae01` | Empty PO → no lines → blank PDF |
| Email + attachments | `f72ca77c` + WO attach cluster | Console provider + no job docs on send |

## Already done (skip)

| ID | Title | Status | Note |
|----|-------|--------|------|
| `ae394622` | Track paid status of client invoices | resolved | Receive-payment added |
| `c617099a` | Ability to receive payment invoice | resolved | Same |
| `2e7ef924` | PO line buy cost not editable | closed | Fixed |

## Staging log cheatsheet

```powershell
# Feedback creates
gcloud logging read 'resource.labels.service_name="api-server" AND textPayload:"FeedbackService.create"' --project=claims-manager-staging-493807 --limit=50 --freshness=30d --format="value(timestamp,textPayload)"

# Report create stub / CW connection failures
gcloud logging read 'resource.labels.service_name="api-server" AND textPayload:"ReportsService"' --project=claims-manager-staging-493807 --limit=30 --freshness=30d --format="value(timestamp,textPayload)"

# Email provider + sends (IMPORTANT: staging is console)
gcloud logging read 'resource.labels.service_name="api-server" AND textPayload:"EmailService"' --project=claims-manager-staging-493807 --limit=40 --freshness=14d --format="value(timestamp,textPayload)"

# RFQ dispatch
gcloud logging read 'resource.labels.service_name="api-server" AND textPayload:"RfqRequestsService"' --project=claims-manager-staging-493807 --limit=30 --freshness=14d --format="value(timestamp,textPayload)"

# Gemini tool-loop / thoughtSignature
gcloud logging read 'resource.labels.service_name="api-server" AND textPayload:"thoughtSignature"' --project=claims-manager-staging-493807 --limit=30 --freshness=14d --format="value(timestamp,textPayload)"
```

## Investigation method (this pass)

1. Dumped `feedback_items` (+ notes) via one-off Cloud Run job with VPC to private Cloud SQL.
2. Correlated `FeedbackService.create` titles/timestamps with Cloud Logging.
3. Code-traced each open bug; verified key claims in repo.
4. Confirmed staging `api-server` lacked `EMAIL_PROVIDER`/`RESEND_API_KEY` (EmailService fell back to **console**); auth-server had Resend only.
5. **2026-09-15:** Implemented code/config fixes for most items; wrote explanation notes onto staging feedback records (`docs/feedback/_staging-notes-payload.json`). Remaining large features left open with deferred notes.
