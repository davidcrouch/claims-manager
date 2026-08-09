import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { assessments, jobs, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

function yn(value: boolean | null | undefined): string {
  return value ? 'Yes' : 'No';
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

    return {
      company_name: org?.name ?? '',
      assessment_name: assessment.name,
      status: assessment.status,
      job_name: jobName,
      job_reference: jobReference,

      claim_recommendation: assessment.claimRecommendation ?? '',
      design_type: assessment.designType ?? '',
      construction: assessment.construction ?? '',
      roof_type: assessment.roofType ?? '',
      building_type: assessment.buildingType ?? '',
      make_safe: yn(assessment.makeSafe),
      make_safe_type: assessment.makeSafeType ?? '',
      squares: assessment.squares ?? '',
      building_age: assessment.buildingAge != null ? String(assessment.buildingAge) : '',
      square_metres: assessment.squareMetres ?? '',
      date_booked: formatDate(assessment.dateBooked),
      overall_condition_acceptable: yn(assessment.overallConditionAcceptable),
      iag_inspection_required: yn(assessment.iagInspectionRequired),

      make_safe_completion_date: formatDate(assessment.makeSafeCompletionDate),
      main_roof_damage: yn(assessment.mainRoofDamage),
      date_main_roof_repaired: formatDate(assessment.dateMainRoofRepaired),
      habitable: yn(assessment.habitable),
      mould: yn(assessment.mould),
      asbestos_on_site: yn(assessment.asbestosOnSite),
      detached_garage: yn(assessment.detachedGarage),
      sheds: yn(assessment.sheds),
      swimming_pool: yn(assessment.swimmingPool),
      detached_granny_flat: yn(assessment.detachedGrannyFlat),
      damage_caused_by_listed_event: yn(assessment.damageCausedByListedEvent),

      hazard_pool_fencing: yn(assessment.hazardPoolFencing),
      hazard_pool_fencing_comment: assessment.hazardPoolFencingComment ?? '',
      hazard_electrical_gas: yn(assessment.hazardElectricalGas),
      hazard_electrical_gas_comment: assessment.hazardElectricalGasComment ?? '',
      hazard_sewerage: yn(assessment.hazardSewerage),
      hazard_sewerage_comment: assessment.hazardSewerageComment ?? '',
      hazard_structural: yn(assessment.hazardStructural),
      hazard_structural_comment: assessment.hazardStructuralComment ?? '',
      hazard_other: assessment.hazardOther ?? '',

      temp_accom_required_immediately: yn(assessment.tempAccomRequiredImmediately),
      temp_accom_immediate_estimate_days:
        assessment.tempAccomImmediateEstimateDays != null
          ? String(assessment.tempAccomImmediateEstimateDays)
          : '',
      temp_repairs_to_make_livable: assessment.tempRepairsToMakeLivable ?? '',
      temp_accom_required_during_repairs: yn(assessment.tempAccomRequiredDuringRepairs),
      temp_accom_repairs_estimate_days:
        assessment.tempAccomRepairsEstimateDays != null
          ? String(assessment.tempAccomRepairsEstimateDays)
          : '',
      work_while_in_accommodation: assessment.workWhileInAccommodation ?? '',

      client_discussion: assessment.clientDiscussion ?? '',
      resultant_damage: assessment.resultantDamage ?? '',
      cause_of_damage: assessment.causeOfDamage ?? '',
      maintenance_related_issues: assessment.maintenanceRelatedIssues ?? '',
      comments: assessment.comments ?? '',
      variances_of_scope: assessment.variancesOfScope ?? '',

      created_at: formatDate(assessment.createdAt),
      report_date: formatDate(new Date()),
    };
  }
}
