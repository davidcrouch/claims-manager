import type { AssessmentRow } from '../../database/repositories';
import type { JobRow, JobViewRow } from '../../database/repositories';
import type { ClaimRow, ClaimViewRow } from '../../database/repositories';
import { asSectionDict } from './assessment-sections';

type Dict = Record<string, unknown>;

const CLAIM_RECOMMENDATION_TO_CW: Record<string, string> = {
  Approve: 'Accept',
  Decline: 'Decline',
  Refer: 'Refer',
  Pending: 'Pending',
};

function asDict(value: unknown): Dict {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : {};
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function toIso(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const s = String(value).trim();
  return s || undefined;
}

function compact(obj: Dict): Dict {
  const out: Dict = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

function formatAddress(job: JobRow | JobViewRow): string | undefined {
  const addr = asDict(job.address);
  const unit = asString(addr.unitNumber);
  const streetNo = asString(addr.streetNumber);
  const streetName = asString(addr.streetName);
  const suburb = asString(addr.suburb) ?? asString(job.addressSuburb);
  const state = asString(addr.state) ?? asString(job.addressState);
  const postcode = asString(addr.postcode ?? addr.postCode) ?? asString(job.addressPostcode);
  const country = asString(addr.country) ?? asString(job.addressCountry);
  const street = [unit, streetNo, streetName].filter(Boolean).join(' ');
  const parts = [street, suburb, state, postcode, country].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function lookupNameFromPayload(payload: Dict, key: string): string | undefined {
  const value = payload[key];
  if (typeof value === 'string') return asString(value);
  const obj = asDict(value);
  return asString(obj.name);
}

function cwEntityId(row: { externalReference?: string | null; apiPayload?: unknown }): string | undefined {
  const payload = asDict(row.apiPayload);
  return asString(payload.id) ?? asString(row.externalReference);
}

export function toReportCustomData(params: {
  assessment: AssessmentRow;
  job: JobRow | JobViewRow;
  claim: ClaimRow | ClaimViewRow | null;
  attendanceFallback?: { siteAttendanceDate?: string; personsAttending?: string };
}): Dict {
  const { assessment, job, claim, attendanceFallback } = params;
  const att = asSectionDict(assessment.attendance);
  const bld = asSectionDict(assessment.building);
  const hab = asSectionDict(assessment.habitability);
  const haz = asSectionDict(assessment.hazards);
  const dmg = asSectionDict(assessment.damage);
  const ms = asSectionDict(assessment.makeSafe);
  const ta = asSectionDict(assessment.temporaryAccommodation);
  const sp = asSectionDict(assessment.specialists);
  const rec = asSectionDict(assessment.recommendation);
  const ext = asSectionDict(assessment.extras);

  const claimPayload = asDict(claim?.apiPayload);
  const jobPayload = asDict(job.apiPayload);
  const jobCustom = asDict(job.customData);
  const vendor = asDict(job.vendorSnapshot);
  const assigneeName =
    'assigneeName' in job ? asString((job as JobViewRow).assigneeName) : undefined;

  const claimRecommendation = asString(rec.claimRecommendation);

  return compact({
    policyName: asString(claim?.policyName) ?? asString(claimPayload.policyName),
    policyNumber: asString(claim?.policyNumber) ?? asString(claimPayload.policyNumber),
    claimNumber: asString(claim?.claimNumber) ?? asString(claimPayload.claimNumber),
    dateOfLoss: toIso(claim?.dateOfLoss) ?? toIso(claimPayload.dateOfLoss),
    confirmLossType: lookupNameFromPayload(claimPayload, 'lossType'),
    address: formatAddress(job),
    requestDate: toIso(job.requestDate) ?? toIso(jobPayload.requestDate),
    makeSafeRequired: job.makeSafeRequired ?? ms.makeSafeRequired,

    addressAttended: att.addressAttended,
    otherAddress: att.otherAddress,
    siteAttendanceOrVaDateTime:
      toIso(att.siteAttendanceDate) ??
      attendanceFallback?.siteAttendanceDate ??
      toIso(jobCustom.attendanceDate) ??
      toIso(jobCustom.bookedDate),
    personsParticipatingInAttendance:
      asString(att.personsAttending) ?? attendanceFallback?.personsAttending,
    builderEstimatorName: asString(att.builderEstimatorName) ?? assigneeName ?? asString(vendor.name),
    builderEstimatorPhoneNumber:
      asString(att.builderEstimatorPhone) ?? asString(vendor.phone) ?? asString(vendor.contactPhone),
    insuranceAssessorAttended: att.insuranceAssessorAttended,
    insuranceAssessorName: asString(att.insuranceAssessorName),
    insuranceAssessorPhoneNumber: asString(att.insuranceAssessorPhone),
    occupancyType: asString(att.occupancyType),

    houseM2: bld.houseM2,
    estimatedBuildYear: asString(bld.estimatedBuildYear),
    buildingType: asString(bld.buildingType),
    designType: asString(bld.designType),
    constructionType: asString(bld.constructionType),
    roofType: asString(bld.roofType),
    mainHouseRoofDamage: bld.mainHouseRoofDamage,
    additionalStructures: asString(bld.additionalStructures),
    otherStructures: asString(bld.otherStructures),
    propertyCondition: bld.propertyCondition,
    furnitureRemovalStorage: bld.furnitureRemovalStorage,

    habitable: hab.habitable,
    unihabitablePropertyReason: asString(hab.uninhabitableReason),
    otherUnihabitableReason: asString(hab.otherUninhabitableReason),

    safetyHazards: asString(haz.safetyHazards),
    environmentalHazards: asString(haz.environmentalHazards),

    damageObserved: asString(dmg.damageObserved),
    causeOfDamage: asString(dmg.causeOfDamage),
    hasDamageCausedByEventCoveredByPolicy: asString(dmg.hasDamageCoveredByPolicy),
    preExistingMaintenanceIssues: dmg.preExistingMaintenanceIssues,
    preExistingRelateDamage: asString(dmg.preExistingRelateDamage),
    maintainanceDefectIssues: asString(dmg.maintenanceDefectIssues),
    worksRequiredToAddressRelatedDamage: asString(dmg.worksRequiredToAddressDamage),

    dateMakeSafeCompleted: toIso(ms.dateMakeSafeCompleted),

    temporaryAccommodationOrLossOfRentRequired: asString(ta.required),
    tempAccommodationEstimatedAmount: ta.estimatedAmount,
    tempAccommodationEstimatedDuration: asString(ta.estimatedDuration),

    specialistRequired: sp.specialistRequired,
    specialistType: asString(sp.specialistType),

    claimRecommendation: claimRecommendation
      ? (CLAIM_RECOMMENDATION_TO_CW[claimRecommendation] ?? claimRecommendation)
      : undefined,
    costEstimateForRepairs: rec.costEstimateForRepairs,
    estimatedRepairTime: rec.estimatedRepairTime,
    estimatedRepairDuration: asString(rec.estimatedRepairDuration),
    hasInsuredAdvised: rec.hasInsuredAdvised,
    clientWillingToProceed: rec.clientWillingToProceed,
    clientDiscussions: asString(rec.clientDiscussions),
    customerArrangedRepairs: rec.customerArrangedRepairs,
    arrangedRepairComments: asString(rec.arrangedRepairComments),
    specialNotes: asString(rec.specialNotes),
    conclusion: asString(rec.conclusion),
    builderLicenses: asString(rec.builderLicenses),

    ...ext,
  });
}

export function buildFieldAssessmentReportBody(params: {
  assessment: AssessmentRow;
  job: JobRow | JobViewRow;
  claim: ClaimRow | ClaimViewRow | null;
  attendanceFallback?: { siteAttendanceDate?: string; personsAttending?: string };
}): Dict {
  const customData = toReportCustomData(params);
  return compact({
    reportType: { externalReference: 'Field Assessment' },
    title: params.assessment.name,
    jobId: cwEntityId(params.job),
    claimId: params.claim ? cwEntityId(params.claim) : undefined,
    customData,
  });
}

export type ReportSchemaField = {
  type?: string;
  required?: boolean;
  readonly?: boolean;
  options?: Array<{ value?: string; label?: string }>;
  minValue?: number;
  maxValue?: number;
};

export function validateAgainstSchema(
  customData: Dict,
  schemaFields: Record<string, ReportSchemaField>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [key, def] of Object.entries(schemaFields)) {
    const value = customData[key];
    if (def.required && (value === undefined || value === null || value === '')) {
      errors.push(`Missing required field: ${key}`);
    }
    if (def.options?.length && value != null && value !== '') {
      const valid = def.options.map((o) => String(o.value ?? o.label ?? ''));
      if (!valid.includes(String(value))) {
        errors.push(`Invalid value for ${key}: must be one of ${valid.join(', ')}`);
      }
    }
    if (def.minValue != null && typeof value === 'number' && value < def.minValue) {
      errors.push(`${key} below minimum ${def.minValue}`);
    }
    if (def.maxValue != null && typeof value === 'number' && value > def.maxValue) {
      errors.push(`${key} above maximum ${def.maxValue}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
