# Estimate (Quote) object gap review — CW API ↔ DB ↔ UI

**Date:** 2026-08-11  
**Source contract:** `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.6 Quote (+ Group / Combo / Item) (v17, exported 2026-03-04)  
**Internal mapping:** `docs/mapping/quotes.md`  
**DB:** `quotes`, `quote_groups`, `quote_combos`, `quote_items`  
**UI:** `apps/frontend/src/components/quotes/` (Estimate-branded; routes under `/quotes`)  
**Mapper:** `apps/api/src/modules/external/mappers/crunchwork-quote.mapper.ts`  
**Companions:** `docs/reviews/claim-cw-api-db-ui-gap.md`, `docs/reviews/job-cw-api-db-ui-gap.md`

**Goal:** Identify which Quote fields from the Crunchwork Insurance REST API are captured in our database and which are (or are not) shown to the user — under the product name **Estimate**.

---

## 1. Naming

| Layer | Name |
|---|---|
| CW Insurance REST API | **Quote** (no “Estimate” entity) |
| DB / API / mappers | `quotes` / Quote |
| Product UI | **Estimate** (sidebar, create, publish wizards, page titles) |

There is **no separate Estimate table**. UI “Estimate” = CW/DB Quote. CW uses “estimate” only in field names such as `estimatedStartDate` / `estimatedCompletionDate`.

---

## 2. Executive summary

| Layer | Verdict |
|---|---|
| **Schema + mapping doc** | Full §3.3.6 Quote / Group / Combo / Item surface designed. |
| **CW → DB mapper** | **Partial stub.** Promotes parent keys + a few scalars into `quotes` and always stores `api_payload`. Does **not** promote lookups, parties, schedule, approval, or sync children into `quote_groups` / `quote_combos` / `quote_items`. |
| **DB → UI (detail)** | Strong Estimate detail via columns + `apiPayload` / JSONB fallthroughs for overview, parties, schedule. Line-items tab is the primary authoring surface for local drafts; CW-sourced nested lines may only exist in `api_payload` until child sync lands. |
| **DB → UI (list)** | Thin finder (Estimate #, Job, name-as-Reference, Status, Type, Total, Date, Updated). |
| **Editability** | Local create + full line-item edit while draft; publish/approve wizards; archive. Most CW party/lookup fields are display-only. |

**Primary gaps — not promoted / weakly shown:**

1. Lookup FKs: `status`, `quoteType` (and child `groupLabel`, `lineScopeStatus`, `unitType`)
2. Party JSONB buckets `quote_to` / `quote_for` / `quote_from` (+ promoted name/email columns) — UI falls back to `apiPayload` prefixes
3. Schedule: `estimatedStartDate`, `estimatedCompletionDate`, `reasonForVariation` → `schedule_info` (UI falls back to payload)
4. `isAutoApproved`, `approval_info`, `createdBy` / `updatedBy` denorms
5. **Child hierarchy sync** — groups/combos/items not written to child tables from CW
6. Nested technical IDs / many `.externalReference` values not shown as labeled fields
7. Party address parts as discrete rows (composite address only)
8. List column labeled “Reference” actually shows `name`

---

## 3. Legend

| Symbol | Meaning |
|---|---|
| **Y** | Captured / shown |
| **P** | Partial (payload fallthrough, name only, or composite) |
| **N** | Not captured / not shown |
| **B** | Schema ready; mapper backlog (lossless only in `api_payload` / nested payload) |

---

## 4. Field matrix — Quote parent (§3.3.6)

### 4.1 Identity, parents, timestamps

| CW API field | DB destination (target) | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `id` | `quotes.external_reference` | Y | P | Y | Detail “CW ID”. |
| `externalReference` | `custom_data.cwExternalReference` | B | N | P | “Insurer reference” when present in customData/payload. |
| `tenantId` | ignored | N | N | N | |
| `quoteNumber` | `quote_number` | Y | Y | Y | List “Estimate #”. |
| `name` | `name` | Y | P | Y | List “Reference” column uses `name`. |
| `reference` | `reference` | Y | N | Y | |
| `note` | `note` | Y | N | Y | |
| `date` | `quote_date` | Y | Y | Y | |
| `createdAtDate` | `custom_data.cwCreatedAtDate` | B | N | P | |
| `updatedAtDate` | `custom_data.cwUpdatedAtDate` | B | N | P | |
| `claimId` | `claim_id` via links | Y | N | P | Via job/header context. |
| `jobId` | `job_id` via links | Y | Y | Y | List Job column. |
| `expiresInDays` | `expires_in_days` | Y | N | Y | |
| `subTotal` / `totalTax` / `total` | columns | Y | Y (total) | Y | |
| `isAutoApproved` | `is_auto_approved` + approval bucket | B | N | P | Overview BoolPill via payload fallthrough. |
| `estimatedStartDate` | `estimated_start_date` / `schedule_info` | B | N | P | |
| `estimatedCompletionDate` | column / schedule | B | N | P | |
| `reasonForVariation` | `schedule_info` | B | N | P | |
| `customData` | `custom_data` | B | N | N | No dump. |

### 4.2 Lookups

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `status.id` | payload only | P | N | N | |
| `status.name` | via `status_lookup_id` | B | Y | Y | UI uses joined status or payload. |
| `status.type` | `approval_info.statusType` | B | N | Y | Overview “Status type”. |
| `status.externalReference` | resolves FK | B | N | N | |
| `quoteType.id` | payload only | P | N | N | |
| `quoteType.name` | via FK / approval_info | B | Y | Y | Response may use `quoteTypeId` object. |
| `quoteType.externalReference` | resolves FK | B | N | N | |
| `createdBy.*` / `updatedBy.*` | approval_info / payload | B | N | P | Names shown; ids/refs mostly hidden. |

### 4.3 Parties (`to*` / `for*` / `from*`)

| CW group | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `toName` … `toCountry` (13 fields) | `quote_to` JSONB; `quote_to_name`, `quote_to_email` | B | N | P | Parties tab via bucket **or** `api.to*` prefixes. Address composite only. |
| `forName` … `forCountry` (13) | `quote_for`; `quote_for_name` | B | N | P | Same. |
| `fromName` … `fromCountry` (12; no clientReference) | `quote_from` | B | N | P | Same. |

**Not shown as labeled rows:** individual unit/street/suburb/postcode/state/country for each party (folded into one Address line).

---

## 5. Field matrix — Group / Combo / Item

### 5.1 Group

| CW field | DB (target) | Mapper today | UI |
|---|---|---|---|
| `id` | `quote_groups.external_reference` | B | Internal key when local |
| `groupLabel.*` | `group_label_lookup_id` | B | Label name in line-items UI |
| `description`, `length`/`width`/`height`, `index` | columns / `dimensions` / `sortIndex` | B | Editable in draft line-items |
| `subTotal` / `totalTax` / `total` | `totals` JSONB | B | Shown in hierarchy |
| `items[]` / `combos[]` | child tables | B | Line Items tab |
| audit `created*` / `updated*` | payload / group_payload | B | Mostly N |

### 5.2 Combo

| CW field | DB (target) | Mapper today | UI |
|---|---|---|---|
| `id` | `external_reference` | B | |
| `catalogComboId`, `name`, `description`, `category`, `subCategory`, `quantity`, `index` | columns | B | Assemblies in line-items |
| `lineScopeStatus.*` | FK | B | Less central in UI |
| costs / markup / totals / `allocatedCost` / `committedCost` | columns / totals | B | Partial |
| `items[]` | `quote_items` under combo | B | Y when local |
| `delete` (update) | soft-delete semantics | B | Local delete flows |
| `customData` | combo_payload / custom | B | N |

### 5.3 Item

| CW field | DB (target) | Mapper today | UI |
|---|---|---|---|
| `id` | `external_reference` | B | |
| `catalogItemId`, `name`, `description`, `category`, `subCategory`, `type`, `index` | columns (`itemType`) | B | Core editable fields when draft |
| `unitType.*` | `unit_type_lookup_id` | B | Unit type control |
| `quantity`, `tax`, `buyCost`, `unitCost`, markup*, totals, costs | columns | B | Most cost fields editable; buyCost/internal/tags/pcps/mismatches less central |
| `lineScopeStatus.*` | FK | B | Weak / N |
| `note`, `internal`, `tags[]`, `mismatches[]` | columns / JSONB | B | Partial |
| `pcps` | item_payload | B | N / weak |
| `customData` | item_payload | B | N |

**Critical:** Until child sync exists, a CW Quote’s groups/combos/items live only under `quotes.api_payload`. Local Estimates authored in-app populate child tables directly. Re-ingest does not currently rebuild the hierarchy tables from CW.

---

## 6. What the user does **not** see (focused)

### 6.1 Business / structural

| Area | Issue |
|---|---|
| **CW line hierarchy in child tables** | Not materialised → Line Items tab may not show CW structure unless separately loaded from payload (today tab is table-driven). |
| **Lookup external refs** | status / quoteType / groupLabel / lineScopeStatus / unitType refs hidden. |
| **Party address components** | Composite only. |
| **`tenantId`, nested `.id`s** | Hidden by design. |
| **Raw `customData`** | No dump. |
| **List “Reference”** | Shows `name`, not `reference` field — naming mismatch. |

### 6.2 Mapper backlog (DB incomplete vs contract)

Even when UI fallthroughs work, queryable promotions missing:

- `status_lookup_id`, `quote_type_lookup_id`
- `quote_to` / `quote_for` / `quote_from` (+ promoted columns)
- `schedule_info`, schedule date columns, `is_auto_approved`, `approval_info`
- `custom_data` denorms (`cwCreatedAtDate`, `cwUpdatedAtDate`, `cwExternalReference`)
- Full upsert/prune of `quote_groups` / `quote_combos` / `quote_items`

### 6.3 Local-only / supply-chain columns (not CW Quote)

`issuerOrganisationId`, `recipientOrganisationId`, `custodianTenantId`, `captureMethod`, `ownershipStatus`, `originType`, child `component` — used for cross-tenant / capture flows; outside §3.3.6.

---

## 7. List vs detail

| List column | Source |
|---|---|
| Estimate # | `quoteNumber` |
| Job | joined job |
| Reference | **`name`** (label mismatch) |
| Status | `status.name` |
| Estimate Type | `quoteType.name` |
| Total | `totalAmount` |
| Estimate Date | `quoteDate` |
| Updated | `updatedAt` |

**Detail tabs:** Overview, Line Items, Parties, Attachments, Journals, Timeline; Activities/Communications placeholders. Publish / Approve wizards for workflow.

**Create form:** job, name, quote type (hardcoded list), date, expires, schedule dates, note — not parties or line items.

---

## 8. Recommendations

1. **Finish `CrunchworkQuoteMapper` promotions** — same priority pattern as the completed job mapper: lookups, parties, schedule/approval, then **child hierarchy sync with prune**.
2. **Line Items for CW quotes** — either sync children on ingest or explicitly render hierarchy from `api_payload` so Estimates from Crunchwork are inspectable.
3. Fix list column label or source: “Reference” → `reference`, or rename column to “Name”.
4. Optional: party address DefRows for support/debug.
5. Seed lookup domains: `quote_type`, `group_label`, `line_scope_status`, `unit_type` (called out in mapping doc).

---

## 9. Sources

| Artifact | Path |
|---|---|
| CW Quote contract | `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.6 |
| Mapping | `docs/mapping/quotes.md` |
| Mapper | `apps/api/src/modules/external/mappers/crunchwork-quote.mapper.ts` |
| Schema | `apps/api/src/database/schema/index.ts` |
| UI | `apps/frontend/src/components/quotes/QuoteDetail.tsx`, `QuotesListClient.tsx` / `QuotesTable`, `QuoteLineItemsTab.tsx`, `EstimatePublishWizard.tsx` |
