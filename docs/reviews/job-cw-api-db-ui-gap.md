# Job object gap review — CW API ↔ DB ↔ UI

**Date:** 2026-08-11  
**Source contract:** `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.2 Job and §3.3.3 Job (when included in Claim) (v17, exported 2026-03-04)  
**Internal mapping:** `docs/mapping/jobs.md`  
**DB:** `jobs`, `job_contacts`, `contacts`, `appointments`, `appointment_attendees` (`apps/api/src/database/schema/index.ts`)  
**UI:** `apps/frontend/src/components/jobs/` (`JobDetail.tsx`, `JobOverviewTab.tsx`, type panels, `JobPartiesTab.tsx`, `JobsListClient.tsx`, `JobHeader.tsx`)  
**Companion claim review:** `docs/reviews/claim-cw-api-db-ui-gap.md`

**Goal:** Identify which Job fields from the Crunchwork Insurance REST API are captured in our database and which are (or are not) shown to the user.

---

## 1. Executive summary

| Layer | Verdict |
|---|---|
| **Schema + mapping doc** | Full §3.3.2 surface designed: columns, JSONB buckets, and child tables. |
| **CW → DB mapper** | **Complete for §3.3.2 promotions** (as of 2026-08-11). Columns, JSONB buckets, and `job_contacts` are populated; `appointments[]` remain owned by the appointment mapper. Full payload always in `api_payload`. |
| **DB → UI (detail)** | Strong *display* coverage via `apiPayload` / JSONB fallthroughs for core, vendor, TA/specialist/rectification/audit, and contacts. Gaps are mostly technical IDs/refs, address parts as labeled rows, mobility chips when not promoted, and appointments as a first-class list on the job page. |
| **DB → UI (list)** | Intentionally thin — seven columns. |
| **Editability** | Create drawer covers a subset of scalars + address + contacts. Detail edit covers assignee + booked/attendance dates (`customData`) only. Most CW Job fields are read-only in UI. |

**Primary answer — fields not shown (or weakly shown) to the user on job detail:**

1. Nested lookup **IDs** (`jobType.id`, `status.id`, `vendor.id`, `contacts[].id`, `originalJobType.id`, appointment/attendee IDs)
2. Several nested **external references** shown only as names (`jobType` / `status` / specialist / audit / originalJobType / contact type & preferred-method refs)
3. Address **unit / street number / street name** as discrete labeled rows (folded into formatted address)
4. `tenantId` (ignored on ingest by design)
5. Raw `customData` dump (selective keys only)
6. **`appointments[]`** as an embedded job-detail list (live in `api_payload` / appointments module; not a job Overview panel)
7. **`mobilityConsiderations`** when only present in `api_payload` (panel reads the promoted column, which the stub mapper does not fill)
8. Slim §3.3.3 jobs nested under Claim — not materialised as job rows (claim payload only)

**Note:** Job mapper promotions were completed after the initial review draft; re-ingest (or new CW events) is required for existing rows to pick up promoted columns.

---

## 2. Legend

| Symbol | Meaning |
|---|---|
| **Y** | Captured / shown |
| **P** | Partial (name only, composite display, or available only via `api_payload` until mapper expands) |
| **N** | Not captured / not shown |
| **B** | Schema ready; mapper backlog (lossless only in `api_payload`) |

UI surfaces:

- **List** — jobs table (`JobsListClient`)
- **Detail** — header + Overview / Type Details / Parties (and related tabs)

---

## 3. Field matrix (CW Job §3.3.2)

### 3.1 Identity, claim links, timestamps

| CW API field | DB destination (target) | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `id` | `external_reference` | Y | P | Y | Detail “External reference”. List fallback label. |
| `externalReference` | `custom_data.insurerExternalReference` / later `external_job_id` | B (`api_payload` only) | N | P | Shown as “Insurer reference” when found in `customData` or `api.externalReference`. |
| `claimId` | `claim_id` | Y | N | Y | Link to parent claim. |
| `parentClaimId` | `parent_claim_id` | B | N | P | Shown when present and ≠ `claimId`. |
| `updatedAtDate` | `custom_data.cwUpdatedAtDate` | B | N | P | “Crunchwork updated” when in payload/customData. |
| `tenantId` | ignored | N | N | N | Ambient tenancy. |
| nested `claim` | Claim mapper / extractor | P | N | P | Parent Claim card uses joined claim + payload fallthrough. |

### 3.2 Lookups — job type & status

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `jobType.id` | `api_payload` only | P | N | N | |
| `jobType.name` | via `job_type_lookup_id` | P (name via join if FK set) | Y | Y | |
| `jobType.externalReference` | resolves FK | Y | N | N | Required for ingest; not displayed as text. |
| `status.id` | `api_payload` only | P | N | N | |
| `status.name` | via `status_lookup_id` | B | Y | Y | UI falls back to `apiPayload.status.name`. |
| `status.externalReference` | resolves FK | B | N | N | |

### 3.3 Address

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `address.unitNumber` | `address` JSONB | B | P | P | Folded into formatted address. |
| `address.streetNumber` | `address` JSONB | B | P | P | Same. |
| `address.streetName` | `address` JSONB | B | P | P | Same. |
| `address.suburb` | JSONB + `address_suburb` | B | P | Y | |
| `address.postcode` | JSONB + `address_postcode` | B | P | Y | |
| `address.state` | JSONB + `address_state` | B | P | Y | |
| `address.country` | JSONB + `address_country` | B | P | Y | |
| `address.latitude` | `address.latitude` JSONB only | B | N | P | Shown as “Coordinates” when present on `job.address`. |
| `address.longitude` | `address.longitude` JSONB only | B | N | P | Same. No map embed on job Overview (unlike claim). |

For CW-ingested jobs under the stub mapper, address often lives only in `api_payload.address`. Overview reads `job.address` / promoted columns first — **CW jobs may show empty Risk Location until mapper backlog is done**, even though the payload has the address (unless something else hydrates `address`).

### 3.4 Core scalars

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `requestDate` | `request_date` | B | Y | Y | Header + Overview. Empty for stub-ingested CW jobs unless backfilled. |
| `collectExcess` | `collect_excess` | B | N | Y | Vendor-tenancy field per contract. |
| `excess` | `excess` | B | N | Y | Header when set; Overview. |
| `makeSafeRequired` | `make_safe_required` | B | N | Y | Summary card + Overview. |
| `jobInstructions` | `job_instructions` | B | N | Y | HTML Instructions card. Stub → often empty unless create path set it. |

### 3.5 Vendor

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `vendor.id` | resolves `vendor_id` (stub uses id) | P | N | N | |
| `vendor.name` | `vendor_snapshot.name` + join | B / P | N | Y | Vendor section when any vendor field present. |
| `vendor.externalReference` | target FK key | B | N | Y | |
| full `vendor` object | `vendor_snapshot` | B | N | P | Phone / after-hours / email shown from snapshot or `api.vendor` (Vendor contract extras, not Job table fields). |

### 3.6 Temporary Accommodation (job-type conditional)

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `emergency` | `temporary_accommodation_details` | B | N | Y* | Type Details → TA panel (`api` ∪ bucket). |
| `habitableProperty` | same | B | N | Y* | |
| `estimatedStayStartDate` | same | B | N | Y* | |
| `estimatedStayEndDate` | same | B | N | Y* | |
| `numberOfAdults` | same | B | N | Y* | |
| `numberOfChildren` | same | B | N | Y* | |
| `numberOfBedrooms` | same | B | N | Y* | |
| `numberOfCots` | same | B | N | Y* | |
| `numberOfVehicles` | same | B | N | Y* | |
| `petsInformation` | same | B | N | Y* | |
| `mobilityConsiderations[]` | `mobility_considerations` | B | N | **P / N** | Chips only if `job.mobilityConsiderations` is non-empty — **does not** fall back to `apiPayload`. Stub → often hidden. |
| `mobilityConsiderations[].name` | array element | B | N | P | Chip label. |
| `mobilityConsiderations[].externalReference` | array element | B | N | P | Used as key / fallback label. |

\*Shown when Type Details tab is active for TA job types and data is in bucket or `apiPayload`.

**Not Job-contract fields but shown on TA panel:** `accommodationBenefitLimit`, `maximumAccommodationDurationLimit` (Claim §3.3.1). Panel reads job `api`/`details` only — **does not join parent claim**, so these often show “—” even when the claim has them.

### 3.7 Specialist (job-type conditional)

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `isSpecificSpecialistRequired` | `specialist_details` | B | N | Y* | |
| `specialistCategory.name` | same | B | N | Y* | |
| `specialistCategory.externalReference` | same | B | N | N | Name preferred. |
| `specialistReport.name` | same | B | N | Y* | |
| `specialistReport.externalReference` | same | B | N | N | |
| `specialistBusinessName` | same | B | N | Y* | When specific specialist required. |
| `locationOfDamage` | same | B | N | Y* | |
| `typeOfDamage` | same | B | N | Y* | |

### 3.8 Rectification (job-type conditional)

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `originalJobReference` | `rectification_details` | B | N | Y* | |
| `originalJobType.id` | ignored / payload | P | N | N | |
| `originalJobType.name` | bucket | B | N | Y* | |
| `originalJobType.externalReference` | bucket | B | N | N | |
| `paidJob` | bucket | B | N | Y* | |

### 3.9 Internal Audit (job-type conditional)

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `auditType.name` | `audit_details` | B | N | Y* | |
| `auditType.externalReference` | same | B | N | N | |

### 3.10 Contacts (`contacts[]`)

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `contacts[].id` | payloads only | P | N | N | |
| `contacts[].firstName` / `lastName` | `contacts.*` | B | N | Y | Parties tab via `apiPayload.contacts`. |
| `contacts[].email` | `contacts.email` | B | N | Y | |
| `contacts[].homePhone` / `mobilePhone` / `workPhone` | columns | B | N | Y | Detail drawer / phones. |
| `contacts[].externalReference` | `contacts.external_reference` | B | N | N* | Not a Parties table column (*may appear in contact drawer). |
| `contacts[].type.name` | source_payload / payload | B | N | Y | |
| `contacts[].type.externalReference` | FK | B | N | N | |
| `contacts[].preferredMethodOfContact.name` | source_payload | B | N | Y | |
| `contacts[].preferredMethodOfContact.externalReference` | FK | B | N | N | |
| `contacts[].notes` | `contacts.notes` | B | N | P | Drawer / detail, not main table column. |

Parties reads **`apiPayload.contacts`**, not `job_contacts` joins — same pattern as claims.

### 3.11 Appointments (`appointments[]`)

| CW API field | DB destination | Mapper today | List | Detail | Notes |
|---|---|---|---|---|---|
| `appointments` (list) | `api_payload` + `appointments` table via appointment mapper | P | N | **N** on job Overview | No dedicated “Appointments” list on job detail; schedule drawer can create appointments. Full contract is a separate entity (`docs/mapping/appointments.md`). |

### 3.12 Catch-all / non-contract UI fields

| Field | Source | List | Detail | Notes |
|---|---|---|---|---|---|
| `customData` / unknown keys | target `custom_data` + always `api_payload` | N | N | No dump. |
| `assignedToUserId` / `assigneeName` | internal | Y | Y | Editable on detail. Not CW §3.3.2. |
| `contactDate`, `bookedDate`, `attendanceDueDate`, `attendanceDate`, `completedDate` | `customData` / `apiPayload` | N | Y | Booked/attendance editable. Not in Job contract table. |
| `autoApproval` / `autoApprovalApplies` | api/custom (claim-ish) | N | Y | Not Job §3.3.2. |
| `vendorJobNumber` | api | N | P | Shown when present. Not Job §3.3.2. |
| `provider` | derived | N | Y | Internal vs Crunchwork. |
| `parent_job_id` | internal hierarchy | N | P | Shown when set. Not CW. |
| `name` | internal / create | Y | Y | Not CW Job identity field (`id` / `externalReference` are). |

---

## 4. What the user does **not** see (focused list)

### 4.1 Business data stored (or in payload) but hidden / weak

| Field / area | Issue |
|---|---|
| **Address on stub-ingested CW jobs** | Mapper does not promote `address`; Overview prefers columns/`job.address` over `api.address` → risk location can look empty. |
| **Mobility considerations** | Panel ignores `apiPayload.mobilityConsiderations` when column is `[]`. |
| **Claim accommodation limits on TA panel** | Shown as job fields but not joined from parent claim. |
| **Appointments list** | Contract field on Job; not rendered as a job-detail section. |
| **Unit / street parts as labels** | Composite address only. |
| **Coordinates** | Text when on `job.address`; no map widget on job page. |

### 4.2 Technical identifiers hidden (acceptable for most users)

- All nested `.id` values  
- `jobType.externalReference`, `status.externalReference`  
- Specialist / audit / originalJobType external refs (names shown)  
- Contact type / preferred-method external refs  
- `tenantId`

### 4.3 Intentionally not on job UI

| Field | Reason |
|---|---|
| `tenantId` | Ambient. |
| Raw `customData` | Catch-all. |
| Most fields on list view | Finder UX. |
| Slim §3.3.3 nested jobs under Claim | Not projected to `jobs`; remain in `claims.api_payload`. |

---

## 5. List vs detail coverage

| Job list column | Source |
|---|---|
| Job Ref | `name` \|\| `externalJobId` \|\| `externalReference` \|\| `id` |
| Status | `status.name` |
| Type | `jobType.name` |
| Assigned | `assigneeName` |
| Address | formatted `address` / suburb |
| Requested | `requestDate` |
| Updated | `updatedAt` (internal) |

Everything else from §3.3.2 is list-hidden by design.

**Header (`JobPageHeader`):** title, status, type, address, claim link, request date, updated, excess (if set), make-safe flag.

---

## 6. DB capture gaps vs CW

| Category | Status |
|---|---|
| Lossless `api_payload` | Always written |
| Promoted columns / JSONB buckets / `job_contacts` | **Mostly backlog** (`docs/mapping/jobs.md` §10) |
| Nested `.id` | Deliberately not promoted |
| `tenantId` | Ignored by design |
| `parent_job_id` | Internal-only; never from CW |
| §3.3.3 slim jobs on Claim | Not materialised as `jobs` rows |

Frontend `Job` type is largely aligned with the schema; missing vs DB: `syncStatus`, `sourceTenantId`, `sourceOrganisationId`, `sourceExternalReference`, `deletedAt` (cross-tenant / housekeeping — not CW Job contract fields).

---

## 7. Editability snapshot

| Surface | Editable CW / job fields |
|---|---|
| Create (`JobFormDrawer`) | `name`, `jobTypeLookupId`, `jobInstructions`, `makeSafeRequired`, `excess`, address parts, `assignedToUserId`, contacts (+ filesystem template / provider) — **not** full §3.3.2 conditional buckets |
| Detail edit mode | `assignedToUserId`, `bookedDate`, `attendanceDate` only |
| Parties | Add/remove contacts (payload-driven) |
| Archive | Status → archived (list/header) |

---

## 8. Recommendations (optional follow-ups)

Prioritised for “fields not shown / not usable”:

1. **Finish `CrunchworkJobMapper` promotions** (address, status, scalars, vendor_snapshot, type JSONB buckets, contacts, `custom_data`) so Detail stops depending on fragile `apiPayload` fallthroughs — highest leverage gap vs Claim.
2. **TA panel:** fall back mobility from `apiPayload`; join parent claim for accommodation benefit/duration limits.
3. **Risk Location:** also read `apiPayload.address` when `job.address` is empty (until mapper backlog lands).
4. **Optional Location map** on job Overview (reuse `LocationMap`, same as claim).
5. **Appointments:** surface job-linked appointments on detail (or clear CTA into schedule), since they are part of the Job contract.
6. **Support disclosure** for lookup external refs / CW IDs if ops need them.

---

## 9. Sources

| Artifact | Path |
|---|---|
| CW Job contract | `docs/Insurance REST API-v17-20260304_100318.pdf` §3.3.2 / §3.3.3 |
| Mapping spec | `docs/mapping/jobs.md` |
| Mapper (stub) | `apps/api/src/modules/external/mappers/crunchwork-job.mapper.ts` |
| Schema | `apps/api/src/database/schema/index.ts` (`jobs`, contacts, appointments) |
| Detail UI | `apps/frontend/src/components/jobs/JobDetail.tsx`, `tabs/JobOverviewTab.tsx`, `tabs/JobTypePanels/*`, `tabs/JobPartiesTab.tsx` |
| List / header | `JobsListClient.tsx`, `JobHeader.tsx` |
| Frontend type | `apps/frontend/src/types/api.ts` (`Job`) |
