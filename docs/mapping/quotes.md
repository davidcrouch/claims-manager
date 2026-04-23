# Quote — CW ↔ internal mapping

**CW contract:** `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.6 (Quote, Group, Combo, Item)
**Internal tables:** `quotes`, `quote_groups`, `quote_combos`, `quote_items` (see `apps/api/src/database/schema/index.ts` and `docs/design/01_DB_DESIGN.md`)
**Mapper:** `apps/api/src/modules/external/mappers/crunchwork-quote.mapper.ts`
**Last aligned with:** Insurance REST API v17 (exported 2026-03-04)

> **Coverage status:** The full contract is documented below. The current mapper is a **stub** that only promotes the parent resolution keys (`id`, `jobId`, `claimId`, `quoteNumber`, `name`, `reference`, `note`) and preserves the rest inside `api_payload`. Every field below marked "promoted" or "child row" other than those is part of the mapper backlog; update this doc **before** you add promotion logic.

---

## 1. Destination categories

Every CW field from §3.3.6 is routed to exactly one destination:

| Category | Target | Notes |
|---|---|---|
| Promoted column | explicit column on `quotes` / `quote_groups` / `quote_combos` / `quote_items` | Queryable |
| Lookup FK | `*_lookup_id` column | Resolved via `lookup_values.external_reference` within a named domain |
| JSONB bucket | `quote_to`, `quote_for`, `quote_from`, `schedule_info`, `approval_info`, `custom_data` on `quotes`; `dimensions`, `totals`, `group_payload` on `quote_groups`; `totals`, `combo_payload` on `quote_combos`; `tags`, `mismatches`, `totals`, `item_payload` on `quote_items` | |
| Child table | `quote_groups` (per group), `quote_combos` (per combo), `quote_items` (per item) | |
| `api_payload` | entire CW response on `quotes.api_payload` | Always stored; lossless fallback |

The `quotes.api_payload` column **always** contains the full verbatim CW response (including every nested group/combo/item). Every field is therefore preserved losslessly even when it is also promoted below.

The `*_payload` columns on the child tables (`quote_groups.group_payload`, `quote_combos.combo_payload`, `quote_items.item_payload`) carry the per-row verbatim CW object so child rows can be read without re-walking the parent payload.

---

## 2. Identity, references, timestamps (`quotes`)

| CW field | Type | Internal destination | Notes |
|---|---|---|---|
| `id` | String (UUID) | `quotes.external_reference` (column) | CW's canonical quote UUID |
| `externalReference` | String | `quotes.custom_data.cwExternalReference` | Insurer's own ref. No promoted column; kept in the catch-all bucket so it stays queryable without a schema change. |
| `tenantId` | String | _ignored on ingest_ | Tenant is derived from the connection context; do **not** overwrite `quotes.tenant_id`. |
| `quoteNumber` | String | `quotes.quote_number` (column) | |
| `date` | String (ISO 8601) | `quotes.quote_date` (column) | Stored as `timestamptz` |
| `createdAtDate` | String (ISO 8601) | `quotes.custom_data.cwCreatedAtDate` | CW-internal audit; not a DB column. |
| `updatedAtDate` | String (ISO 8601) | `quotes.custom_data.cwUpdatedAtDate` | Matches the claims convention. |
| `claimId` | String (CW claim UUID) | `quotes.claim_id` (resolved via `external_links`) | See §10 for resolution order. |
| `jobId` | String (CW job UUID) | `quotes.job_id` (resolved via `external_links`) | See §10. |

> `chk_quote_parent` requires at least one of `claim_id` or `job_id` to be non-null. If neither can be resolved, the mapper returns `{ skipped: 'skipped_no_parent' }` and the orchestrator records `completed_unmapped`. See §10.

---

## 3. Lookup references (`quotes`)

Each CW lookup object has the shape `{ id, name, externalReference }`. We resolve `externalReference` against `lookup_values` within the named domain. If unresolved, the behaviour matches the rule column in the CW contract.

| CW field | Internal column | Lookup domain | If unresolved |
|---|---|---|---|
| `status.externalReference` | `quotes.status_lookup_id` | `quote_status` | Leave null; log `UNRESOLVED_LOOKUP`. CW contract: "Continue API call". |
| `quoteType.externalReference` (also received as `quoteTypeId.externalReference` in the response body) | `quotes.quote_type_lookup_id` | `quote_type` | Leave null. CW contract: "Continue API call". |

**Per-field `.id` and `.name`** from each of the objects above are _not_ promoted to columns. `status.type` (Draft / Published / Cash Settled / Cancelled) and the `.name` fields stay inside `api_payload`; denormalised copies (`statusName`, `statusType`, `quoteTypeName`) land in `approval_info` — see §6.4.

---

## 4. Addresses / parties — `to*`, `for*`, `from*`

Destination: three JSONB columns on `quotes` (`quote_to`, `quote_for`, `quote_from`), plus a small set of promoted columns for common queries.

### 4.1 `quote_to` (JSONB) — recipient of the quote

Full CW `to*` scalar fields are stored inside `quote_to` under the un-prefixed keys. Two fields also get promoted columns for indexed querying.

| CW field | JSONB key on `quote_to` | Promoted column |
|---|---|---|
| `toName` | `name` | `quote_to_name` |
| `toCompanyRegistrationNumber` | `companyRegistrationNumber` | — |
| `toContactName` | `contactName` | — |
| `toClientReference` | `clientReference` | — |
| `toPhoneNumber` | `phoneNumber` | — |
| `toEmail` | `email` | `quote_to_email` |
| `toUnitNumber` | `unitNumber` | — |
| `toStreetNumber` | `streetNumber` | — |
| `toStreetName` | `streetName` | — |
| `toSuburb` | `suburb` | — |
| `toPostCode` | `postCode` | — |
| `toState` | `state` | — |
| `toCountry` | `country` | — |

### 4.2 `quote_for` (JSONB) — the customer the work is being quoted for

| CW field | JSONB key on `quote_for` | Promoted column |
|---|---|---|
| `forName` | `name` | `quote_for_name` |
| `forCompanyRegistrationNumber` | `companyRegistrationNumber` | — |
| `forContactName` | `contactName` | — |
| `forClientReference` | `clientReference` | — |
| `forPhoneNumber` | `phoneNumber` | — |
| `forEmail` | `email` | — |
| `forUnitNumber` | `unitNumber` | — |
| `forStreetNumber` | `streetNumber` | — |
| `forStreetName` | `streetName` | — |
| `forSuburb` | `suburb` | — |
| `forPostCode` | `postCode` | — |
| `forState` | `state` | — |
| `forCountry` | `country` | — |

### 4.3 `quote_from` (JSONB) — the vendor issuing the quote

| CW field | JSONB key on `quote_from` |
|---|---|
| `fromName` | `name` |
| `fromCompanyRegistrationNumber` | `companyRegistrationNumber` |
| `fromContactName` | `contactName` |
| `fromPhoneNumber` | `phoneNumber` |
| `fromEmail` | `email` |
| `fromUnitNumber` | `unitNumber` |
| `fromStreetNumber` | `streetNumber` |
| `fromStreetName` | `streetName` |
| `fromSuburb` | `suburb` |
| `fromPostCode` | `postCode` |
| `fromState` | `state` |
| `fromCountry` | `country` |

---

## 5. Promoted scalar columns (`quotes`)

| CW field | Internal column | Type |
|---|---|---|
| `name` | `quotes.name` | `text` |
| `reference` | `quotes.reference` | `text` |
| `note` | `quotes.note` | `text` |
| `expiresInDays` | `quotes.expires_in_days` | `integer` |
| `subTotal` | `quotes.sub_total` | `numeric(14,2)` |
| `totalTax` | `quotes.total_tax` | `numeric(14,2)` |
| `total` | `quotes.total_amount` | `numeric(14,2)` |
| `estimatedStartDate` | `quotes.estimated_start_date` | `date` |
| `estimatedCompletionDate` | `quotes.estimated_completion_date` | `date` |
| `isAutoApproved` | `quotes.is_auto_approved` | `boolean` |

---

## 6. JSONB buckets on `quotes` — grouped by theme

### 6.1 `quote_to`, `quote_for`, `quote_from`

See §4. These buckets hold the full structured address/party triples.

### 6.2 `schedule_info` (JSONB)

| CW field | JSONB key | Type |
|---|---|---|
| `estimatedStartDate` | `schedule_info.estimatedStartDate` | ISO 8601 string (denormalised alongside the promoted column) |
| `estimatedCompletionDate` | `schedule_info.estimatedCompletionDate` | ISO 8601 string (denormalised alongside the promoted column) |
| `reasonForVariation` | `schedule_info.reasonForVariation` | string |

### 6.3 `approval_info` (JSONB)

| CW field | JSONB key | Type |
|---|---|---|
| `isAutoApproved` | `approval_info.isAutoApproved` | boolean (denormalised alongside the promoted column) |
| `status.type` | `approval_info.statusType` | string (e.g. `Draft`, `Published`, `Cash Settled`, `Cancelled`) |
| `status.name` | `approval_info.statusName` | string |
| `quoteType.name` | `approval_info.quoteTypeName` | string |
| `createdBy.name` | `approval_info.createdByName` | string |
| `createdBy.externalReference` | `approval_info.createdByExternalReference` | string |
| `updatedBy.name` | `approval_info.updatedByName` | string |
| `updatedBy.externalReference` | `approval_info.updatedByExternalReference` | string |

`createdBy.id` / `updatedBy.id` are CW-internal user ids and are not promoted; they stay in `api_payload`. A short display handle is copied to `quotes.created_by_user_id` / `quotes.updated_by_user_id` (the `externalReference` value when present, falling back to `name`).

### 6.4 `custom_data` (JSONB) — catch-all

| CW field | JSONB key | Notes |
|---|---|---|
| `customData` (entire object on quote) | `custom_data` (spread at top level of the bucket) | Any keys not explicitly routed elsewhere are mirrored here. |
| `externalReference` | `custom_data.cwExternalReference` | See §2. |
| `createdAtDate` | `custom_data.cwCreatedAtDate` | See §2. |
| `updatedAtDate` | `custom_data.cwUpdatedAtDate` | See §2. |

Any **unknown** key present in the CW response but not listed anywhere in this doc is copied into `custom_data` under its original key so nothing is silently dropped out of the queryable surface. (It is also always in `api_payload`.)

---

## 7. `quote_groups`

For each element in CW `groups[]` upsert a row in `quote_groups` keyed by `(quote_id, external_reference)` where `external_reference = groups[].id` (CW group UUID; stored in `group_payload.id` since `quote_groups` has no dedicated column — see Implementation notes §10).

> **Schema gap — follow up.** `quote_groups` currently has no `external_reference` column. Until it is added, the mapper identifies an existing group by the CW `id` stored inside `group_payload.id`. Pruning (removing groups no longer in the latest payload) is therefore deferred to the schema migration that adds this column.

| CW field | Destination |
|---|---|
| `groups[].id` | `quote_groups.group_payload.id` (string; see gap above) |
| `groups[].groupLabel.externalReference` | `quote_groups.group_label_lookup_id` via `group_label` lookup domain |
| `groups[].groupLabel.name` | `quote_groups.group_payload.groupLabelName` |
| `groups[].groupLabel.id` | _ignored_ (CW internal) |
| `groups[].description` | `quote_groups.description` |
| `groups[].length` | `quote_groups.dimensions.length` (numeric string) |
| `groups[].width` | `quote_groups.dimensions.width` (numeric string) |
| `groups[].height` | `quote_groups.dimensions.height` (numeric string) |
| `groups[].index` | `quote_groups.sort_index` |
| `groups[].subTotal` | `quote_groups.totals.subTotal` |
| `groups[].totalTax` | `quote_groups.totals.totalTax` |
| `groups[].total` | `quote_groups.totals.total` |
| `groups[].items[]` | child rows in `quote_items` with `quote_group_id` set, `quote_combo_id` null (see §9) |
| `groups[].combos[]` | child rows in `quote_combos` (see §8) |
| `groups[].createdAtDate` | `quote_groups.group_payload.createdAtDate` |
| `groups[].createdBy` (object) | `quote_groups.group_payload.createdBy` (verbatim object) |
| `groups[].updatedAtDate` | `quote_groups.group_payload.updatedAtDate` |
| `groups[].updatedBy` (object) | `quote_groups.group_payload.updatedBy` (verbatim object) |
| entire CW group object | `quote_groups.group_payload` (verbatim) |

---

## 8. `quote_combos`

For each element in `groups[].combos[]` upsert a row in `quote_combos` keyed by `(quote_group_id, external_reference)` where `external_reference = combos[].id` (same schema-gap note as §7 applies — combo CW id is stored in `combo_payload.id`).

| CW field | Destination |
|---|---|
| `combos[].id` | `quote_combos.combo_payload.id` |
| `combos[].tenantId` | _ignored_ |
| `combos[].index` | `quote_combos.sort_index` |
| `combos[].catalogComboId` | `quote_combos.catalog_combo_id` |
| `combos[].name` | `quote_combos.name` |
| `combos[].description` | `quote_combos.description` |
| `combos[].category` | `quote_combos.category` |
| `combos[].subCategory` | `quote_combos.sub_category` |
| `combos[].quantity` | `quote_combos.quantity` (`numeric(14,4)`) |
| `combos[].lineScopeStatus.externalReference` | `quote_combos.line_scope_status_lookup_id` via `line_scope_status` lookup domain |
| `combos[].lineScopeStatus.name` | `quote_combos.combo_payload.lineScopeStatusName` |
| `combos[].lineScopeStatus.id` | _ignored_ |
| `combos[].items[]` | child rows in `quote_items` with `quote_combo_id` set, `quote_group_id` null (see §9) |
| `combos[].unitCost` | `quote_combos.totals.unitCost` (computed by CW; read-only) |
| `combos[].markupValue` | `quote_combos.totals.markupValue` (computed by CW; read-only) |
| `combos[].subTotal` | `quote_combos.totals.subTotal` |
| `combos[].totalTax` | `quote_combos.totals.totalTax` |
| `combos[].total` | `quote_combos.totals.total` |
| `combos[].allocatedCost` | `quote_combos.totals.allocatedCost` |
| `combos[].committedCost` | `quote_combos.totals.committedCost` |
| `combos[].delete` (Update-only request flag) | honoured by setting `quote_combos.deleted_at = now()` on ingest if present and `true`; otherwise ignored |
| `combos[].createdAtDate` / `combos[].createdBy` | `quote_combos.combo_payload.createdAtDate` / `...createdBy` |
| `combos[].updatedAtDate` / `combos[].updatedBy` | `quote_combos.combo_payload.updatedAtDate` / `...updatedBy` |
| `combos[].customData` | `quote_combos.combo_payload.customData` |
| entire CW combo object | `quote_combos.combo_payload` (verbatim) |

---

## 9. `quote_items`

For each element in `groups[].items[]` **and** `groups[].combos[].items[]` upsert a row in `quote_items`. `chk_quote_item_parent` enforces exactly one of `quote_group_id` / `quote_combo_id` being set:

- items under a group directly → `quote_group_id` = that group, `quote_combo_id` = null
- items nested inside a combo → `quote_combo_id` = that combo, `quote_group_id` = null

Upsert key is `(parent_id, external_reference)` where `external_reference = items[].id` and `parent_id` is whichever of `quote_group_id` / `quote_combo_id` applies. Same schema-gap note as §7 — CW id lives in `item_payload.id` until the dedicated column lands.

| CW field | Destination |
|---|---|
| `items[].id` | `quote_items.item_payload.id` |
| `items[].tenantId` | _ignored_ |
| `items[].catalogItemId` | `quote_items.catalog_item_id` |
| `items[].name` | `quote_items.name` |
| `items[].description` | `quote_items.description` |
| `items[].category` | `quote_items.category` |
| `items[].subCategory` | `quote_items.sub_category` |
| `items[].type` | `quote_items.item_type` (`Labour` / `Material` / `Other` — free text) |
| `items[].index` | `quote_items.sort_index` |
| `items[].unitType.externalReference` | `quote_items.unit_type_lookup_id` via `unit_type` lookup domain |
| `items[].unitType.name` | `quote_items.item_payload.unitTypeName` |
| `items[].unitType.id` | _ignored_ |
| `items[].quantity` | `quote_items.quantity` (`numeric(14,4)`) |
| `items[].tax` | `quote_items.tax` (percentage; `10` = 10%) |
| `items[].pcps` | `quote_items.item_payload.pcps` (`"PC"` / `"PS"` / null; no promoted column) |
| `items[].buyCost` | `quote_items.buy_cost` |
| `items[].unitCost` | `quote_items.unit_cost` |
| `items[].markupType` | `quote_items.markup_type` (`Absolute` / `Percentage`) |
| `items[].markupValue` | `quote_items.markup_value` |
| `items[].subTotal` | `quote_items.totals.subTotal` (computed by CW; read-only) |
| `items[].totalTax` | `quote_items.totals.totalTax` (computed by CW; read-only) |
| `items[].total` | `quote_items.totals.total` (computed by CW; read-only) |
| `items[].allocatedCost` | `quote_items.allocated_cost` |
| `items[].committedCost` | `quote_items.committed_cost` |
| `items[].delete` (Update-only request flag) | honoured by setting `quote_items.deleted_at = now()` on ingest if present and `true`; otherwise ignored |
| `items[].note` | `quote_items.note` |
| `items[].internal` | `quote_items.internal` |
| `items[].mismatches` | `quote_items.mismatches` (JSONB array; CW shape `{property, catalogValue}[]`) |
| `items[].tags` | `quote_items.tags` (JSONB array of strings) |
| `items[].lineScopeStatus.externalReference` | `quote_items.line_scope_status_lookup_id` via `line_scope_status` lookup domain |
| `items[].lineScopeStatus.name` | `quote_items.item_payload.lineScopeStatusName` |
| `items[].lineScopeStatus.id` | _ignored_ |
| `items[].createdAtDate` / `items[].createdBy` | `quote_items.item_payload.createdAtDate` / `...createdBy` |
| `items[].updatedAtDate` / `items[].updatedBy` | `quote_items.item_payload.updatedAtDate` / `...updatedBy` |
| `items[].customData` | `quote_items.item_payload.customData` |
| entire CW item object | `quote_items.item_payload` (verbatim) |

---

## 10. `api_payload` and parent resolution

The **entire** CW quote response (including nested groups / combos / items) is stored in `quotes.api_payload`. This is the lossless fallback and is used by replay / reprocess tooling, diff debugging, and any future field not yet promoted by a newer version of this mapping.

**Parent resolution (`jobId` / `claimId`)** — the mapper looks up each CW reference via `ExternalObjectService.resolveInternalEntityId` against `external_links`. Fallback order:

1. Resolve `payload.jobId` (or nested `payload.job.id`) → `jobs.id`
2. Resolve `payload.claimId` (or nested `payload.claim.id`) → `claims.id`
3. If neither resolves, return `{ skipped: 'skipped_no_parent' }` and let the orchestrator mark the record `completed_unmapped` for the parent-event retry / sweep to re-process.

CW's contract says "Either `jobId` or `claimId` is required". The internal `chk_quote_parent` CHECK enforces the same invariant on the DB.

---

## 11. CW fields deliberately not mapped

| CW field | Reason |
|---|---|
| `id` on every nested object (`status.id`, `quoteType.id`, `groupLabel.id`, `lineScopeStatus.id`, `unitType.id`, `createdBy.id`, `updatedBy.id`, `groups[].id`, `combos[].id`, `items[].id`) | CW-internal identifiers; we key on `externalReference` (for lookup references) or stash the CW id inside the row's `*_payload` (for child rows). |
| `tenantId` (top-level and on every nested object) | See §2 — tenant is derived from the connection. |
| `createdAtDate` / `updatedAtDate` on groups / combos / items | Preserved under `*_payload.createdAtDate` / `*_payload.updatedAtDate`; not promoted. |
| Computed read-only totals on combo / item (`subTotal`, `totalTax`, `total`, `unitCost`, `markupValue`, `allocatedCost`, `committedCost`) | CW marks them "Ignored" on POST; we preserve them in the respective `totals` / `item_payload.*` JSONB so our local reads don't need to re-compute. |
| `mismatches` on CW *request* payloads | Response-only field; never sent in. |

Nothing else from §3.3.6 is unmapped.

---

## 12. Implementation notes

`CrunchworkQuoteMapper`
(`apps/api/src/modules/external/mappers/crunchwork-quote.mapper.ts`) currently
implements **only the minimum subset** required to resolve the parent and
persist the raw payload. The following items are the mapper backlog before this
doc can be marked "Full — mapper matches spec":

- **Promote all scalar columns on `quotes`** listed in §5 and the `quote_to` /
  `quote_for` / `quote_from` promoted columns in §4.
- **Resolve `status` / `quoteType` lookups** in §3 (log `UNRESOLVED_LOOKUP`
  against `external_reference_resolution_log`; leave FK null on miss).
- **Sync group / combo / item children** per §7–§9 inside the same transaction
  provided by `InProcessProjectionService`.
- **Add `external_reference` columns** to `quote_groups`, `quote_combos`,
  `quote_items` so the mapper can upsert children idempotently by CW id instead
  of stashing the CW id in the JSONB payload (see the gap notes in §7–§9).
- **Pruning.** Once §7–§9 land, follow the same additive rules as `claims` for
  shared child tables, but prune groups / combos / items whose CW id is absent
  from the latest payload (they are per-quote state; stale rows mislead
  operational reads). Historical payloads remain in `quotes.api_payload`.
- **Parent fallback.** The current mapper already handles the `skipped_no_parent`
  case (§10) — keep this behaviour intact when expanding coverage.
- **Lookup domains to seed.** `quote_status` is already in
  `apps/api/src/database/seeds/entries/sample-data.seed.ts`. `quote_type`,
  `group_label`, `line_scope_status`, and `unit_type` are not yet seeded and
  will need stub entries (or lazy `UNRESOLVED_LOOKUP` logging) before the
  mapper starts resolving them.

Skip conditions for the current stub: the mapper returns
`{ skipped: 'skipped_no_parent' }` when neither a job nor a claim external link
exists yet. The orchestrator records this as `completed_unmapped` so the
sweep / parent-event retry can pick it up later.

## Conventions

See [`README.md`](./README.md) for the general mapping conventions (bucketing,
lookup resolution, shape notes).
