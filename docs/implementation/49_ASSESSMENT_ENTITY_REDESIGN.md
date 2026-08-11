# 49 — Assessment Entity Redesign (Field Assessment Report Coverage)

## Objective

Redesign the `assessments` table to guarantee **100 % coverage** of the Crunchwork Field Assessment Report `customData` schema when combined with data from the parent `jobs` and `claims` rows. The new schema uses **JSONB section columns** instead of fixed scalar columns to insulate the table from upstream report-schema changes.

---

## Context

### Current state

- `assessments` table has ~40 fixed boolean/text/numeric columns.
- Covers ~60 % of the CW Field Assessment `customData` keys.
- Missing: attendance context, assessor details, occupancy, furniture removal, customer-arranged repairs, cost estimate, repair time, insured-advised, client-willing, specialist referral, uninhabitable reasons, builder licences.
- Rigid schema — any CW schema change requires a migration.

### Target state

- `assessments` stores site-observation data in JSONB section buckets.
- At publish time, a mapper merges assessment + job + claim into 100 % of report `customData`.
- UI driven by section-based forms matching the JSONB buckets.
- CW schema changes handled by updating mapper + UI, not DB migrations.

### Reference

- **CW Insurance REST API v17 §3.3.14** — Report contract & Field Assessment example
- **`GET /report-types/{id}/schema`** — runtime schema with field definitions
- **`docs/design/03_REPORT_TYPE_SCHEMAS.md`** — full field inventory & mapping analysis

---

## 1. Data ownership model

Every Field Assessment report field has exactly one **owner** at publish time:

| Owner | Responsibility | Storage |
|---|---|---|
| **Claim** | Policy / loss / identity context | `claims` table (existing) |
| **Job** | Address, request date, appointments, assignees, make-safe-required (allocation flag) | `jobs` table (existing) |
| **Assessment** | Site observations, findings, recommendations | `assessments` table (redesigned) |

The publish mapper assembles all three. The assessment never duplicates claim/job data.

### Owner allocation (all v17 Field Assessment keys)

#### From Claim (8 fields — no assessment storage needed)

| CW key | Claim source |
|---|---|
| `policyName` | `claims.policy_name` |
| `policyNumber` | `claims.policy_number` |
| `claimNumber` | `claims.claim_number` |
| `dateOfLoss` | `claims.date_of_loss` |
| `confirmLossType` | Loss-type lookup name |
| `address` | `claims.address` (formatted) — or job address |
| `requestDate` | `jobs.request_date` (via job) |
| `makeSafeRequired` | `jobs.make_safe_required` (allocation flag) |

#### From Job / appointments (3 fields — derived at publish)

| CW key | Job source |
|---|---|
| `siteAttendanceOrVaDateTime` | Attendance appointment `start_date`, or `jobs.custom_data.attendanceDate` |
| `personsParticipatingInAttendance` | Appointment attendees + job contacts (names joined) |
| `builderEstimatorName` / `Phone` | Assignee user profile or `jobs.vendor_snapshot` |

#### From Assessment (remaining ~35+ fields — all stored here)

Everything observed on site, plus assessor details and recommendations.

---

## 2. New `assessments` table schema

### Design principles

1. **JSONB section columns** — one per logical form section. Each stores a `Record<string, unknown>` whose keys match CW `customData` field names where possible.
2. **Promoted scalars** — only identity/workflow columns (`id`, `tenant_id`, `job_id`, `name`, `status`) are scalar. Everything else is JSONB.
3. **Forward-compatible** — new CW fields land in the appropriate section JSONB without a migration.
4. **Section list is stable** — CW report structure has logical groupings that rarely change; the sections mirror these groupings.

### DDL (Drizzle schema)

