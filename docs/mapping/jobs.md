# Jobs mapping (Crunchwork → internal `jobs`)

**Status:** Stub — minimum mapper coverage only. Fields not listed below are stored on `api_payload` only and are **not** yet normalised into promoted columns or child tables.

**Source endpoint:** `GET /jobs/{id}` (CW Insurance REST API v17 §3.2).
**Mapper:** `apps/api/src/modules/external/mappers/crunchwork-job.mapper.ts`.

## Minimum mapper coverage

| CW field | Destination on `jobs` | Notes |
|---|---|---|
| `id` | `external_reference` | CW job UUID. |
| (nested) `claim.id` | `claim_id` (resolved via `NestedEntityExtractor.extractFromJobPayload`) | If no claim is found, a shallow claim is auto-created. |
| (nested) `vendor.id` | `vendor_id` | Best-effort lookup; absent vendors are left null until a vendor event arrives. |
| *(entire body)* | `api_payload` | Full CW job payload is preserved verbatim. |

## Not yet normalised (captured in `api_payload` only)

All job-status lookups, cost breakdowns, addresses, contacts, assignees, teams, dates, descriptions, and custom metadata. These are the backlog anchors for bringing the job mapper up to full field coverage; treat this section as the TODO list.

## Conventions

See [`README.md`](./README.md) for the general mapping conventions (bucketing, lookup resolution, shape notes).
