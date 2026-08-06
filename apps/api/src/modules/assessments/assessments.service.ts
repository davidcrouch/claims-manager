import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { AssessmentsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly assessmentsRepo: AssessmentsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: { page?: number; limit?: number; status?: string; jobId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `[AssessmentsService.findAll] tenantId=${tenantId} jobId=${params.jobId ?? 'none'}`,
    );
    return this.assessmentsRepo.findAll({ tenantId, ...params });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const assessment = await this.assessmentsRepo.findOne({ id: params.id, tenantId });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async create(params: { dto: CreateAssessmentDto; userId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const { dto, userId } = params;

    this.logger.debug(
      `[AssessmentsService.create] creating assessment "${dto.name}" for tenant=${tenantId}`,
    );

    return this.assessmentsRepo.create({
      data: {
        tenantId,
        name: dto.name,
        jobId: dto.jobId ?? null,
        claimRecommendation: dto.claimRecommendation ?? null,
        makeSafe: dto.makeSafe ?? false,
        makeSafeType: dto.makeSafeType ?? null,
        designType: dto.designType ?? null,
        construction: dto.construction ?? null,
        roofType: dto.roofType ?? null,
        buildingType: dto.buildingType ?? null,
        squares: dto.squares != null ? String(dto.squares) : null,
        buildingAge: dto.buildingAge ?? null,
        squareMetres: dto.squareMetres != null ? String(dto.squareMetres) : null,
        dateBooked: dto.dateBooked ?? null,
        overallConditionAcceptable: dto.overallConditionAcceptable ?? false,
        iagInspectionRequired: dto.iagInspectionRequired ?? false,
        makeSafeCompletionDate: dto.makeSafeCompletionDate ?? null,
        mainRoofDamage: dto.mainRoofDamage ?? false,
        dateMainRoofRepaired: dto.dateMainRoofRepaired ?? null,
        habitable: dto.habitable ?? true,
        mould: dto.mould ?? false,
        asbestosOnSite: dto.asbestosOnSite ?? false,
        detachedGarage: dto.detachedGarage ?? false,
        sheds: dto.sheds ?? false,
        swimmingPool: dto.swimmingPool ?? false,
        detachedGrannyFlat: dto.detachedGrannyFlat ?? false,
        damageCausedByListedEvent: dto.damageCausedByListedEvent ?? false,
        hazardPoolFencing: dto.hazardPoolFencing ?? false,
        hazardPoolFencingComment: dto.hazardPoolFencingComment ?? null,
        hazardElectricalGas: dto.hazardElectricalGas ?? false,
        hazardElectricalGasComment: dto.hazardElectricalGasComment ?? null,
        hazardSewerage: dto.hazardSewerage ?? false,
        hazardSewerageComment: dto.hazardSewerageComment ?? null,
        hazardStructural: dto.hazardStructural ?? false,
        hazardStructuralComment: dto.hazardStructuralComment ?? null,
        hazardOther: dto.hazardOther ?? null,
        tempAccomRequiredImmediately: dto.tempAccomRequiredImmediately ?? false,
        tempAccomImmediateEstimateDays: dto.tempAccomImmediateEstimateDays ?? null,
        tempRepairsToMakeLivable: dto.tempRepairsToMakeLivable ?? null,
        tempAccomRequiredDuringRepairs: dto.tempAccomRequiredDuringRepairs ?? false,
        tempAccomRepairsEstimateDays: dto.tempAccomRepairsEstimateDays ?? null,
        workWhileInAccommodation: dto.workWhileInAccommodation ?? null,
        clientDiscussion: dto.clientDiscussion ?? null,
        resultantDamage: dto.resultantDamage ?? null,
        causeOfDamage: dto.causeOfDamage ?? null,
        maintenanceRelatedIssues: dto.maintenanceRelatedIssues ?? null,
        comments: dto.comments ?? null,
        variancesOfScope: dto.variancesOfScope ?? null,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
  }

  async update(params: { id: string; dto: UpdateAssessmentDto; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const { id, dto, userId } = params;

    this.logger.debug(`[AssessmentsService.update] id=${id} tenant=${tenantId}`);

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        if (key === 'squares' || key === 'squareMetres') {
          updateData[key] = value != null ? String(value) : null;
        } else {
          updateData[key] = value;
        }
      }
    }
    if (userId) updateData.updatedByUserId = userId;

    const updated = await this.assessmentsRepo.update({ id, tenantId, data: updateData });
    if (!updated) throw new NotFoundException('Assessment not found');
    return updated;
  }

  async softDelete(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[AssessmentsService.softDelete] id=${params.id} tenant=${tenantId}`);
    await this.assessmentsRepo.softDelete({ id: params.id, tenantId });
    return { deleted: true };
  }
}
