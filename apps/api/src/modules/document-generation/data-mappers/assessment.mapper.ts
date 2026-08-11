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
    const rec = dict(assessment.recommendation);
    const details = dict(haz.hazardDetails);

    return {
      company_name: org?.name ?? '',
      assessment_name: assessment.name,
      status: assessment.status,
      job_name: jobName,
      job_reference: jobReference,

      claim_recommendation: str(rec.claimRecommendation),
      design_type: str(bld.designType),
      construction: str(bld.constructionType),
      roof_type: str(bld.roofType),
      building_type: str(bld.buildingType),
      make_safe: yn(ms.makeSafeRequired),
      make_safe_type: str(ms.makeSafeType),
      squares: str(bld.squares),
      building_age: str(bld.estimatedBuildYear),
      square_metres: str(bld.houseM2),
      date_booked: formatDate(att.siteAttendanceDate as string | Date | null | undefined),
      overall_condition_acceptable: yn(bld.propertyCondition),
      iag_inspection_required: yn(att.insuranceAssessorAttended),

      make_safe_completion_date: formatDate(ms.dateMakeSafeCompleted as string | Date | null | undefined),
      main_roof_damage: yn(bld.mainHouseRoofDamage),
      date_main_roof_repaired: formatDate(ms.dateMainRoofRepaired as string | Date | null | undefined),
      habitable: yn(hab.habitable),
      mould: yn(String(haz.environmentalHazards ?? '').toLowerCase().includes('mould')),
      asbestos_on_site: yn(String(haz.safetyHazards ?? '').toLowerCase().includes('asbestos')),
      detached_garage: yn(String(bld.additionalStructures ?? '').includes('Garage')),
      sheds: yn(String(bld.additionalStructures ?? '').includes('Shed')),
      swimming_pool: yn(String(bld.additionalStructures ?? '').includes('Pool')),
      detached_granny_flat: yn(String(bld.additionalStructures ?? '').includes('Granny')),
      damage_caused_by_listed_event: str(dmg.hasDamageCoveredByPolicy),

      hazard_pool_fencing: yn(hazardFlag(details, 'poolFencing')),
      hazard_pool_fencing_comment: hazardComment(details, 'poolFencing'),
      hazard_electrical_gas: yn(hazardFlag(details, 'electrical')),
      hazard_electrical_gas_comment: hazardComment(details, 'electrical'),
      hazard_sewerage: yn(hazardFlag(details, 'sewerage')),
      hazard_sewerage_comment: hazardComment(details, 'sewerage'),
      hazard_structural: yn(hazardFlag(details, 'structural')),
      hazard_structural_comment: hazardComment(details, 'structural'),
      hazard_other: str(details.other) || str(haz.safetyHazards),

      temp_accom_required_immediately: yn(ta.requiredImmediately),
      temp_accom_immediate_estimate_days: str(ta.immediateEstimateDays),
      temp_repairs_to_make_livable: str(ta.tempRepairsToMakeLivable),
      temp_accom_required_during_repairs: yn(ta.requiredDuringRepairs),
      temp_accom_repairs_estimate_days: str(ta.repairsEstimateDays),
      work_while_in_accommodation: str(ta.workWhileInAccommodation),

      client_discussion: str(rec.clientDiscussions),
      resultant_damage: str(dmg.damageObserved),
      cause_of_damage: str(dmg.causeOfDamage),
      maintenance_related_issues: str(dmg.maintenanceDefectIssues),
      comments: str(rec.specialNotes),
      variances_of_scope: str(rec.conclusion),

      created_at: formatDate(assessment.createdAt),
      report_date: formatDate(new Date()),
    };
  }
}
