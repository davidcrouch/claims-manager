# Reports mapping (Crunchwork → internal `reports`)

**Status:** Stub — minimum mapper coverage only. Fields not listed below are stored on `api_payload` only.

**Source endpoint:** `GET /reports/{id}` (CW Insurance REST API v17 §3.6).
**Mapper:** `apps/api/src/modules/external/mappers/crunchwork-report.mapper.ts`.

## Minimum mapper coverage

| CW field | Destination on `reports` | Notes |
|---|---|---|
| `id` | `external_reference` | CW report UUID. |
| `jobId` | `job_id` (resolved via external links) | When resolvable. |
| `claimId` | `claim_id` (resolved via external links) | Fallback when no job. |
| `reportType` | `report_type` | Free text until the report-type lookup is wired. |
| `status` | `status` | Free text. |
| `title` / `summary` | `title` / `summary` | |
| `publishedAt` | `published_at` | Coerced to `timestamptz`. |
| *(entire body)* | `api_payload` | Full CW report payload preserved verbatim. |

## Not yet normalised

Sections, attachments, signatories, reviewer chain, version history.

## Conventions

See [`README.md`](./README.md) for the general mapping conventions.
