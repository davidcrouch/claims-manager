import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { assessments, jobs, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

function dict(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

function yn(value: unknown): string {
  return value === true ? 'Yes' : 'No';
}

function hazardFlag(details: Record<string, unknown>, key: string): boolean {
  const entry = details[key];
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    return !!(entry as Record<string, unknown>).flagged;
  }
  return false;
}

function hazardComment(details: Record<string, unknown>, key: string): string {
  const entry = details[key];
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    return str((entry as Record<string, unknown>).comment);
  }
  return '';
}

@Injectable()
export class AssessmentMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [assessment] = await this.db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.id, params.entityId),
          eq(assessments.tenantId, params.tenantId),
          isNull(assessments.deletedAt),
        ),
      );
    if (!assessment) throw new NotFoundException('Assessment not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    let jobName = '';
    let jobReference = '';
    if (assessment.jobId) {
      const [job] = await this.db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, assessment.jobId), eq(jobs.tenantId, params.tenantId)));
      jobName = job?.name ?? '';
      jobReference = job?.externalReference ?? '';
    }

    const att = dict(assessment.attendance);
    const bld = dict(assessment.building);
    const hab = dict(assessment.habitability);
    const haz = dict(assessment.hazards);
    const dmg = dict(assessment.damage);
    const ms = dict(assessment.makeSafe);
    const ta = dict(assessment.temporaryAccommodation);
    const sp = dict(assessment.specialists);
    const rec = dict(assessment.recommendation);
    const details = dict(haz.hazardDetails);
    const additionalStructures = str(bld.additionalStructures);

    return {
      company_name: org?.name ?? '',
      assessment_name: assessment.name,
      status: assessment.status,
      job_name: jobName,
      job_reference: jobReference,

      address_attended: yn(att.addressAttended),
      other_address: str(att.otherAddress),
      date_booked: formatDate(att.siteAttendanceDate as string | Date | null | undefined),
      persons_attending: str(att.personsAttending),
      builder_estimator_name: str(att.builderEstimatorName),
      builder_estimator_phone: str(att.builderEstimatorPhone),
      iag_inspection_required: yn(att.insuranceAssessorAttended),
      insurance_assessor_name: str(att.insuranceAssessorName),
      insurance_assessor_phone: str(att.insuranceAssessorPhone),
      occupancy_type: str(att.occupancyType),

      square_metres: str(bld.houseM2),
      building_age: str(bld.estimatedBuildYear),
      building_type: str(bld.buildingType),
      design_type: str(bld.designType),
      construction: str(bld.constructionType),
      roof_type: str(bld.roofType),
      additional_structures: additionalStructures,
      other_structures: str(bld.otherStructures),
      squares: str(bld.squares),
      main_roof_damage: yn(bld.mainHouseRoofDamage),
      overall_condition_acceptable: yn(bld.propertyCondition),
      furniture_removal_storage: yn(bld.furnitureRemovalStorage),
      detached_garage: yn(additionalStructures.includes('Garage')),
      sheds: yn(additionalStructures.includes('Shed')),
      swimming_pool: yn(additionalStructures.includes('Pool')),
      detached_granny_flat: yn(additionalStructures.includes('Granny')),

      habitable: yn(hab.habitable),
      uninhabitable_reason: str(hab.uninhabitableReason),
      other_uninhabitable_reason: str(hab.otherUninhabitableReason),

      hazard_pool_fencing: yn(hazardFlag(details, 'poolFencing')),
      hazard_pool_fencing_comment: hazardComment(details, 'poolFencing'),
      hazard_electrical_gas: yn(hazardFlag(details, 'electrical')),
      hazard_electrical_gas_comment: hazardComment(details, 'electrical'),
      hazard_sewerage: yn(hazardFlag(details, 'sewerage')),
      hazard_sewerage_comment: hazardComment(details, 'sewerage'),
      hazard_structural: yn(hazardFlag(details, 'structural')),
      hazard_structural_comment: hazardComment(details, 'structural'),
      hazard_other: str(details.other) || str(haz.safetyHazards),
      safety_hazards: str(haz.safetyHazards),
      environmental_hazards: str(haz.environmentalHazards),
      mould: yn(String(haz.environmentalHazards ?? '').toLowerCase().includes('mould')),
      asbestos_on_site: yn(String(haz.safetyHazards ?? '').toLowerCase().includes('asbestos')),

      resultant_damage: str(dmg.damageObserved),
      cause_of_damage: str(dmg.causeOfDamage),
      damage_caused_by_listed_event: str(dmg.hasDamageCoveredByPolicy),
      pre_existing_maintenance_issues: yn(dmg.preExistingMaintenanceIssues),
      pre_existing_relate_damage: str(dmg.preExistingRelateDamage),
      maintenance_related_issues: str(dmg.maintenanceDefectIssues),
      works_required_to_address_damage: str(dmg.worksRequiredToAddressDamage),

      make_safe: yn(ms.makeSafeRequired),
      make_safe_type: str(ms.makeSafeType),
      make_safe_completion_date: formatDate(ms.dateMakeSafeCompleted as string | Date | null | undefined),
      date_main_roof_repaired: formatDate(ms.dateMainRoofRepaired as string | Date | null | undefined),

      temp_accom_required: str(ta.required),
      temp_accom_estimated_amount: str(ta.estimatedAmount),
      temp_accom_estimated_duration: str(ta.estimatedDuration),
      temp_accom_required_immediately: yn(ta.requiredImmediately),
      temp_accom_immediate_estimate_days: str(ta.immediateEstimateDays),
      temp_accom_required_during_repairs: yn(ta.requiredDuringRepairs),
      temp_accom_repairs_estimate_days: str(ta.repairsEstimateDays),
      temp_repairs_to_make_livable: str(ta.tempRepairsToMakeLivable),
      work_while_in_accommodation: str(ta.workWhileInAccommodation),

      specialist_required: yn(sp.specialistRequired),
      specialist_type: str(sp.specialistType),

      claim_recommendation: str(rec.claimRecommendation),
      cost_estimate_for_repairs: str(rec.costEstimateForRepairs),
      estimated_repair_time: str(rec.estimatedRepairTime),
      estimated_repair_duration: str(rec.estimatedRepairDuration),
      insured_advised: yn(rec.hasInsuredAdvised),
      client_willing_to_proceed: yn(rec.clientWillingToProceed),
      customer_arranged_repairs: yn(rec.customerArrangedRepairs),
      arranged_repair_comments: str(rec.arrangedRepairComments),
      client_discussion: str(rec.clientDiscussions),
      comments: str(rec.specialNotes),
      variances_of_scope: str(rec.conclusion),
      builder_licenses: str(rec.builderLicenses),

      created_at: formatDate(assessment.createdAt),
      report_date: formatDate(new Date()),
    };
  }
}
