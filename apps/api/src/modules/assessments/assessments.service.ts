import { Injectable, NotFoundException, Logger, BadRequestException, Optional } from '@nestjs/common';
import {
  AppointmentsRepository,
  AssessmentsRepository,
  ClaimsRepository,
  JobsRepository,
  LookupsRepository,
  ReportsRepository,
  type AssessmentInsert,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import {
  ASSESSMENT_SECTIONS,
  emptyAssessmentSections,
  mergeSection,
} from './assessment-sections';
import {
  buildFieldAssessmentReportBody,
  toReportCustomData,
  validateAgainstSchema,
  type ReportSchemaField,
} from './assessment-report.mapper';

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly assessmentsRepo: AssessmentsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly claimsRepo: ClaimsRepository,
    private readonly reportsRepo: ReportsRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
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
    const sections = emptyAssessmentSections();
    for (const key of ASSESSMENT_SECTIONS) {
      if (dto[key]) sections[key] = dto[key] as Record<string, unknown>;
    }

    this.logger.debug(
      `AssessmentsService.create — creating assessment "${dto.name}" tenant=${tenantId}`,
    );

    return this.assessmentsRepo.create({
      data: {
        tenantId,
        name: dto.name,
        jobId: dto.jobId ?? null,
        status: dto.status ?? 'draft',
        ...sections,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
  }

  async update(params: { id: string; dto: UpdateAssessmentDto; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const { id, dto, userId } = params;
    const existing = await this.assessmentsRepo.findOne({ id, tenantId });
    if (!existing) throw new NotFoundException('Assessment not found');

    const contentChange =
      dto.name !== undefined ||
      dto.jobId !== undefined ||
      ASSESSMENT_SECTIONS.some((key) => dto[key] !== undefined);
    if (
      (existing.status === 'published' || existing.status === 'archived') &&
      contentChange
    ) {
      throw new BadRequestException('Published assessments cannot be edited');
    }

    this.logger.debug(`AssessmentsService.update — id=${id} tenant=${tenantId}`);

    const updateData: Partial<AssessmentInsert> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.jobId !== undefined) updateData.jobId = dto.jobId;
    if (dto.status !== undefined) updateData.status = dto.status;
    for (const key of ASSESSMENT_SECTIONS) {
      if (dto[key] !== undefined) {
        updateData[key] = mergeSection(existing[key], dto[key]);
      }
    }
    if (userId) updateData.updatedByUserId = userId;
    if (existing.status === 'draft' && updateData.status === undefined) {
      updateData.status = 'in_progress';
    }

    const updated = await this.assessmentsRepo.update({ id, tenantId, data: updateData });
    if (!updated) throw new NotFoundException('Assessment not found');
    return updated;
  }

  async softDelete(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`AssessmentsService.softDelete — id=${params.id} tenant=${tenantId}`);
    await this.assessmentsRepo.softDelete({ id: params.id, tenantId });
    return { deleted: true };
  }

  async validate(params: { id: string }) {
    const { assessment, job, claim, customData, errors } = await this.buildPublishPayload({
      id: params.id,
    });
    return {
      valid: errors.length === 0,
      errors,
      customData,
      assessmentId: assessment.id,
      jobId: job.id,
      claimId: claim?.id ?? null,
    };
  }

  async publish(params: { id: string; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const { assessment, job, claim, body, errors, customData } = await this.buildPublishPayload({
      id: params.id,
    });

    if (assessment.status === 'archived') {
      throw new BadRequestException('Archived assessments cannot be published');
    }
    if (assessment.status === 'published') {
      throw new BadRequestException('Published assessments are locked and cannot be re-published');
    }
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Field Assessment is missing required data',
        details: errors,
      });
    }
    if (!body.jobId) {
      throw new BadRequestException(
        'Job has no Crunchwork reference — sync the job to NRMA before publishing',
      );
    }

    const connectionId = await this.resolveConnectionId({
      tenantId,
      jobConnectionId: job.connectionId,
    });

    const existingCwId = assessment.reportExternalReference;
    let apiReport: Record<string, unknown>;
    if (existingCwId) {
      this.logger.log(
        `AssessmentsService.publish — updating Field Assessment report assessmentId=${params.id} cwReportId=${existingCwId}`,
      );
      apiReport = (await this.crunchworkService.updateReport({
        connectionId,
        reportId: existingCwId,
        body: {
          title: assessment.name,
          customData,
        },
      })) as Record<string, unknown>;
    } else {
      this.logger.log(
        `AssessmentsService.publish — creating Field Assessment report assessmentId=${params.id} cwJobId=${String(body.jobId)}`,
      );
      apiReport = (await this.crunchworkService.createReport({
        connectionId,
        body,
      })) as Record<string, unknown>;
    }

    const cwReportId =
      (typeof apiReport?.id === 'string' ? apiReport.id : undefined) ?? existingCwId ?? null;
    this.logger.log(
      `AssessmentsService.publish — Crunchwork report saved assessmentId=${params.id} cwReportId=${cwReportId ?? 'none'}`,
    );

    const reportTypeLookupId = await this.resolveReportTypeLookupId(tenantId);
    await this.reportsRepo.create({
      data: {
        tenantId,
        jobId: job.id,
        claimId: job.claimId ?? null,
        title: assessment.name,
        reportTypeLookupId: reportTypeLookupId ?? null,
        reportData: customData,
        reportMeta: {
          source: 'assessment',
          assessmentId: assessment.id,
          cwReportId,
        },
        apiPayload: apiReport ?? {},
        createdByUserId: params.userId ?? null,
        updatedByUserId: params.userId ?? null,
      },
    });

    const updated = await this.assessmentsRepo.update({
      id: assessment.id,
      tenantId,
      data: {
        status: 'published',
        reportExternalReference: cwReportId,
        updatedByUserId: params.userId ?? assessment.updatedByUserId,
      },
    });

    return updated ?? assessment;
  }

  private async buildPublishPayload(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const assessment = await this.assessmentsRepo.findOne({ id: params.id, tenantId });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (!assessment.jobId) {
      throw new BadRequestException('Assessment must be linked to a job before publishing');
    }

    const job = await this.jobsRepo.findOne({ id: assessment.jobId, tenantId });
    if (!job) throw new BadRequestException('Linked job was not found');

    const claim = job.claimId
      ? await this.claimsRepo.findOne({ id: job.claimId, tenantId })
      : null;

    const attendanceFallback = await this.deriveAttendanceFallback({
      tenantId,
      jobId: job.id,
    });

    const customData = toReportCustomData({ assessment, job, claim, attendanceFallback });
    const body = buildFieldAssessmentReportBody({
      assessment,
      job,
      claim,
      attendanceFallback,
    });

    const schemaFields = await this.loadReportTypeSchemaFields({
      tenantId,
      jobConnectionId: job.connectionId,
    });
    const { errors } = schemaFields
      ? validateAgainstSchema(customData, schemaFields)
      : { errors: [] as string[] };

    return { assessment, job, claim, customData, body, errors };
  }

  private async deriveAttendanceFallback(params: {
    tenantId: string;
    jobId: string;
  }): Promise<{ siteAttendanceDate?: string; personsAttending?: string }> {
    try {
      const appts = await this.appointmentsRepo.findByJob({
        jobId: params.jobId,
        tenantId: params.tenantId,
      });
      const first = appts[0];
      if (!first) return {};
      return {
        siteAttendanceDate: first.startDate?.toISOString?.() ?? String(first.startDate),
      };
    } catch (err) {
      this.logger.warn(
        `AssessmentsService.deriveAttendanceFallback — ${err instanceof Error ? err.message : err}`,
      );
      return {};
    }
  }

  private async loadReportTypeSchemaFields(params: {
    tenantId: string;
    jobConnectionId?: string | null;
  }): Promise<Record<string, ReportSchemaField> | null> {
    try {
      const reportTypeId = await this.resolveCwReportTypeId(params.tenantId);
      if (!reportTypeId) {
        this.logger.warn(
          'AssessmentsService.loadReportTypeSchemaFields — no Field Assessment report type id; skipping live schema validation',
        );
        return null;
      }
      const connectionId = await this.resolveConnectionId({
        tenantId: params.tenantId,
        jobConnectionId: params.jobConnectionId,
      });
      const schema = await this.crunchworkService.getReportTypeSchema({
        connectionId,
        reportTypeId,
      });
      const fields = (schema as { fields?: Record<string, ReportSchemaField> }).fields;
      return fields && typeof fields === 'object' ? fields : null;
    } catch (err) {
      this.logger.warn(
        `AssessmentsService.loadReportTypeSchemaFields — ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private async resolveCwReportTypeId(tenantId: string): Promise<string | undefined> {
    const rows = await this.lookupsRepo.findByDomain({
      tenantId,
      domain: 'report_type',
      providerCode: 'crunchwork',
    });
    const all =
      rows.length > 0
        ? rows
        : await this.lookupsRepo.findByDomain({ tenantId, domain: 'report_type' });
    const match = all.find((row) => {
      const name = (row.name ?? '').toLowerCase();
      const ext = (row.externalReference ?? '').toLowerCase();
      return name === 'field assessment' || ext === 'field assessment';
    });
    const meta = (match?.metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.crunchworkId === 'string' && meta.crunchworkId) return meta.crunchworkId;

    const existingReports = await this.reportsRepo.findAll({ tenantId, limit: 50 });
    for (const report of existingReports.data) {
      const payload = (report.apiPayload ?? {}) as Record<string, unknown>;
      const rt = payload.reportType as Record<string, unknown> | undefined;
      const rtName = String(rt?.name ?? rt?.externalReference ?? '').toLowerCase();
      if (rtName === 'field assessment' && typeof rt?.id === 'string') return rt.id;
    }
    return undefined;
  }

  private async resolveConnectionId(params: {
    tenantId: string;
    jobConnectionId?: string | null;
  }): Promise<string> {
    if (params.jobConnectionId) {
      if (this.connectionResolver) {
        this.crunchworkService.setConnectionResolver(this.connectionResolver);
      }
      this.logger.debug(
        `AssessmentsService.resolveConnectionId — using job.connectionId=${params.jobConnectionId}`,
      );
      return params.jobConnectionId;
    }

    if (!this.connectionResolver) {
      throw new BadRequestException('No provider connection available to publish to NRMA');
    }
    this.crunchworkService.setConnectionResolver(this.connectionResolver);
    const connection = await this.connectionResolver.resolveForTenant({ tenantId: params.tenantId });
    if (!connection) {
      throw new BadRequestException('No active Crunchwork connection for tenant');
    }
    this.logger.debug(
      `AssessmentsService.resolveConnectionId — using tenant connectionId=${connection.id}`,
    );
    return connection.id;
  }

  private async resolveReportTypeLookupId(tenantId: string): Promise<string | undefined> {
    const crunchworkRows = await this.lookupsRepo.findByDomain({
      tenantId,
      domain: 'report_type',
      providerCode: 'crunchwork',
    });
    const rows =
      crunchworkRows.length > 0
        ? crunchworkRows
        : await this.lookupsRepo.findByDomain({ tenantId, domain: 'report_type' });
    const match = rows.find((row) => {
      const name = (row.name ?? '').toLowerCase();
      const ext = (row.externalReference ?? '').toLowerCase();
      return name === 'field assessment' || ext === 'field assessment';
    });
    return match?.id;
  }
}
