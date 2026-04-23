# Claim — CW ↔ internal mapping

**CW contract:** `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.1 (Claim)
**Internal table:** `claims` (see `apps/api/src/database/schema/index.ts` and `docs/design/01_DB_DESIGN.md` §6)
**Mapper:** `apps/api/src/modules/external/mappers/crunchwork-claim.mapper.ts`
**Last aligned with:** Insurance REST API v17 (exported 2026‑03‑04)

---

## 1. Destination categories

Every CW field from §3.3.1 is routed to exactly one destination:

| Category | Target | Notes |
|---|---|---|
| Promoted column | explicit column on `claims` | Queryable, indexed where relevant |
| Lookup FK | `*_lookup_id` column | Resolved via `lookup_values.external_reference` within a named domain |
| JSONB bucket | `address`, `policy_details`, `financial_details`, `vulnerability_details`, `contention_details`, `custom_data` | Queryable via JSONB operators / GIN indexes where present |
| Child table | `claim_contacts` + `contacts`, `claim_assignees` | One row per array element |
| `api_payload` | full CW response | Always stored; lossless fallback |

The `api_payload` column **always** contains the full verbatim CW response. Every field is therefore preserved losslessly even when it is also promoted to a column or JSONB bucket below.

---

## 2. Identity, references, timestamps

| CW field | Type | Internal destination | Notes |
|---|---|---|---|
| `id` | String (UUID) | `external_reference` (column) | CW's canonical claim UUID |
| `externalReference` | String | `external_claim_id` (column) | Insurer's own reference; do not confuse with the internal UUID |
| `claimNumber` | String | `claim_number` (column) | Unique per tenant |
| `lodgementDate` | String (ISO date) | `lodgement_date` (column) | Stored as `date` |
| `dateOfLoss` | String (ISO 8601) | `date_of_loss` (column) | Stored as `timestamptz` |
| `updatedAtDate` | String (ISO 8601) | `custom_data.cwUpdatedAtDate` | Not a DB column; kept in `custom_data` for audit |
| `tenantId` | String | _ignored on ingest_ | CW tenant is already known from the connection context; do **not** overwrite `claims.tenant_id` |

---

## 3. Lookup references

Each CW lookup object has the shape `{ id, name, externalReference }`. We resolve `externalReference` against `lookup_values` within the named domain. If unresolved, the behaviour matches the rule column in the CW contract.

| CW field | Internal column | Lookup domain | If unresolved |
|---|---|---|---|
| `status.externalReference` | `status_lookup_id` | `claim_status` | Leave null; log `UNRESOLVED_LOOKUP` |
| `account.externalReference` | `account_lookup_id` | `account` | Fail ingest for this record (CW contract: "Fail API Call") |
| `catCode.externalReference` | `cat_code_lookup_id` | `cat_code` | Create lookup stub (CW rule: "Add Mapping Value and Record") |
| `lossType.externalReference` | `loss_type_lookup_id` | `loss_type` | Leave null |
| `lossSubType.externalReference` | `loss_subtype_lookup_id` | `loss_subtype` | Leave null |
| `claimDecision.externalReference` | `claim_decision_lookup_id` | `claim_decision` | Leave null |
| `priority.externalReference` | `priority_lookup_id` | `priority` | Leave null |
| `policyType.externalReference` | `policy_type_lookup_id` | `policy_type` | Leave null |
| `lineOfBusiness.externalReference` | `line_of_business_lookup_id` | `line_of_business` | Leave null |

**Per-field `.id` and `.name`** from each of the objects above are _not_ promoted to columns. They remain inside `api_payload`.

**Object-or-string tolerance.** The CW JSON body example (§3.3.1) occasionally shows these as bare strings (e.g. `"claimDecision": "Claim Accepted"`, `"priority": "LOW"`, `"policyType": "HOME"`, `"lineOfBusiness": "PersonalProperty"`). When the field arrives as a string, attempt a name match within the lookup domain; on miss, store the raw string under `custom_data.<field>Raw` and leave the FK null.

`contacts[].type`, `contacts[].preferredMethodOfContact` and `assignees[].type` are also tolerated as bare strings. The CW JSON body example shows `"type": "INSURED"` on contacts and assignees even though the contract table lists them as `{id, name, externalReference}` objects. When the value arrives as a string the mapper attempts a name-based lookup; on miss the FK is left null and the raw string remains inside the row's `source_payload` / `assignee_payload` for display.

---

## 4. Address

Destination: the `address` JSONB column on `claims`, plus a set of promoted columns for common queries.

| CW field | Internal destination |
|---|---|
| `address.unitNumber` | `address.unitNumber` (JSONB key) |
| `address.streetNumber` | `address.streetNumber` (JSONB key) |
| `address.streetName` | `address.streetName` (JSONB key) |
| `address.suburb` | `address.suburb` (JSONB key) **and** `address_suburb` (column) |
| `address.postcode` | `address.postcode` (JSONB key) **and** `address_postcode` (column) |
| `address.state` | `address.state` (JSONB key) **and** `address_state` (column) |
| `address.country` | `address.country` (JSONB key) **and** `address_country` (column) |
| `address.latitude` | `address.latitude` (JSONB key) **and** `address_latitude` (column, `numeric(10,7)`) |
| `address.longitude` | `address.longitude` (JSONB key) **and** `address_longitude` (column, `numeric(10,7)`) |

The full CW `address` object is stored verbatim into `address` JSONB; the promoted columns are extracted for indexed querying.

---

## 5. Promoted scalar columns

| CW field | Internal column | Type |
|---|---|---|
| `vulnerableCustomer` | `vulnerable_customer` | `boolean` |
| `totalLoss` | `total_loss` | `boolean` |
| `contentiousClaim` | `contentious_claim` | `boolean` |
| `contentiousActivityFlag` | `contentious_activity_flag` | `boolean` |
| `autoApprovalApplies` | `auto_approval_applies` | `boolean` |
| `contentsDamaged` | `contents_damaged` | `boolean` |
| `incidentDescription` | `incident_description` | `text` (HTML allowed per CW) |
| `abn` | `abn` | `text` |
| `policyName` | `policy_name` | `text` |
| `policyNumber` | `policy_number` | `text` |
| `postalAddress` | `postal_address` | `text` |

---

## 6. JSONB buckets — grouped by theme

All remaining CW fields map to one of the existing JSONB buckets on `claims`. This answers the question of whether the previously-unmapped fields can be grouped into a JSONB column: **yes — they all fit into buckets that already exist in the schema; no new columns are required.**

### 6.1 `policy_details` (JSONB)

| CW field | JSONB key | Type |
|---|---|---|
| `policyInceptionDate` | `policy_details.policyInceptionDate` | ISO 8601 string |
| `policyType.name` | `policy_details.policyTypeName` | string (denormalised alongside the lookup FK) |
| `lineOfBusiness.name` | `policy_details.lineOfBusinessName` | string (denormalised alongside the lookup FK) |

### 6.2 `financial_details` (JSONB)

| CW field | JSONB key | Type |
|---|---|---|
| `buildingSumInsured` | `financial_details.buildingSumInsured` | number |
| `contentsSumInsured` | `financial_details.contentsSumInsured` | number |
| `collectExcess` | `financial_details.collectExcess` | boolean (claim-level; distinct from the job-level `jobs.collect_excess`) |
| `excess` | `financial_details.excess` | number (claim-level) |
| `accommodationBenefitLimit` | `financial_details.accommodationBenefitLimit` | number |

### 6.3 `vulnerability_details` (JSONB)

| CW field | JSONB key | Type |
|---|---|---|
| `vulnerabilityCategory` | `vulnerability_details.category` | string |

### 6.4 `contention_details` (JSONB)

| CW field | JSONB key | Type |
|---|---|---|
| `contentiousActivityDetails` | `contention_details.activityDetails` | string |

The boolean flags `contentiousClaim` and `contentiousActivityFlag` remain as promoted columns (§5) and are not duplicated inside `contention_details`.

### 6.5 `custom_data` (JSONB) — catch‑all for CW `customData` and miscellany

| CW field | JSONB key | Notes |
|---|---|---|
| `customData` (entire object) | `custom_data` (spread at top level of the bucket) | CW already stores most of these UI fields under `project.customData.*`; we mirror any keys not explicitly routed elsewhere here |
| `maximumAccomodationDurationLimit` | `custom_data.maximumAccommodationDurationLimit` | String. CW v17 spells the field correctly (`maximumAccommodationDurationLimit`, two m's) in the contract table but with one m (`maximumAccomodationDurationLimit`) in the JSON body example. Real CW payloads use the misspelled form, so the mapper reads the misspelled key and writes the corrected key under `custom_data`. |
| `updatedAtDate` | `custom_data.cwUpdatedAtDate` | See §2 |
| `claimDecision` (if string) | `custom_data.claimDecisionRaw` | See §3 object-or-string tolerance |
| `priority` (if string) | `custom_data.priorityRaw` | See §3 |
| `policyType` (if string) | `custom_data.policyTypeRaw` | See §3 |
| `lineOfBusiness` (if string) | `custom_data.lineOfBusinessRaw` | See §3 |

Any **unknown** key present in the CW response but not listed anywhere in this doc is copied into `custom_data` under its original key so nothing is silently dropped out of the queryable surface. (It is also always in `api_payload`.)

---

## 7. Child tables

### 7.1 `contacts` + `claim_contacts`

For each element in CW `contacts[]`:

1. Upsert a row in `contacts` keyed by `(tenant_id, external_reference)` where `external_reference = contacts[].externalReference`.
2. Upsert a row in `claim_contacts` keyed by `(claim_id, contact_id)`.

| CW field | Destination |
|---|---|
| `contacts[].id` | _ignored_ (CW internal) |
| `contacts[].firstName` | `contacts.first_name` |
| `contacts[].lastName` | `contacts.last_name` |
| `contacts[].email` | `contacts.email` |
| `contacts[].homePhone` | `contacts.home_phone` |
| `contacts[].mobilePhone` | `contacts.mobile_phone` |
| `contacts[].workPhone` | `contacts.work_phone` |
| `contacts[].externalReference` | `contacts.external_reference` (required; fail record if missing) |
| `contacts[].type.externalReference` | `contacts.type_lookup_id` via `contact_type` lookup domain |
| `contacts[].type.name` | `claim_contacts.source_payload.typeName` |
| `contacts[].preferredMethodOfContact.externalReference` | `contacts.preferred_contact_method_lookup_id` via `contact_method` domain |
| `contacts[].preferredMethodOfContact.name` | `claim_contacts.source_payload.preferredMethodName` |
| `contacts[].notes` | `contacts.notes` |
| entire CW contact object | `contacts.contact_payload` (verbatim, per shared contact row) **and** `claim_contacts.source_payload.raw` (verbatim, per claim↔contact join) |

### 7.2 `claim_assignees`

For each element in CW `assignees[]` upsert a row keyed by `(claim_id, external_reference)`.

| CW field | Destination |
|---|---|
| `assignees[].id` | _ignored_ |
| `assignees[].externalReference` | `claim_assignees.external_reference` |
| `assignees[].name` | `claim_assignees.display_name` |
| `assignees[].email` | `claim_assignees.email` |
| `assignees[].type.externalReference` | `claim_assignees.assignee_type_lookup_id` via `assignee_type` domain |
| `assignees[].type.name` | `claim_assignees.assignee_payload.typeName` |
| entire CW assignee object | `claim_assignees.assignee_payload` (verbatim) |

---

## 8. `api_payload`

The **entire** CW claim response (post any normalisation we do on keys) is stored in `claims.api_payload`. This is the lossless fallback and is used by:

- Replay / reprocess tooling
- Diff debugging
- Any future field not yet promoted by a newer version of this mapping

---

## 9. CW fields deliberately not mapped

| CW field | Reason |
|---|---|
| `id` on every nested object (`status.id`, `account.id`, `catCode.id`, `lossType.id`, `lossSubType.id`, `claimDecision.id`, `priority.id`, `policyType.id`, `lineOfBusiness.id`, `contacts[].id`, `assignees[].id`) | CW-internal identifiers; we key on `externalReference` instead. Preserved in `api_payload`. |
| `tenantId` | See §2 — tenant is derived from the connection. |
| `contacts[].preferredMethodOfContact.name` / `type.name` (when `.externalReference` is already captured) | Kept in `claim_contacts.source_payload` for display only. |

Nothing else from §3.3.1 is unmapped.

---

## 10. Implementation notes

`CrunchworkClaimMapper`
(`apps/api/src/modules/external/mappers/crunchwork-claim.mapper.ts`) implements
the full spec above inside a single transaction supplied by
`InProcessProjectionService`. Behavioural notes that go beyond the table rows:

- **Unresolved `account` → auto-create lookup stub.** Rather than the CW
  contract's "Fail API Call" semantics, the mapper auto-creates a stub row in
  `lookup_values` keyed on the external reference. The webhook pipeline has no
  synchronous caller to receive the 4xx, so blocking the whole claim projection
  on a missing account code would push routine "not yet seeded" cases into
  dead-letter. Stub creation is audit-logged via
  `external_reference_resolution_log`, and stub rows have
  `name === external_reference` for easy identification and back-fill.
- **Unresolved `status`, `lossType`, `lossSubType`, `claimDecision`, `priority`,
  `policyType`, `lineOfBusiness`** leave their FK as `null`. `claim_status`
  misses are logged to `external_reference_resolution_log` so operators can
  triage missing domain data; the other domains are expected to be sparse and
  are not logged individually.
- **Unresolved `catCode`** auto-creates a stub row in `lookup_values` keyed on
  the external reference, matching the CW rule "Add Mapping Value and Record".
- **`claimDecision` / `priority` / `policyType` / `lineOfBusiness` as strings**
  are resolved by a case-insensitive name lookup against the same domain; on
  miss the raw string is stored under `custom_data.<field>Raw` and the FK is
  left `null`.
- **`contacts[]` sync is additive.** The mapper upserts `contacts` (shared
  table, keyed on `(tenant_id, external_reference)`) and `claim_contacts`
  (keyed on `(claim_id, contact_id)`) but **never prunes** — a contact
  disappearing from a later CW payload does not remove the join row. This
  protects replay idempotence and avoids truncating legitimate relationships
  when CW emits a partial payload.
- **`claim_assignees[]` sync prunes.** Rows whose `external_reference` is not
  present in the latest CW payload (and rows with a null `external_reference`)
  are deleted inside the same transaction. Assignees are claim-scoped state
  and stale rows mislead operational dashboards; historical payloads remain in
  `claims.api_payload` for audit.
- **Existing-claim fallback order**: (1) link in `external_links` for the same
  `external_object`, (2) `(tenant_id, external_reference == CW claim id)`,
  (3) `(tenant_id, claim_number)`. The last fallback protects against a race
  where the webhook lost its initial insert but CW re-sent the event.
- **Date parsing is lenient.** Unparseable or non-string values for
  `lodgementDate` / `dateOfLoss` land as `null` with a warning; the raw value
  remains available in `api_payload`.
- **Unknown keys are preserved.** Any top-level CW claim field not routed
  elsewhere in this doc is copied under `custom_data.<key>` verbatim so
  nothing is silently dropped from the queryable surface.
