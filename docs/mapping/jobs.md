# Job — CW ↔ internal mapping

**CW contract:** `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.2 (Job) and §3.3.3 (Job when included in the Claim object)
**Internal table:** `jobs` (see `apps/api/src/database/schema/index.ts` and `docs/design/01_DB_DESIGN.md` §7)
**Related tables:** `job_contacts` + `contacts`, `appointments` (+ `appointment_attendees`)
**Mapper:** `apps/api/src/modules/external/mappers/crunchwork-job.mapper.ts`
**Last aligned with:** Insurance REST API v17 (exported 2026-03-04)

> **Current implementation status — stub.** The mapper today persists only a handful of fields (see §10). Everything in this doc describes the **target** spec the DB schema is already built for; rows marked *(backlog)* are currently available only through `api_payload`. The spec exists here because the README convention requires every CW §3.3.2 field to be listed explicitly — no silent drops.

---

## 1. Destination categories

Every CW field from §3.3.2 is routed to exactly one destination:

| Category | Target | Notes |
|---|---|---|
| Promoted column | explicit column on `jobs` | Queryable, indexed where relevant |
| Lookup FK | `*_lookup_id` column | Resolved via `lookup_values.external_reference` within a named domain |
| JSONB bucket | `address`, `vendor_snapshot`, `temporary_accommodation_details`, `specialist_details`, `rectification_details`, `audit_details`, `mobility_considerations`, `custom_data` | Queryable via JSONB operators / GIN indexes where present |
| Child table | `job_contacts` + `contacts`; `appointments` + `appointment_attendees` | One row per array element |
| `api_payload` | full CW response | Always stored; lossless fallback |

The `api_payload` column **always** contains the full verbatim CW response. Every field is therefore preserved losslessly even when it is also promoted to a column or JSONB bucket below.

---

## 2. Identity, references, timestamps

| CW field | Type | Internal destination | Notes |
|---|---|---|---|
| `id` | String (UUID) | `external_reference` (column) | CW's canonical job UUID. Primary external key used by `external_links` dedupe. |
| `externalReference` | String | `custom_data.insurerExternalReference` *(backlog)* | Insurer's own system ID (e.g. service request ID). Distinct from `jobs.external_reference` which stores the CW UUID. Promote to a dedicated column (`external_job_id`) when the insurer-side lookup is wired up. |
| `claimId` | String (UUID) | `claim_id` (FK, required) | Resolved via `NestedEntityExtractor.extractFromJobPayload` against the CW claim UUID. If no matching claim exists locally, a shallow claim stub is auto-created before the job row. |
| `parentClaimId` | String (UUID) | `parent_claim_id` (column) | Preserved verbatim; not FK-linked. Present on hierarchical / secondary jobs. |
| `updatedAtDate` | String (ISO 8601) | `custom_data.cwUpdatedAtDate` | Not a DB column; kept in `custom_data` for audit. |
| `tenantId` | String | _ignored on ingest_ | CW tenant is already known from the connection context; do **not** overwrite `jobs.tenant_id`. |
| `claim` (nested Claim object, §3.3.3) | Object | _routed to the Claim mapper, not persisted on `jobs`_ | Handled by `NestedEntityExtractor` — creates/updates a shallow `claims` row (and its external link) then hands the resolved `claims.id` back as `claim_id`. See §11. |

### 2.1 Internal-only columns (not CW-sourced)

These columns exist on `jobs` but have **no counterpart in the CW §3.3.2 contract**. They are populated by this application's own operational logic and must never be overwritten from a CW payload:

| Column | Type | Purpose |
|---|---|---|
| `parent_job_id` | `uuid` (self-FK to `jobs.id`, nullable) | The **master / parent job** link. See §2.2. |
| `id` | `uuid` | Internal primary key (CW's `id` lands in `external_reference`). |
| `tenant_id` | `uuid` | Tenant scope; derived from the connection. |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz` | Row-level housekeeping. |

### 2.2 Master / parent job concept (`parent_job_id`)

Claims-Manager supports **job hierarchy within a single claim**: one CW job can be split into multiple internal work packages, or several sibling CW jobs can be grouped under a single locally-created parent. This is an **internal operational model** driven by the builder's workflow — Crunchwork itself does not carry a `parentJobId` field on the Job contract (only `parentClaimId`, which is a claim-level link, not a job-to-job link).

