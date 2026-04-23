# Entity mapping docs

This directory contains the **canonical, field-by-field mappings** from the
Crunchwork (CW) external API contract to our internal database representation.

Each mapping doc is the single source of truth for one entity. If a CW field is
not in the doc, ingestion treats it as undocumented and it survives only inside
the `api_payload` catch-all JSONB column.

## Files

| File | Entity | CW contract reference | Coverage |
|------|--------|----------------------|----------|
| [`claims.md`](./claims.md) | Claim | `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.1 | **Full — mapper matches spec** |
| [`jobs.md`](./jobs.md) | Job | `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.2 + §3.3.3 | **Spec — full CW field coverage; mapper is stub (see §10)** |
| [`quotes.md`](./quotes.md) | Quote | `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.6 | Full contract documented; mapper is still at minimum coverage (see doc) |
| [`purchase_orders.md`](./purchase_orders.md) | Purchase Order | `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.8 | **Spec — full CW field coverage; mapper partial (gaps tracked in §11)** |
| [`reports.md`](./reports.md) | Report | `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.14 | Stub (minimum mapper coverage) |
| [`appointments.md`](./appointments.md) | Appointment | `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.10 | Stub (minimum mapper coverage) |

Stub-coverage docs describe only the fields the temporary in-process orchestrator (see [`docs/implementation/29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md`](../implementation/29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md)) currently persists. The remaining CW fields are still captured verbatim in `api_payload`, but are treated as backlog until the mapper and this doc are both expanded.

## Conventions used in every mapping doc

- **CW field** is written using the dotted path from the contract (`address.postcode`, `status.externalReference`).
- **Destination** is exactly one of:
  - a **promoted column** on the internal table
  - a **lookup FK** (column `*_lookup_id`) resolved through `lookup_values` by `externalReference` within a named lookup domain
  - a **JSONB bucket** (`address`, `policy_details`, `financial_details`, `vulnerability_details`, `contention_details`, `custom_data`, `po_to`, `po_for`, `po_from`, `service_window`, `adjustment_info`, `allocation_context`, …) with a specific key inside that bucket
  - a **child table** row (e.g. `claim_contacts`, `claim_assignees`, `purchase_order_groups`, `purchase_order_combos`, `purchase_order_items`)
  - `api_payload` only (explicitly documented as "not normalised")
- **Shape notes** describe optional / required, object-vs-string ambiguities, and type coercions (dates → `timestamptz`, floats → `numeric`).
- Every CW field listed in the contract table appears in the mapping doc — no silent drops.

## When to update these docs

Update the mapping doc **before** changing the corresponding mapper
(`apps/api/src/modules/external/mappers/*`) or the DB schema
(`apps/api/src/database/schema/index.ts`). The doc is the spec the mapper and
schema are verified against.