```typescript
export const assessments = pgTable(
  'assessments',
  {
    // Identity & workflow
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    status: text('status').notNull().default('draft'),
    reportExternalReference: text('report_external_reference'),  // CW report id once published

    // JSONB section columns
    attendance: jsonb('attendance').notNull().default({}),
    building: jsonb('building').notNull().default({}),
    habitability: jsonb('habitability').notNull().default({}),
    hazards: jsonb('hazards').notNull().default({}),
    damage: jsonb('damage').notNull().default({}),
    makeSafe: jsonb('make_safe').notNull().default({}),
    temporaryAccommodation: jsonb('temporary_accommodation').notNull().default({}),
    specialists: jsonb('specialists').notNull().default({}),
    recommendation: jsonb('recommendation').notNull().default({}),
    extras: jsonb('extras').notNull().default({}),  // catch-all for tenant-specific/future fields

    // Audit
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_assessment_status', sql`status IN ('draft','in_progress','submitted','published','archived')`),
    index('idx_assessments_tenant').on(t.tenantId, t.status),
    index('idx_assessments_job').on(t.jobId),
  ],
);
```

### Section → CW `customData` key mapping

#### `attendance` — site visit context

| JSONB key | CW key | Type | Notes |
|---|---|---|---|
| `addressAttended` | `addressAttended` | boolean | Was the risk address attended? |
| `otherAddress` | `otherAddress` | string | If different address |
| `siteAttendanceDate` | `siteAttendanceOrVaDateTime` | string (datetime) | Override; falls back to job appointment |
| `personsAttending` | `personsParticipatingInAttendance` | string | |
| `builderEstimatorName` | `builderEstimatorName` | string | Auto-populate from user |
| `builderEstimatorPhone` | `builderEstimatorPhoneNumber` | string | |
| `insuranceAssessorAttended` | `insuranceAssessorAttended` | boolean | |
| `insuranceAssessorName` | `insuranceAssessorName` | string | |
| `insuranceAssessorPhone` | `insuranceAssessorPhoneNumber` | string | |
| `occupancyType` | `occupancyType` | string | Vacant / Occupied / Partially |

#### `building` — property structure

| JSONB key | CW key | Type |
|---|---|---|
| `houseM2` | `houseM2` | number |
| `estimatedBuildYear` | `estimatedBuildYear` | string |
| `buildingType` | `buildingType` | string |
| `designType` | `designType` | string |
| `constructionType` | `constructionType` | string |
| `roofType` | `roofType` | string |
| `mainHouseRoofDamage` | `mainHouseRoofDamage` | boolean |
| `additionalStructures` | `additionalStructures` | string |
| `otherStructures` | `otherStructures` | string |
| `propertyCondition` | `propertyCondition` | boolean |
| `furnitureRemovalStorage` | `furnitureRemovalStorage` | boolean |

#### `habitability` — livability assessment

| JSONB key | CW key | Type |
|---|---|---|
| `habitable` | `habitable` | boolean |
| `uninhabitableReason` | `unihabitablePropertyReason` | string |
| `otherUninhabitableReason` | `otherUnihabitableReason` | string |

#### `hazards` — safety & environmental

| JSONB key | CW key | Type |
|---|---|---|
| `safetyHazards` | `safetyHazards` | string |
| `environmentalHazards` | `environmentalHazards` | string |
| `hazardDetails` | *(local structured)* | object | `{ poolFencing, electrical, sewerage, structural, other }` with boolean + comment pairs |

#### `damage` — cause & observations

| JSONB key | CW key | Type |
|---|---|---|
| `damageObserved` | `damageObserved` | string |
| `causeOfDamage` | `causeOfDamage` | string |
| `hasDamageCoveredByPolicy` | `hasDamageCausedByEventCoveredByPolicy` | string ("Yes"/"No"/"Partial") |
| `preExistingMaintenanceIssues` | `preExistingMaintenanceIssues` | boolean |
| `preExistingRelateDamage` | `preExistingRelateDamage` | string |
| `maintenanceDefectIssues` | `maintainanceDefectIssues` | string |
| `worksRequiredToAddressDamage` | `worksRequiredToAddressRelatedDamage` | string |

#### `makeSafe` — make-safe findings (post-visit)

