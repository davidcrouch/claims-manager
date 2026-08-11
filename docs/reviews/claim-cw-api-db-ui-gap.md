# Claim object gap review — CW API ↔ DB ↔ UI

**Date:** 2026-08-11  
**Source contract:** `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.1 Claim (v17, exported 2026-03-04)  
**Internal mapping:** `docs/mapping/claims.md`  
**DB:** `claims`, `contacts`, `claim_contacts`, `claim_assignees` (`apps/api/src/database/schema/index.ts`)  
**UI:** `apps/frontend/src/components/claims/ClaimDetail.tsx`, `ClaimsListClient.tsx`  

**Goal:** Identify which Claim fields from the Crunchwork Insurance REST API are captured in our database and which are (or are not) shown to the user.

---

## 1. Executive summary

| Layer | Verdict |
|---|---|
| **CW → DB** | Near-complete. Every §3.3.1 field is preserved in `api_payload`; business fields are also promoted to columns, lookup FKs, JSONB buckets, or child tables per `docs/mapping/claims.md`. |
| **DB → UI (detail)** | Strong coverage of user-facing scalars and nested collections. Gaps are mostly technical identifiers (nested `.id` / some `.externalReference`), geocoordinates, and address parts as discrete labels. |
| **DB → UI (list)** | Intentionally thin — seven columns only. |
| **Editability** | Claim UI is read-only (archive status is the only local mutation). No create/edit claim form. |

**Primary answer — fields not shown to the user** (detail page):

1. `address.latitude` / `address.longitude`
2. Nested lookup **IDs** (`status.id`, `account.id`, `catCode.id`, `lossType.id`, `lossSubType.id`, `claimDecision.id`, `priority.id`, `policyType.id`, `lineOfBusiness.id`, `contacts[].id`, `assignees[].id`)
3. Several nested lookup **external references** (`status.externalReference`, `account.externalReference`, `claimDecision.externalReference`, `priority.externalReference`, `policyType.externalReference`, `lineOfBusiness.externalReference`, `lossSubType.externalReference`, `contacts[].type.externalReference`, `contacts[].preferredMethodOfContact.externalReference`, `assignees[].type.externalReference`)
4. `tenantId` (intentionally not ingested onto the claim row)
5. Raw `customData` blob (individual known keys may surface elsewhere; no dump)
6. Address components as separate labeled fields (`unitNumber`, `streetNumber`, `streetName`) — only folded into the formatted address string

---

## 2. Legend

| Symbol | Meaning |
|---|---|
| **Y** | Captured / shown |
| **P** | Partial (e.g. name only, or folded into a composite display) |
| **N** | Not captured / not shown |
| **—** | Not applicable |

UI surfaces:

- **List** — claims table (`ClaimsListClient`)
- **Detail** — claim detail tabs/header (`ClaimDetail`)

---

## 3. Field matrix (CW Claim §3.3.1)

### 3.1 Identity, status, account

| CW API field | DB destination | List | Detail | Notes |
|---|---|---|---|---|
| `id` | `external_reference` (+ `api_payload`) | P | Y | Detail: “Crunchwork ID”. List uses as fallback label only. |
| `externalReference` | `external_claim_id` | N | Y | Detail: “Insurer reference”. |
| `claimNumber` | `claim_number` | Y | Y | |
| `lodgementDate` | `lodgement_date` | Y | Y | Header + Overview. |
| `updatedAtDate` | `custom_data.cwUpdatedAtDate` | N | Y | Timeline: “Last Crunchwork update”. |
| `tenantId` | ignored on ingest | N | N | Tenant comes from connection context. |
| `status.id` | `api_payload` only | N | N | |
| `status.name` | via `status_lookup_id` → joined `status.name` | Y | Y | |
| `status.externalReference` | resolves `status_lookup_id` | N | N | Not displayed as text. |
| `account.id` | `api_payload` only | N | N | |
| `account.name` | via `account_lookup_id` → joined `account.name` | Y | Y | |
| `account.externalReference` | resolves `account_lookup_id` | N | N | |

### 3.2 Address

| CW API field | DB destination | List | Detail | Notes |
|---|---|---|---|---|
| `address.unitNumber` | `address` JSONB | P | P | Folded into formatted address; no dedicated DefRow. |
| `address.streetNumber` | `address` JSONB | P | P | Same. |
| `address.streetName` | `address` JSONB | P | P | Same. |
| `address.suburb` | JSONB + `address_suburb` | P | Y | Dedicated suburb row on Overview. |
| `address.postcode` | JSONB + `address_postcode` | P | Y | |
| `address.state` | JSONB + `address_state` | P | Y | |
| `address.country` | JSONB + `address_country` | P | Y | |
| `address.latitude` | JSONB + `address_latitude` | N | **N** | Stored, never rendered. |
| `address.longitude` | JSONB + `address_longitude` | N | **N** | Stored, never rendered. |
| `postalAddress` | `postal_address` | N | Y | Overview “Postal address”. |

### 3.3 Loss classification

| CW API field | DB destination | List | Detail | Notes |
|---|---|---|---|---|
| `catCode.id` | `api_payload` only | N | N | |
| `catCode.name` / `Name` | via `cat_code_lookup_id` + payload | N | Y | Loss tab. |
| `catCode.externalReference` | resolves FK | N | Y | “CAT code ref”. |
| `lossType.id` | `api_payload` only | N | N | |
| `lossType.name` | via `loss_type_lookup_id` + payload | N | Y | |
| `lossType.externalReference` | resolves FK | N | Y | “Loss type ref”. |
| `lossSubType.id` | `api_payload` only | N | N | |
| `lossSubType.name` | via `loss_subtype_lookup_id` + payload | N | Y | |
| `lossSubType.externalReference` | resolves FK | N | **N** | Unlike loss type, subtype ref has no DefRow. |
| `dateOfLoss` | `date_of_loss` | N | Y | Header + Overview + Loss. |
| `claimDecision.name` | via FK / payload / `custom_data.claimDecisionRaw` | N | Y | |
| `claimDecision.externalReference` | resolves FK | N | **N** | |
| `priority.name` | via FK / payload / `custom_data.priorityRaw` | N | Y | |
| `priority.externalReference` | resolves FK | N | **N** | |
| `totalLoss` | `total_loss` | N | Y | |
| `contentsDamaged` | `contents_damaged` | N | Y | |
| `incidentDescription` | `incident_description` | N | Y | Overview + Loss (HTML). |

### 3.4 Policy & financial

| CW API field | DB destination | List | Detail | Notes |
|---|---|---|---|---|
| `abn` | `abn` | N | Y | |
| `policyName` | `policy_name` | P | Y | List column uses policy number \|\| name. |
| `policyNumber` | `policy_number` | Y | Y | |
| `policyType.name` | FK + `policy_details.policyTypeName` | N | Y | |
| `policyType.externalReference` | resolves FK | N | **N** | |
| `policyInceptionDate` | `policy_details.policyInceptionDate` | N | Y | |
| `lineOfBusiness.name` | FK + `policy_details.lineOfBusinessName` | N | Y | |
| `lineOfBusiness.externalReference` | resolves FK | N | **N** | |
| `buildingSumInsured` | `financial_details.buildingSumInsured` | N | Y | |
| `contentsSumInsured` | `financial_details.contentsSumInsured` | N | Y | |
| `collectExcess` | `financial_details.collectExcess` | N | Y | |
| `excess` | `financial_details.excess` | N | Y | |
| `autoApprovalApplies` | `auto_approval_applies` | N | Y | |
| `accommodationBenefitLimit` | `financial_details.accommodationBenefitLimit` | N | Y | |
| `maximumAccommodationDurationLimit` | `custom_data.maximumAccommodationDurationLimit` | N | Y | Mapper also accepts CW misspelling `maximumAccomodationDurationLimit`. |

### 3.5 Compliance / vulnerability / contention

| CW API field | DB destination | List | Detail | Notes |
|---|---|---|---|---|
| `vulnerableCustomer` | `vulnerable_customer` | N | Y | Compliance tab. |
| `vulnerabilityCategory` | `vulnerability_details.category` | N | Y | |
| `contentiousClaim` | `contentious_claim` | N | Y | Contract lists this twice; same field. |
| `contentiousActivityFlag` | `contentious_activity_flag` | N | Y | |
| `contentiousActivityDetails` | `contention_details.activityDetails` | N | Y | Shown when present. |

### 3.6 Contacts (`contacts[]`)

| CW API field | DB destination | List | Detail | Notes |
|---|---|---|---|---|
| `contacts[].id` | `api_payload` / payloads only | N | N | |
| `contacts[].firstName` | `contacts.first_name` | N | Y | Parties table (via `apiPayload.contacts`). |
| `contacts[].lastName` | `contacts.last_name` | N | Y | |
| `contacts[].email` | `contacts.email` | N | Y | |
| `contacts[].homePhone` | `contacts.home_phone` | N | Y | |
| `contacts[].mobilePhone` | `contacts.mobile_phone` | N | Y | |
| `contacts[].workPhone` | `contacts.work_phone` | N | Y | |
| `contacts[].externalReference` | `contacts.external_reference` | N | Y | |
| `contacts[].preferredMethodOfContact.name` | source_payload / payload | N | Y | “Preferred” column. |
| `contacts[].preferredMethodOfContact.externalReference` | resolves FK | N | **N** | Name only. |
| `contacts[].type.name` | source_payload / payload | N | Y | |
| `contacts[].type.externalReference` | resolves FK | N | **N** | Name only. |
| `contacts[].notes` | `contacts.notes` | N | Y | |

**UI note:** Parties reads contacts from `claim.apiPayload.contacts`, not from the joined `claim_contacts` / `contacts` tables. Values still appear when ingest stored the full payload.

### 3.7 Assignees (`assignees[]`)

| CW API field | DB destination | List | Detail | Notes |
|---|---|---|---|---|
| `assignees[].id` | payloads only | N | N | |
| `assignees[].externalReference` | `claim_assignees.external_reference` | N | Y | |
| `assignees[].name` | `claim_assignees.display_name` | N | Y | |
| `assignees[].email` | `claim_assignees.email` | N | Y | |
| `assignees[].type.name` | assignee_payload / payload | N | Y | |
| `assignees[].type.externalReference` | resolves FK | N | **N** | Name only. |

**UI note:** Same as contacts — Parties uses `apiPayload.assignees`, not the `claim_assignees` repository response.

### 3.8 Catch-all

| CW API field | DB destination | List | Detail | Notes |
|---|---|---|---|---|
| `customData` | `custom_data` (spread) + `api_payload` | N | **N** | No raw dump. Known keys (e.g. accommodation duration, CW updated) may appear elsewhere. |
| Unknown top-level CW keys | `custom_data.<key>` + `api_payload` | N | N | Lossless in DB; not rendered unless a dedicated UI binding exists. |

---

## 4. What the user does **not** see (focused list)

### 4.1 Business / location data stored but hidden

| Field | Stored? | User impact |
|---|---|---|
| **Latitude / longitude** | Yes (`address_*` columns + JSONB) | No map pin, no coords on Risk Location. |
| **Loss sub-type external reference** | Yes (FK + payload) | Loss type ref is shown; subtype ref is not. |
| **Unit / street number / street name as labeled rows** | Yes (JSONB) | Only composite “Address” string; harder to verify parsing errors. |

### 4.2 Technical identifiers stored but hidden

These are usually acceptable to hide from adjusters, but they matter for support/debug:

- All nested `.id` values on lookups, contacts, assignees
- `status.externalReference`, `account.externalReference`
- `claimDecision.externalReference`, `priority.externalReference`
- `policyType.externalReference`, `lineOfBusiness.externalReference`
- Contact/assignee type and preferred-method external refs

### 4.3 Intentionally not on the claim UI

| Field | Reason |
|---|---|
| `tenantId` | Not written to claim; tenancy is ambient. |
| Raw `customData` | Catch-all; selective keys only. |
| List view for most claim fields | Product choice — list is a finder, not a dossier. |

### 4.4 UI slots that are **not** CW Claim contract fields

Overview → “People & Assignments” shows:

- `claimConsultant`, `propertyAssessor`, `internalAuditor`, `desktopAssessor`, `technicalAssessor`, `brokerReference`, `hazardousWaste`

and Policy shows:

- `floodCoverage` / `floodCoverageFlag`

These are **not** top-level fields in §3.3.1. Assignee roles are meant to arrive as `assignees[].type` entries (contract notes list those five assessor types). The Overview rows often stay empty while Parties correctly lists assignees. Flood coverage is an extra payload key, not part of the Claim contract table.

---

## 5. List vs detail coverage

| Claim list column | CW / DB source |
|---|---|
| Claim # | `claimNumber` \|\| `externalReference` \|\| `id` |
| Status | `status.name` |
| Policy | `policyNumber` \|\| `policyName` |
| Address | formatted `address` / suburb fallback |
| Account | `account.name` |
| Lodged | `lodgementDate` |
| Updated | `updatedAt` (internal), not CW `updatedAtDate` |

Everything else from §3.3.1 is list-hidden by design.

---

## 6. DB capture gaps vs CW (brief)

Per `docs/mapping/claims.md`, there is **no substantive CW Claim field left unmapped**:

- Nested `.id` values: deliberately not promoted; retained in `api_payload`.
- `tenantId`: ignored on ingest by design.
- Full payload always in `api_payload` (lossless fallback).

Minor implementation nuances (not UI gaps):

- Frontend `Claim` TypeScript type omits some DB columns (`catCodeLookupId`, `claimDecisionLookupId`, `priorityLookupId`, `policyTypeLookupId`, `lineOfBusinessLookupId`, lat/long, `deletedAt`). Detail UI often reads names from `apiPayload` instead, so display still works when payload is present.
- Parties UI does not consume normalized child tables — if `api_payload` were stripped while child rows remained, Parties would look empty.

---

## 7. Recommendations (optional follow-ups)

Prioritised for “fields not shown to the user”:

1. **Show lat/long** on Risk Location (or a map link) if field staff need them — data is already in DB.
2. **Add “Loss sub-type ref”** next to “Loss type ref” for parity.
3. **Reconcile Overview People & Assignments** with `assignees[]` (derive role rows from assignee types) so Overview is not empty when Parties has data; remove or clearly mark non-contract fields (`floodCoverage`, `brokerReference`, `hazardousWaste`) unless product confirms they arrive in `customData`.
4. **Optional support mode:** reveal lookup external refs / CW nested IDs behind a “Technical details” disclosure for ops.
5. **Parties data source:** prefer API-joined contacts/assignees over `apiPayload` so UI matches normalized DB even if payload shape drifts.

---

## 8. Sources

| Artifact | Path |
|---|---|
| CW Claim contract | `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.1 |
| Mapping spec | `docs/mapping/claims.md` |
| Mapper | `apps/api/src/modules/external/mappers/crunchwork-claim.mapper.ts` |
| Schema | `apps/api/src/database/schema/index.ts` (`claims`, contacts, assignees) |
| Detail UI | `apps/frontend/src/components/claims/ClaimDetail.tsx` |
| List UI | `apps/frontend/src/components/claims/ClaimsListClient.tsx` |
| Frontend type | `apps/frontend/src/types/api.ts` (`Claim`) |