**Supported mapping cardinalities between CW and internal `jobs`:**

| Relationship | Example use case | Representation |
|---|---|---|
| 1 CW job → 1 internal job | Straight pass-through | `parent_job_id IS NULL`, single row |
| 1 CW job → *N* internal jobs (split) | Builder breaks a single "Make Safe" CW job into discrete trades (plumbing, electrical, carpentry) tracked as separate local jobs | One "master" row carries the CW `external_reference` (and is the target of `external_links`); *N* child rows have `parent_job_id = master.id` with `external_reference = NULL` (the unique index `UQ_jobs_tenant_extref` allows multiple NULLs per tenant) |
| *N* CW jobs → 1 internal job | Builder treats several CW jobs as one package | Each local row keeps its own CW `external_reference`; a conceptual "master" is chosen and siblings set `parent_job_id = master.id` |
| *N* CW jobs → *N* internal jobs | Full flexibility | Any subset may be linked via `parent_job_id` |

**Semantics:**

- `parent_job_id` is **nullable**. Null means the job is a top-level (master/standalone) job.
- The FK is self-referential on `jobs.id` with no `ON DELETE CASCADE` — deleting a parent does **not** auto-delete children. Operational ordering (e.g., "quote the master first, then child tradies") is a UI / service-layer concern, not a DB invariant.
- Hierarchy depth is not limited by the schema. In practice the UI assumes one level (master → children) per PRD2 §3; deeper nesting is treated as an anti-pattern.
- Writes to `parent_job_id` are **always from this application's own services** (never from a CW webhook). `CrunchworkJobMapper` must therefore preserve an existing `parent_job_id` on update and never clear it.

Rationale: see `docs/PRD2.md` §3 (Example — split jobs) and `docs/discussion/001-prd2-gap-analysis.md` §2.2.1.

---

## 3. Lookup references

Each CW lookup object has the shape `{ id, name, externalReference }`. We resolve `externalReference` against `lookup_values` within the named domain.

| CW field | Internal column | Lookup domain | If unresolved |
|---|---|---|---|
| `jobType.externalReference` | `job_type_lookup_id` (NOT NULL) | `job_type` | Auto-create stub row (mapper rule: ingest cannot proceed without a job type because the column is `NOT NULL`; stubbing avoids DLQ). Contract says "Fail API Call" for write ops — see §10. |
| `status.externalReference` | `status_lookup_id` | `job_status` | Leave null; log `UNRESOLVED_LOOKUP`. |

**Per-field `.id` and `.name`** from each object are _not_ promoted to columns. `name` is denormalised into the relevant JSONB bucket where useful (e.g. `vendor_snapshot.name`) for display without a join. `id` is CW-internal and preserved in `api_payload` only.

---

## 4. Address

Destination: the `address` JSONB column on `jobs`, plus a set of promoted columns for common queries.

| CW field | Internal destination |
|---|---|
| `address.unitNumber` | `address.unitNumber` (JSONB key) |
| `address.streetNumber` | `address.streetNumber` (JSONB key) |
| `address.streetName` | `address.streetName` (JSONB key) |
| `address.suburb` | `address.suburb` (JSONB key) **and** `address_suburb` (column) |
| `address.postcode` | `address.postcode` (JSONB key) **and** `address_postcode` (column) |
| `address.state` | `address.state` (JSONB key) **and** `address_state` (column) |
| `address.country` | `address.country` (JSONB key) **and** `address_country` (column) |
| `address.latitude` | `address.latitude` (JSONB key only — no promoted column today) |
| `address.longitude` | `address.longitude` (JSONB key only — no promoted column today) |

The full CW `address` object is stored verbatim into `address` JSONB; the promoted columns are extracted for indexed querying.

---

## 5. Promoted scalar columns

| CW field | Internal column | Type | Vendor-tenancy only? |
|---|---|---|---|
| `requestDate` | `request_date` | `date` | No |
| `collectExcess` | `collect_excess` | `boolean` | **Yes** (contract note: "Just Available on Vendor Tenancy") |
| `excess` | `excess` | `numeric(14,2)` | **Yes** |
| `makeSafeRequired` | `make_safe_required` | `boolean` | **Yes** |
| `jobInstructions` | `job_instructions` | `text` (HTML allowed per CW) | No |

