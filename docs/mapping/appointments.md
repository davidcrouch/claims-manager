# Appointments mapping (Crunchwork → internal `appointments`)

**Status:** Stub — minimum mapper coverage only. Fields not listed below are stored on `api_payload` only.

**Source endpoint:** `GET /appointments/{id}` (CW Insurance REST API v17 §3.7).
**Mapper:** `apps/api/src/modules/external/mappers/crunchwork-appointment.mapper.ts`.

## Minimum mapper coverage

| CW field | Destination on `appointments` | Notes |
|---|---|---|
| `id` | `external_reference` | CW appointment UUID. |
| `jobId` | `job_id` (resolved via external links; **required**) | See skip conditions. |
| `startDate` | `start_date` (**required**) | Coerced to `timestamptz`. |
| `endDate` | `end_date` (**required**) | Coerced to `timestamptz`. |
| `location` | `location` | Normalised to a string (joins object parts with `, `). |
| `status` | `status` | Free text. |
| `type` | `type` | Free text. |
| *(entire body)* | `api_payload` | Full CW appointment payload preserved verbatim. |

## Skip conditions

- `{ skipped: 'skipped_no_parent' }` — when no job link exists yet for the supplied `jobId`.
- `{ skipped: 'skipped_incomplete_payload' }` — when `startDate` or `endDate` is missing.

In both cases the orchestrator records `completed_unmapped` on the inbound event and the external object remains available for re-projection once the parent / payload is complete.

## Not yet normalised

Attendees, travel details, recurrence rules, notes, reminder scheduling.

## Conventions

See [`README.md`](./README.md) for the general mapping conventions.
