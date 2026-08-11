# 03 — Crunchwork Report Type Schemas

## Purpose

Document how the CW Insurance REST API exposes **report type schemas**, the mechanism for discovering available types, and how this maps to the local `assessments` / `reports` entities.

---

## 1. API surface

### 1.1 Get schema for a single report type

```
GET /report-types/{id}/schema
```

| Parameter | Location | Description |
|---|---|---|
| `id` | path | CW UUID of the **report type** (not the report instance) |

**Response:** `ReportTypeSchema`

### 1.2 Discover available report types

The Insurance REST API v17 does **not** expose a `GET /report-types` list endpoint.

Report type IDs are discovered indirectly:

| Method | Source |
|---|---|
| Read existing reports | `GET /jobs/{id}/reports` or `GET /reports/{id}` → each report carries `reportType { id, name, externalReference }` |
| Create a report | `POST /reports` requires `reportType.externalReference`; CW returns `404 ReportTypeIdNotFound` if invalid |
| Configuration knowledge | Tenant-specific; CW admin configures which report types exist. Known types from the v17 examples: **Field Assessment** |

**Implication:** To enumerate all report types programmatically, you must either:
1. Query CW reports across jobs and collect distinct `reportType` values, or
2. Maintain a seeded list of known `externalReference` values and attempt `GET /report-types/{id}/schema` for each.

### 1.3 Report CRUD (for context)

| Endpoint | Method | Action | Team |
|---|---|---|---|
| `POST /reports` | POST | Create | Vendor |
| `POST /reports/{id}` | POST | Update | Vendor |
| `GET /reports/{id}` | GET | Read | Insurance / Vendor (Phase 2) |
| `GET /jobs/{id}/reports` | GET | List by job | Insurance (Phase 2) |

On **create**, CW validates `customData` against the report type's schema. Returns `ReportTypeSchemaValidationError` on failure.

---

## 2. `ReportTypeSchema` shape

Source: Swagger `#/components/schemas/ReportTypeSchema`

```json
{
  "reportType": {
    "id": "UUID",
    "name": "Field Assessment",
    "externalReference": "Field Assessment"
  },
  "tenantId": "UUID",
  "fields": {
    "<fieldName>": {
      "type": "String | Boolean | Float | Int | List<String> | ImageSelect",
      "required": true | false,
      "readonly": true | false,
      "options": [{ "value": "...", "label": "..." }],
      "minValue": 0,
      "maxValue": 100,
      "date": true | false,
      "time": true | false,
      "datetime": true | false,
      "validationLogic": "expression",
      "validationRegex": "pattern",
      "format": "format hint"
    }
  }
}
```

### Field type semantics

| `type` | JSON value in `customData` | Notes |
|---|---|---|
| `String` | `"value"` | May be constrained by `options`, `date`, `validationRegex` |
| `Boolean` | `true` / `false` | |
| `Float` | `123.45` | `minValue` / `maxValue` may apply |
| `Int` | `123` | `minValue` / `maxValue` may apply |
| `List<String>` | `["a", "b"]` | Multi-select; valid values in `options` |
| `ImageSelect` | *(undocumented)* | Likely image-picker UI; treat as string/URI |

### Field metadata

| Property | Purpose |
|---|---|
| `required` | Validation fails if field missing from `customData` |
| `readonly` | Field is CW-calculated; do not send on create/update |
| `options` | Enum constraint (`value`/`label` pairs) |
| `minValue` / `maxValue` | Range constraint for numeric fields |
| `date` / `time` / `datetime` | String field is an ISO 8601 date/time/datetime |
| `validationLogic` | CW-internal expression-based validation |
| `validationRegex` | Regex the value must match |
| `format` | Display/parsing hint |

---

## 3. Known report type: Field Assessment

From PDF §3.3.14 example `customData` (illustrative — real schema comes from the endpoint):

### Field Assessment `customData` fields (v17 example)