For Insurer tenants these four vendor-only fields will typically be `null`; the UI hides them when unset (see `docs/implementation/32_UI_JOB_DETAIL_REVAMP.md`).

---

## 6. Vendor

Destination: FK resolution plus a denormalised JSONB snapshot.

| CW field | Internal destination | Notes |
|---|---|---|
| `vendor.id` | lookup key for `vendor_id` (current stub) | CW vendor UUID. The stub mapper currently looks up the local `vendors` row by this id via `VendorsRepository.findOne({ id })`. No vendor row is auto-created — when missing the job's `vendor_id` is left null and the vendor is expected to arrive via a separate vendor event. |
| `vendor.name` | `vendor_snapshot.name` *(backlog)* | Denormalised snapshot for display without a join. |
| `vendor.externalReference` | `vendor_id` (FK to `vendors`) via the `vendor` external-reference domain *(target spec)* | The CW contract specifies `externalReference` as the Vendor Tenancy write-op key. The current stub resolves by `vendor.id` instead; switch to `externalReference` resolution when the vendor mapper grows beyond stub. |
| entire `vendor` object | `vendor_snapshot` (JSONB) *(backlog)* | Copied verbatim so stale cases are visible without rehydrating the vendor row. |

The whole `vendor` object is *"Just Available on Vendor Tenancy"* per the CW contract; on Insurer tenants the field is absent and `vendor_id` / `vendor_snapshot` remain null / `{}`.

---

## 7. Job-type conditional fields

The CW contract §3.3.2 makes large swathes of fields conditional on `jobType.name`. Each group lands in its own JSONB bucket on `jobs`.

### 7.1 Temporary Accommodation → `temporary_accommodation_details` (JSONB)

| CW field | JSONB key | Type |
|---|---|---|
| `emergency` | `temporary_accommodation_details.emergency` | boolean |
| `habitableProperty` | `temporary_accommodation_details.habitableProperty` | boolean |
| `estimatedStayStartDate` | `temporary_accommodation_details.estimatedStayStartDate` | ISO 8601 string |
| `estimatedStayEndDate` | `temporary_accommodation_details.estimatedStayEndDate` | ISO 8601 string |
| `numberOfAdults` | `temporary_accommodation_details.numberOfAdults` | integer (1–10) |
| `numberOfChildren` | `temporary_accommodation_details.numberOfChildren` | integer (0–10) |
| `numberOfBedrooms` | `temporary_accommodation_details.numberOfBedrooms` | integer (0–10) |
| `numberOfCots` | `temporary_accommodation_details.numberOfCots` | integer (0–10) |
| `numberOfVehicles` | `temporary_accommodation_details.numberOfVehicles` | integer (0–5) |
| `petsInformation` | `temporary_accommodation_details.petsInformation` | string |

Note: `accommodationBenefitLimit` and `maximumAccommodationDurationLimit` appear on the *Claim* contract (§3.3.1), not the Job contract. They live on `claims` (see `docs/mapping/claims.md` §6.2 and §6.5). The Job Detail UI surfaces them by joining to the parent claim.

### 7.2 `mobilityConsiderations` (its own JSONB array column)

CW shape: `List<{ name: String, externalReference: String }>`. Persisted verbatim to the `mobility_considerations` JSONB array column. Not currently normalised into a lookup FK join; each element is stored as-is. Only meaningful for Temporary Accommodation jobs.

### 7.3 Specialist → `specialist_details` (JSONB)

| CW field | JSONB key | Type |
|---|---|---|
| `isSpecificSpecialistRequired` | `specialist_details.isSpecificSpecialistRequired` | boolean |
| `specialistCategory.externalReference` | `specialist_details.specialistCategory.externalReference` | string |
| `specialistCategory.name` | `specialist_details.specialistCategory.name` | string (denormalised) |
| `specialistReport.externalReference` | `specialist_details.specialistReport.externalReference` | string |
| `specialistReport.name` | `specialist_details.specialistReport.name` | string (denormalised) |
| `specialistBusinessName` | `specialist_details.specialistBusinessName` | string — only valid when `isSpecificSpecialistRequired === true`; the mapper stores it verbatim when present and ignores it otherwise. |
| `locationOfDamage` | `specialist_details.locationOfDamage` | string |
| `typeOfDamage` | `specialist_details.typeOfDamage` | string |

