import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { ReportsRepository, type ReportInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepo: ReportsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    claimId?: string;
    reportTypeId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.reportsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      claimId: params.claimId,
      reportTypeId: params.reportTypeId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.reportsRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.reportsRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async findByClaim(params: { claimId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.reportsRepo.findByClaim({ claimId: params.claimId, tenantId });
  }

  async create(params: { body: Record<string, unknown> }) {
    const crunchworkTenantId = this.tenantContext.getCrunchworkTenantId();
    const connectionId = await this.resolveConnectionId(crunchworkTenantId);
    const apiReport = await this.crunchworkService.createReport({
      connectionId,
      body: params.body,
    });

    const tenantId = this.tenantContext.getTenantId();
    const apiObj = apiReport as Record<string, unknown>;
    const insertData: ReportInsert = {
      tenantId,
      claimId: (apiObj.claimId ?? params.body?.claimId) as string,
      jobId: (apiObj.jobId ?? params.body?.jobId) as string,
      title: apiObj.title as string,
      reportData: (apiObj.reportData ?? params.body?.reportData ?? {}) as Record<string, unknown>,
      reportMeta: (apiObj.reportMeta ?? {}) as Record<string, unknown>,
      apiPayload: apiReport as Record<string, unknown>,
    };
    return this.reportsRepo.create({ data: insertData });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const crunchworkTenantId = this.tenantContext.getCrunchworkTenantId();
    const connectionId = await this.resolveConnectionId(crunchworkTenantId);
    const apiReport = await this.crunchworkService.updateReport({
      connectionId,
      reportId: params.id,
      body: params.body,
    });

    return this.reportsRepo.update({
      id: params.id,
      data: { apiPayload: apiReport as Record<string, unknown> },
    });
  }
}