| Key | Type | UI equivalent in local `assessments` |
|---|---|---|
| `policyName` | String | *(claim context — not on assessment form)* |
| `policyNumber` | String | *(claim context)* |
| `claimNumber` | String | *(claim context)* |
| `requestDate` | String (date) | *(job context)* |
| `address` | String | *(job context)* |
| `addressAttended` | Boolean | *(not on assessment — could add)* |
| `otherAddress` | String | *(not on assessment)* |
| `siteAttendanceOrVaDateTime` | String (datetime) | `dateBooked` (approximate) |
| `personsParticipatingInAttendance` | String | *(not on assessment)* |
| `builderEstimatorName` | String | *(not on assessment — could populate from user)* |
| `builderEstimatorPhoneNumber` | String | *(not on assessment)* |
| `insuranceAssessorAttended` | Boolean | `iagInspectionRequired` (semantic cousin) |
| `insuranceAssessorName` | String | *(not on assessment)* |
| `insuranceAssessorPhoneNumber` | String | *(not on assessment)* |
| `occupancyType` | String | *(not on assessment — habitable is closest)* |
| `furnitureRemovalStorage` | Boolean | *(not on assessment)* |
| `customerArrangedRepairs` | Boolean | *(not on assessment)* |
| `arrangedRepairComments` | String | *(not on assessment)* |
| `houseM2` | Float | `squareMetres` |
| `estimatedBuildYear` | String | `buildingAge` (needs conversion) |
| `buildingType` | String | `buildingType` |
| `designType` | String | `designType` |
| `constructionType` | String | `construction` |
| `roofType` | String | `roofType` |
| `mainHouseRoofDamage` | Boolean | `mainRoofDamage` |
| `habitable` | Boolean | `habitable` |
| `unihabitablePropertyReason` | String | *(not on assessment — could derive)* |
| `otherUnihabitableReason` | String | *(not on assessment)* |
| `safetyHazards` | String | `hazardPoolFencing`, `hazardElectricalGas`, `hazardSewerage`, `hazardStructural`, `hazardOther` (structured → flattened) |
| `environmentalHazards` | String | `mould`, `asbestosOnSite` (structured → flattened) |
| `additionalStructures` | String | `detachedGarage`, `sheds`, `swimmingPool`, `detachedGrannyFlat` (structured → flattened) |
| `otherStructures` | String | *(free text — derive from above)* |
| `dateOfLoss` | String (date) | *(claim context)* |
| `makeSafeRequired` | Boolean | `makeSafe` |
| `dateMakeSafeCompleted` | String (date) | `makeSafeCompletionDate` |
| `clientDiscussions` | String | `clientDiscussion` |
| `confirmLossType` | String | *(claim context)* |
| `damageObserved` | String | `resultantDamage` |
| `hasDamageCausedByEventCoveredByPolicy` | String | `damageCausedByListedEvent` (boolean → "Yes"/"No") |
| `causeOfDamage` | String | `causeOfDamage` |
| `preExistingMaintenanceIssues` | Boolean | *(derive from `maintenanceRelatedIssues` non-empty)* |
| `preExistingRelateDamage` | String | *(not on assessment)* |
| `maintainanceDefectIssues` | String | `maintenanceRelatedIssues` |
| `worksRequiredToAddressRelatedDamage` | String | *(not on assessment — could add)* |
| `costEstimateForRepairs` | Float | *(not on assessment — could add)* |
| `claimRecommendation` | String | `claimRecommendation` |
| `estimatedRepairTime` | Int | *(not on assessment — could add)* |
| `estimatedRepairDuration` | String | *(not on assessment — "Days"/"Weeks")* |
| `hasInsuredAdvised` | Boolean | *(not on assessment)* |
| `propertyCondition` | Boolean | `overallConditionAcceptable` |
| `clientWillingToProceed` | Boolean | *(not on assessment)* |
| `temporaryAccommodationOrLossOfRentRequired` | String | `tempAccomRequiredImmediately` / `tempAccomRequiredDuringRepairs` (structured → enum) |
| `tempAccommodationEstimatedAmount` | Float | *(not on assessment — days only)* |
| `tempAccommodationEstimatedDuration` | String | `tempAccomImmediateEstimateDays` / `tempAccomRepairsEstimateDays` (int → "X Days") |
| `specialistRequired` | Boolean | *(not on assessment — could add)* |
| `specialistType` | String | *(not on assessment)* |
| `specialNotes` | String | `comments` (approximate) |
| `conclusion` | String | `variancesOfScope` (approximate) |
| `builderLicenses` | String | *(not on assessment)* |

---

## 4. Strategy: fetching all report type schemas

Since CW has no list endpoint, use this approach:

### Step 1 — Collect known report type IDs

```sql
SELECT DISTINCT
  (api_payload->'reportType'->>'id') AS cw_report_type_id,
  (api_payload->'reportType'->>'name') AS cw_report_type_name,
  (api_payload->'reportType'->>'externalReference') AS cw_report_type_ext_ref
FROM reports
WHERE api_payload->'reportType'->>'id' IS NOT NULL
ORDER BY cw_report_type_name;
```

### Step 2 — Fetch each schema

For each distinct `cw_report_type_id`:

```typescript
const schema = await crunchworkService.getReportTypeSchema({
  connectionId,
  reportTypeId: cwReportTypeId,
});
```

### Step 3 — Store locally

Options:
- Store raw schema JSON in `lookup_values.metadata` (domain = `report_type`, key = the CW report type `externalReference`)
- Or: dedicated `report_type_schemas` table / JSONB column on an existing config table
- Cache with TTL since tenant admin can reconfigure fields

### Script outline

```typescript
// scripts/fetch-report-type-schemas.ts
// 1. Connect to DB, load active CW connection
// 2. Query reports table for distinct reportType IDs
// 3. For each, call GET /report-types/{id}/schema
// 4. Pretty-print / persist results
```

