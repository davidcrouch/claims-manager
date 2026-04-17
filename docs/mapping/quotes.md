# Quotes mapping (Crunchwork → internal `quotes`)

**Status:** Stub — minimum mapper coverage only. Fields not listed below are stored on `api_payload` only.

**Source endpoint:** `GET /quotes/{id}` (CW Insurance REST API v17 §3.5).
**Mapper:** `apps/api/src/modules/external/mappers/crunchwork-quote.mapper.ts`.

## Minimum mapper coverage

| CW field | Destination on `quotes` | Notes |
|---|---|---|
| `id` | `external_reference` | CW quote UUID. |
| `jobId` | `job_id` (resolved via external links) | When resolvable. |
| `claimId` | `claim_id` (resolved via external links) | Fallback when no job. |
| `status` | `status` | Passed through as free text until lookup wiring is added. |
| `totalAmount` / `subTotal` / `gstAmount` | `total_amount` / `subtotal` / `gst_amount` | Coerced to `numeric`. |
| *(entire body)* | `api_payload` | Full CW quote payload preserved verbatim. |

## Skip conditions

The mapper returns `{ skipped: 'skipped_no_parent' }` when neither a job nor a claim external link exists yet. The orchestrator records this as `completed_unmapped` so the sweep / parent-event retry can pick it up later.

## Not yet normalised

Line items, approval trail, vendor references, attachments. Track as part of full quote coverage.

## Conventions

See [`README.md`](./README.md) for the general mapping conventions.