| JSONB key | CW key | Type |
|---|---|---|
| `makeSafeRequired` | *(local — assessor's view)* | boolean |
| `makeSafeType` | *(local)* | string |
| `dateMakeSafeCompleted` | `dateMakeSafeCompleted` | string (date) |
| `dateMainRoofRepaired` | *(local)* | string (date) |

#### `temporaryAccommodation` — temp accom assessment

| JSONB key | CW key | Type |
|---|---|---|
| `required` | `temporaryAccommodationOrLossOfRentRequired` | string ("Yes, TA" / "Yes, Loss of Rent" / "No") |
| `estimatedAmount` | `tempAccommodationEstimatedAmount` | number |
| `estimatedDuration` | `tempAccommodationEstimatedDuration` | string ("X Days/Weeks") |
| `requiredImmediately` | *(local)* | boolean |
| `immediateEstimateDays` | *(local)* | number |
| `requiredDuringRepairs` | *(local)* | boolean |
| `repairsEstimateDays` | *(local)* | number |
| `tempRepairsToMakeLivable` | *(local)* | string |
| `workWhileInAccommodation` | *(local)* | string |

#### `specialists` — specialist referral

| JSONB key | CW key | Type |
|---|---|---|
| `specialistRequired` | `specialistRequired` | boolean |
| `specialistType` | `specialistType` | string |

#### `recommendation` — assessor outcome

| JSONB key | CW key | Type |
|---|---|---|
| `claimRecommendation` | `claimRecommendation` | string |
| `costEstimateForRepairs` | `costEstimateForRepairs` | number |
| `estimatedRepairTime` | `estimatedRepairTime` | number |
| `estimatedRepairDuration` | `estimatedRepairDuration` | string ("Days"/"Weeks"/"Months") |
| `hasInsuredAdvised` | `hasInsuredAdvised` | boolean |
| `clientWillingToProceed` | `clientWillingToProceed` | boolean |
| `clientDiscussions` | `clientDiscussions` | string |
| `customerArrangedRepairs` | `customerArrangedRepairs` | boolean |
| `arrangedRepairComments` | `arrangedRepairComments` | string |
| `specialNotes` | `specialNotes` | string |
| `conclusion` | `conclusion` | string |
| `builderLicenses` | `builderLicenses` | string |

#### `extras` — overflow / tenant-specific

Any field returned by `GET /report-types/{id}/schema` that does not map to the sections above lands here. Future CW schema additions go here until promoted to a named section (optional).

---

## 3. Migration strategy

### Phase 1 — Add new columns alongside old ones

```sql
ALTER TABLE assessments
  ADD COLUMN attendance       jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN building         jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN habitability     jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN hazards          jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN damage           jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN make_safe        jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN temporary_accommodation jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN specialists      jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN recommendation   jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN extras           jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN report_external_reference text;
```

### Phase 2 — Backfill migration

Run a data migration that copies old scalar columns into JSONB:

```sql
UPDATE assessments SET
  building = jsonb_build_object(
    'houseM2', CASE WHEN square_metres IS NOT NULL THEN square_metres::float ELSE NULL END,
    'estimatedBuildYear', CASE WHEN building_age IS NOT NULL THEN building_age::text ELSE NULL END,
    'buildingType', building_type,
    'designType', design_type,
    'constructionType', construction,
    'roofType', roof_type,
    'mainHouseRoofDamage', main_roof_damage,
    'additionalStructures', CASE WHEN detached_garage OR sheds OR swimming_pool OR detached_granny_flat THEN
      concat_ws(', ',
        CASE WHEN detached_garage THEN 'Detached Garage' END,
        CASE WHEN sheds THEN 'Sheds' END,
        CASE WHEN swimming_pool THEN 'Swimming Pool' END,
        CASE WHEN detached_granny_flat THEN 'Granny Flat' END
      )
    END,
    'propertyCondition', overall_condition_acceptable,
    'furnitureRemovalStorage', false
  ),
  -- ... similar for other sections
  make_safe = jsonb_build_object(
    'makeSafeRequired', make_safe,
    'makeSafeType', make_safe_type,
    'dateMakeSafeCompleted', make_safe_completion_date,
    'dateMainRoofRepaired', date_main_roof_repaired
  )
WHERE deleted_at IS NULL;
```

### Phase 3 — Drop old columns

Once the frontend + API exclusively read/write JSONB sections, drop the 40+ scalar columns.

---

## 4. API layer changes

### DTO redesign

Replace `CreateAssessmentDto` / `UpdateAssessmentDto` (40+ `@IsOptional` fields) with section-based structure:

```typescript
export class UpsertAssessmentDto {
  @IsString() name!: string;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() status?: string;

  @IsOptional() @IsObject() attendance?: Record<string, unknown>;
  @IsOptional() @IsObject() building?: Record<string, unknown>;
  @IsOptional() @IsObject() habitability?: Record<string, unknown>;
  @IsOptional() @IsObject() hazards?: Record<string, unknown>;
  @IsOptional() @IsObject() damage?: Record<string, unknown>;
  @IsOptional() @IsObject() makeSafe?: Record<string, unknown>;
  @IsOptional() @IsObject() temporaryAccommodation?: Record<string, unknown>;
  @IsOptional() @IsObject() specialists?: Record<string, unknown>;
  @IsOptional() @IsObject() recommendation?: Record<string, unknown>;
  @IsOptional() @IsObject() extras?: Record<string, unknown>;
}
```

### Partial section update

`PATCH /assessments/:id` accepts any subset of sections. Service merges incoming section into existing JSONB:

```typescript
// Deep-merge each provided section
for (const section of SECTIONS) {
  if (dto[section] !== undefined) {
    updateData[section] = sql`COALESCE(${assessments[section]}, '{}'::jsonb) || ${JSON.stringify(dto[section])}::jsonb`;
  }
}
```

---

## 5. Publish mapper

`AssessmentReportMapper.toReportCustomData(assessment, job, claim)`:

```typescript
export function toReportCustomData(
  assessment: AssessmentRow,
  job: JobRow,
  claim: ClaimRow,
): Record<string, unknown> {
  const att = assessment.attendance as Record<string, unknown>;
  const bld = assessment.building as Record<string, unknown>;
  const hab = assessment.habitability as Record<string, unknown>;
  const haz = assessment.hazards as Record<string, unknown>;
  const dmg = assessment.damage as Record<string, unknown>;
  const ms  = assessment.makeSafe as Record<string, unknown>;
  const ta  = assessment.temporaryAccommodation as Record<string, unknown>;
  const sp  = assessment.specialists as Record<string, unknown>;
  const rec = assessment.recommendation as Record<string, unknown>;
  const ext = assessment.extras as Record<string, unknown>;

  return {
    // === From Claim ===
    policyName: claim.policyName,
    policyNumber: claim.policyNumber,
    claimNumber: claim.claimNumber,
    dateOfLoss: claim.dateOfLoss,
    confirmLossType: resolveLookupName(claim.lossTypeLookupId),
    address: formatAddress(job.address),
    requestDate: job.requestDate,

    // === From Job ===
    makeSafeRequired: job.makeSafeRequired,

    // === From Assessment sections ===
    // attendance
    addressAttended: att.addressAttended,
    otherAddress: att.otherAddress,
    siteAttendanceOrVaDateTime: att.siteAttendanceDate ?? deriveFromAppointment(job),
    personsParticipatingInAttendance: att.personsAttending ?? deriveFromAttendees(job),
    builderEstimatorName: att.builderEstimatorName,
    builderEstimatorPhoneNumber: att.builderEstimatorPhone,
    insuranceAssessorAttended: att.insuranceAssessorAttended,
    insuranceAssessorName: att.insuranceAssessorName,
    insuranceAssessorPhoneNumber: att.insuranceAssessorPhone,
    occupancyType: att.occupancyType,

    // building
    houseM2: bld.houseM2,
    estimatedBuildYear: bld.estimatedBuildYear,
    buildingType: bld.buildingType,
    designType: bld.designType,
    constructionType: bld.constructionType,
    roofType: bld.roofType,
    mainHouseRoofDamage: bld.mainHouseRoofDamage,
    additionalStructures: bld.additionalStructures,
    otherStructures: bld.otherStructures,
    propertyCondition: bld.propertyCondition,
    furnitureRemovalStorage: bld.furnitureRemovalStorage,

    // habitability
    habitable: hab.habitable,
    unihabitablePropertyReason: hab.uninhabitableReason,
    otherUnihabitableReason: hab.otherUninhabitableReason,

    // hazards
    safetyHazards: haz.safetyHazards,
    environmentalHazards: haz.environmentalHazards,

    // damage
    damageObserved: dmg.damageObserved,
    causeOfDamage: dmg.causeOfDamage,
    hasDamageCausedByEventCoveredByPolicy: dmg.hasDamageCoveredByPolicy,
    preExistingMaintenanceIssues: dmg.preExistingMaintenanceIssues,
    preExistingRelateDamage: dmg.preExistingRelateDamage,
    maintainanceDefectIssues: dmg.maintenanceDefectIssues,
    worksRequiredToAddressRelatedDamage: dmg.worksRequiredToAddressDamage,

    // make safe
    dateMakeSafeCompleted: ms.dateMakeSafeCompleted,

    // temporary accommodation
    temporaryAccommodationOrLossOfRentRequired: ta.required,
    tempAccommodationEstimatedAmount: ta.estimatedAmount,
    tempAccommodationEstimatedDuration: ta.estimatedDuration,

    // specialists
    specialistRequired: sp.specialistRequired,
    specialistType: sp.specialistType,

    // recommendation
    claimRecommendation: rec.claimRecommendation,
    costEstimateForRepairs: rec.costEstimateForRepairs,
    estimatedRepairTime: rec.estimatedRepairTime,
    estimatedRepairDuration: rec.estimatedRepairDuration,
    hasInsuredAdvised: rec.hasInsuredAdvised,
    clientWillingToProceed: rec.clientWillingToProceed,
    clientDiscussions: rec.clientDiscussions,
    customerArrangedRepairs: rec.customerArrangedRepairs,
    arrangedRepairComments: rec.arrangedRepairComments,
    specialNotes: rec.specialNotes,
    conclusion: rec.conclusion,
    builderLicenses: rec.builderLicenses,

    // extras (pass through any additional keys)
    ...ext,
  };
}
```

---

## 6. Frontend — section-based form tabs

Map each JSONB section to a tab in `AssessmentDetailClient`:

| Tab | Section column | Fields |
|---|---|---|
| Attendance | `attendance` | 10 fields (addressAttended → occupancyType) |
| Building | `building` | 11 fields (houseM2 → furnitureRemovalStorage) |
| Habitability | `habitability` | 3 fields |
| Hazards | `hazards` | 3 fields (safetyHazards, environmentalHazards, hazardDetails) |
| Damage & Cause | `damage` | 7 fields |
| Make Safe | `makeSafe` | 4 fields |
| Temp Accommodation | `temporaryAccommodation` | 9 fields |
| Specialists | `specialists` | 2 fields |
| Recommendation | `recommendation` | 12 fields |

Each tab reads/writes to its section key. The save action sends only modified sections.

---

## 7. Publish workflow

```
Assessment status: draft → in_progress → submitted → published
```

1. **draft / in_progress** — user fills sections, auto-saves.
2. **submitted** — triggers validation:
   - Load live CW schema via `GET /report-types/{id}/schema`.
   - Build `customData` via mapper.
   - Check `required` fields from schema.
   - Return validation errors to UI if any.
3. **published** — calls `POST /reports` (or `POST /reports/{id}` for update) via outbound sync queue.
   - Sets `report_external_reference` on assessment row.
   - Updates `status = 'published'`.

---

## 8. Validation against live schema

```typescript
async function validateAgainstSchema(
  customData: Record<string, unknown>,
  schemaFields: Record<string, FieldDefinition>,
): ValidationResult {
  const errors: string[] = [];
  for (const [key, def] of Object.entries(schemaFields)) {
    if (def.required && (customData[key] === undefined || customData[key] === null)) {
      errors.push(`Missing required field: ${key}`);
    }
    if (def.options && customData[key] != null) {
      const valid = def.options.map(o => o.value);
      if (!valid.includes(String(customData[key]))) {
        errors.push(`Invalid value for ${key}: must be one of ${valid.join(', ')}`);
      }
    }
    // numeric range
    if (def.minValue != null && typeof customData[key] === 'number' && customData[key] < def.minValue) {
      errors.push(`${key} below minimum ${def.minValue}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

---

## 9. Implementation phases

### Phase A — Schema & migration (backend)

1. Add JSONB columns to `assessments` (non-breaking — old columns untouched).
2. Write backfill migration (old scalars → JSONB sections).
3. Update repository: read from JSONB sections, write JSONB sections.
4. Update DTO to section-based shape.
5. Update service merge logic.
6. New endpoint: `POST /assessments/:id/validate` (dry-run against CW schema).

### Phase B — Publish pipeline (backend)

1. `AssessmentReportMapper` — `toReportCustomData()`.
2. Publish use-case: validate → `POST /reports` → store external reference.
3. Wire into outbound sync queue.
4. Handle re-publish (update existing CW report).

### Phase C — Frontend (UI)

1. Refactor `AssessmentDetailClient` tabs to match JSONB sections.
2. Each tab reads/writes its section via `updateAssessmentAction(id, { [section]: {...} })`.
3. Add Attendance tab, Specialists tab, Recommendation tab (new fields).
4. Pre-populate attendance fields from logged-in user / job data.
5. Add "Publish" button with validation feedback (calls validate endpoint, shows errors, confirms).

### Phase D — Cleanup

1. Drop old scalar columns from `assessments` table.
2. Remove old DTO classes.
3. Update AI assistant tools if applicable.

---

## 10. Coverage proof

After implementation, every CW Field Assessment `customData` key is sourced:

| Source | Count | Keys |
|---|---|---|
| Claim | 7 | policyName, policyNumber, claimNumber, dateOfLoss, confirmLossType, address, requestDate |
| Job | 1 | makeSafeRequired |
| Assessment `attendance` | 10 | addressAttended, otherAddress, siteAttendanceOrVaDateTime, personsParticipatingInAttendance, builderEstimatorName, builderEstimatorPhoneNumber, insuranceAssessorAttended, insuranceAssessorName, insuranceAssessorPhoneNumber, occupancyType |
| Assessment `building` | 11 | houseM2, estimatedBuildYear, buildingType, designType, constructionType, roofType, mainHouseRoofDamage, additionalStructures, otherStructures, propertyCondition, furnitureRemovalStorage |
| Assessment `habitability` | 3 | habitable, unihabitablePropertyReason, otherUnihabitableReason |
| Assessment `hazards` | 2 | safetyHazards, environmentalHazards |
| Assessment `damage` | 7 | damageObserved, causeOfDamage, hasDamageCausedByEventCoveredByPolicy, preExistingMaintenanceIssues, preExistingRelateDamage, maintainanceDefectIssues, worksRequiredToAddressRelatedDamage |
| Assessment `makeSafe` | 1 | dateMakeSafeCompleted |
| Assessment `temporaryAccommodation` | 3 | temporaryAccommodationOrLossOfRentRequired, tempAccommodationEstimatedAmount, tempAccommodationEstimatedDuration |
| Assessment `specialists` | 2 | specialistRequired, specialistType |
| Assessment `recommendation` | 12 | claimRecommendation, costEstimateForRepairs, estimatedRepairTime, estimatedRepairDuration, hasInsuredAdvised, clientWillingToProceed, clientDiscussions, customerArrangedRepairs, arrangedRepairComments, specialNotes, conclusion, builderLicenses |
| **Total** | **59** | *(matches all keys from v17 Field Assessment example)* |

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| CW schema adds new required fields after go-live | `extras` catch-all + live schema validation warns before publish fails |
| Backfill loses nuance from old structured booleans | Backfill runs in transaction; old data preserved in section JSONB at full fidelity |
| JSONB loses type safety at DB level | TypeScript interfaces per section; runtime validation via Zod or class-validator |
| Large JSONB reads for list views | List query selects only `id, name, status, jobId, updatedAt`; JSONB loaded on detail only |
| Concurrent section edits | Section-level JSONB merge (`||`) is safe for different sections; same-section conflict is last-write-wins (acceptable for single-user assessment forms) |