### 7.4 Rectification → `rectification_details` (JSONB)

Applies to `Rectification Assessment` **and** `Builder Rectification Work` job types.

| CW field | JSONB key | Type |
|---|---|---|
| `originalJobReference` | `rectification_details.originalJobReference` | string |
| `originalJobType.externalReference` | `rectification_details.originalJobType.externalReference` | string |
| `originalJobType.name` | `rectification_details.originalJobType.name` | string (denormalised) |
| `paidJob` | `rectification_details.paidJob` | boolean |

`originalJobType.id` is ignored (CW-internal).

### 7.5 Internal Audit → `audit_details` (JSONB)

| CW field | JSONB key | Type |
|---|---|---|
| `auditType.externalReference` | `audit_details.auditType.externalReference` | string |
| `auditType.name` | `audit_details.auditType.name` | string (denormalised) |

---

## 8. Child tables

### 8.1 `contacts` + `job_contacts`

For each element in CW `contacts[]`:

1. Upsert a row in `contacts` keyed by `(tenant_id, external_reference)` where `external_reference = contacts[].externalReference`.
2. Upsert a row in `job_contacts` keyed by `(job_id, contact_id)` (see unique index `UQ_job_contact`). Preserve array order via `sort_index`.

| CW field | Destination |
|---|---|
| `contacts[].id` | _ignored_ (CW-internal) |
| `contacts[].firstName` | `contacts.first_name` |
| `contacts[].lastName` | `contacts.last_name` |
| `contacts[].email` | `contacts.email` |
| `contacts[].homePhone` | `contacts.home_phone` |
| `contacts[].mobilePhone` | `contacts.mobile_phone` |
| `contacts[].workPhone` | `contacts.work_phone` |
| `contacts[].externalReference` | `contacts.external_reference` (required; CW rule: "Add Mapping Value and Record" — mapper auto-creates a stub row when missing) |
| `contacts[].type.externalReference` | `contacts.type_lookup_id` via `contact_type` lookup domain |
| `contacts[].type.name` | `job_contacts.source_payload.typeName` |
| `contacts[].preferredMethodOfContact.externalReference` | `contacts.preferred_contact_method_lookup_id` via `contact_method` lookup domain |
| `contacts[].preferredMethodOfContact.name` | `job_contacts.source_payload.preferredMethodName` |
| `contacts[].notes` | `contacts.notes` |
| entire CW contact object | `contacts.contact_payload` (verbatim, shared contact row) **and** `job_contacts.source_payload.raw` (verbatim, per job↔contact join) |

**Tolerance (matches Claim contract):** `contacts[].type` and `contacts[].preferredMethodOfContact` may arrive as bare strings (see CW JSON body example: `"type": "INSURED"`). When a string is received, attempt a name-based lookup within the named domain; on miss the FK is left null and the raw string remains in `source_payload` for display.

### 8.2 `appointments` + `appointment_attendees`

`jobs.apiPayload.appointments[]` is persisted verbatim on the job row. Each element is **also** projected into the `appointments` table by `CrunchworkAppointmentMapper` (see `docs/mapping/appointments.md`) using `appointments.job_id = jobs.id`. The job mapper itself does **not** write to `appointments` — that remains the appointment mapper's responsibility — but the contract field `appointments` is considered covered through the appointments child table.

---

## 9. `custom_data` (JSONB) — catch-all

| CW field | JSONB key | Notes |
|---|---|---|
| `updatedAtDate` | `custom_data.cwUpdatedAtDate` | See §2 |
| `externalReference` | `custom_data.insurerExternalReference` | *(backlog)* — insurer's system ID, see §2 |
| unknown top-level CW keys | `custom_data.<key>` | Copied verbatim so nothing is silently dropped from the queryable surface. (Also always present in `api_payload`.) |

---

## 10. Current mapper coverage (stub)