---

## 5. Assessment → Report publish mapping

When the local `assessment` is submitted/published, transform to CW Report `customData`:

```typescript
function assessmentToReportCustomData(
  assessment: Assessment,
  job: Job,
  claim: Claim,
): Record<string, unknown> {
  return {
    // Claim context (auto-populated, not from form)
    policyName: claim.policyName,
    policyNumber: claim.policyNumber,
    claimNumber: claim.claimNumber,
    requestDate: job.requestDate,
    address: formatAddress(job.address),
    dateOfLoss: claim.dateOfLoss,
    confirmLossType: claim.lossType?.name,

    // Assessment form fields → CW schema keys
    siteAttendanceOrVaDateTime: assessment.dateBooked,
    houseM2: assessment.squareMetres ? Number(assessment.squareMetres) : undefined,
    estimatedBuildYear: assessment.buildingAge?.toString(),
    buildingType: assessment.buildingType,
    designType: assessment.designType,
    constructionType: assessment.construction,
    roofType: assessment.roofType,
    mainHouseRoofDamage: assessment.mainRoofDamage,
    habitable: assessment.habitable,
    makeSafeRequired: assessment.makeSafe,
    dateMakeSafeCompleted: assessment.makeSafeCompletionDate,
    clientDiscussions: assessment.clientDiscussion,
    damageObserved: assessment.resultantDamage,
    hasDamageCausedByEventCoveredByPolicy: assessment.damageCausedByListedEvent ? 'Yes' : 'No',
    causeOfDamage: assessment.causeOfDamage,
    preExistingMaintenanceIssues: !!assessment.maintenanceRelatedIssues,
    maintainanceDefectIssues: assessment.maintenanceRelatedIssues,
    claimRecommendation: assessment.claimRecommendation,
    propertyCondition: assessment.overallConditionAcceptable,

    // Structured → flattened
    safetyHazards: buildSafetyHazardsString(assessment),
    environmentalHazards: buildEnvironmentalHazardsString(assessment),
    additionalStructures: buildAdditionalStructuresString(assessment),

    // Temporary accommodation
    temporaryAccommodationOrLossOfRentRequired: deriveAccommodationEnum(assessment),
    tempAccommodationEstimatedDuration: deriveDurationString(assessment),

    // Free-text
    specialNotes: assessment.comments,
    conclusion: assessment.variancesOfScope,
  };
}
```

The actual keys must be validated against the live schema (Step 2) before publish, since tenant configuration may differ from the v17 example.

---

## 6. Gaps in local `assessments` entity

Fields present in the v17 Field Assessment `customData` but **missing** from the local assessment form:

| CW field | Suggested addition | Priority |
|---|---|---|
| `addressAttended` | Boolean — "Was the risk address attended?" | Medium |
| `personsParticipatingInAttendance` | Text | Medium |
| `builderEstimatorName` / `Phone` | Auto-populate from logged-in user profile | Low (derive) |
| `insuranceAssessorName` / `Phone` | Text fields (if assessor attended) | Medium |
| `occupancyType` | Select: Vacant / Occupied / Partially Occupied | Medium |
| `furnitureRemovalStorage` | Boolean | Low |
| `customerArrangedRepairs` / `arrangedRepairComments` | Boolean + Text | Medium |
| `worksRequiredToAddressRelatedDamage` | Text | Medium |
| `costEstimateForRepairs` | Numeric | High |
| `estimatedRepairTime` + `estimatedRepairDuration` | Int + Select (Days/Weeks/Months) | High |
| `hasInsuredAdvised` | Boolean | Medium |
| `clientWillingToProceed` | Boolean | Medium |
| `specialistRequired` / `specialistType` | Boolean + Text | Medium |
| `builderLicenses` | Text | Low |

These can be added incrementally; the mapper should skip `undefined` keys and CW will accept partial `customData` (only `required: true` fields cause validation failure).

---

## 7. Implementation recommendations

1. **Write a `fetch-report-type-schemas.ts` script** (similar pattern to `fetch-group-label-ids.ts`) to query the DB for known report type IDs, call the CW schema endpoint for each, and persist the result.
2. **Schema-driven form generation is optional** — the local `assessments` table has a fixed schema that is a curated subset. The CW schema is needed for *validation before publish*, not for driving the UI.
3. **Validate on submit** — when assessment status transitions to `submitted`, load the live CW schema for Field Assessment, transform the assessment to `customData`, validate required fields, then call `POST /reports` (or `POST /reports/{id}` for updates).
4. **Store report type metadata** in `lookup_values` with `domain = 'report_type'` and `metadata.cwSchema = { ... }` so the mapper can access field definitions without a live API call on every publish.
5. **Refresh periodically** — schemas can change when CW admin reconfigures; a nightly or on-demand refresh keeps the cache current.