`CrunchworkJobMapper` today populates only the columns it absolutely needs to insert a legal `jobs` row and keep external-link projection idempotent. The DB schema already exposes the full field surface documented above, but the mapper is a backlog item to fill it in.

| Field | Populated today? | Notes |
|---|---|---|
| `external_reference` | ✅ | Set to `payload.id` (CW job UUID). |
| `claim_id` | ✅ | Resolved via `NestedEntityExtractor.extractFromJobPayload`; shallow claim auto-created when missing. Insertion is refused if no `claimId` can be derived. |
| `job_type_lookup_id` | ✅ | Resolved via `lookupResolver.resolve({ domain: 'job_type', …, autoCreate: true })`. Insertion is refused if `jobType.externalReference` is absent. |
| `vendor_id` | ✅ (best-effort) | Via `NestedEntityExtractor.resolveOrCreateVendor` when `payload.vendor.id` is present; left null otherwise. |
| `api_payload` | ✅ | Always written verbatim. |
| `parent_claim_id` | ❌ *(backlog)* | Column exists; mapper does not populate. |
| `status_lookup_id` | ❌ *(backlog)* | Column exists. |
| `request_date`, `collect_excess`, `excess`, `make_safe_required`, `job_instructions` | ❌ *(backlog)* | Columns exist. |
| `address`, `address_postcode/suburb/state/country` | ❌ *(backlog)* | JSONB + promoted columns exist. |
| `vendor_snapshot` | ❌ *(backlog)* | JSONB column exists. |
| `temporary_accommodation_details`, `specialist_details`, `rectification_details`, `audit_details`, `mobility_considerations` | ❌ *(backlog)* | JSONB columns exist. |
| `custom_data` | ❌ *(backlog)* | JSONB column exists. |
| `job_contacts` / `contacts[]` sync | ❌ *(backlog)* | Child table exists with `UQ_job_contact`. |
| `parent_job_id` | N/A — internal-only | Never sourced from CW; only written by in-app services when the builder splits/groups jobs (see §2.2). The mapper must **preserve** any existing value on update; it must **never** write or clear this column from a CW payload. |

Contract write-op rules that only matter when the mapper expands beyond the stub:

- **`jobType.externalReference` — "Fail API Call" on unknown value.** The contract says outbound `POST /jobs` must fail; the *inbound* mapper currently auto-creates a lookup stub because webhook ingest has no synchronous caller to receive the 4xx. When outbound create is added in `apps/api/src/modules/jobs/jobs.service.ts`, the CW server itself enforces this rule — we don't need to pre-validate.
- **`status.externalReference` — "Fail API Call" on unknown value.** Same rationale; enforced on the CW side for outbound calls. Inbound mapper should log `UNRESOLVED_LOOKUP` and continue so the job row still lands.
- **`vendor.externalReference` — "Fail API Call" on unknown value.** Only relevant for outbound; inbound resolves best-effort or leaves `vendor_id` null.
- **`contacts[].externalReference`, `contacts[].type.externalReference` — "Add Mapping Value and Record" / "Continue API call".** Translate to: auto-create stub lookup rows (when expanding the contacts sync) and never fail ingest for a missing external reference on a contact sub-object.

---

## 11. §3.3.3 Job (when included in the Claim object)

When a `job` appears *inside* a CW claim response, CW sends a slim shape: `{ id, jobType{id,name,externalReference}, status{id,name,externalReference}, vendor{id,name,externalReference}, externalReference, tenantId }`.

**Current behaviour:** `CrunchworkClaimMapper` does **not** project these slim job entries into the `jobs` table. They are preserved verbatim inside `claims.api_payload` only, and the real job row arrives later (whenever CW emits `NEW_JOB` / `UPDATE_JOB`, at which point the full §3.3.2 mapper above runs). If the parent-claim projection ever needs to eagerly materialise these stubs, the pattern to follow is the inverse of `NestedEntityExtractor.projectNestedClaim` used from the job side (see `apps/api/src/modules/external/nested-entity-extractor.service.ts`). This is tracked under the same stub-expansion backlog as §10.

---

## 12. Conventions

See [`README.md`](./README.md) for the general mapping conventions (bucketing, lookup resolution, shape notes).
