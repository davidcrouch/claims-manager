import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { JobsRepository, type JobInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly jobsRepo: JobsRepository,
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
    claimId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.jobsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      claimId: params.claimId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.jobsRepo.findOne({ id: params.id, tenantId });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiJob = await this.crunchworkService.createJob({
      connectionId,
      body: params.body,
    });

    const apiJobObj = apiJob as Record<string, unknown>;
    const claimId = (apiJobObj.claimId ?? apiJobObj.claim_id ?? params.body?.claimId ?? params.body?.claim_id) as string;
    const jobTypeId = (apiJobObj.jobType as { id?: string })?.id ?? (apiJobObj.job_type as { id?: string })?.id;

    const insertData: JobInsert = {
      tenantId,
      claimId: claimId || '',
      externalReference: (apiJobObj.id as string) ?? '',
      jobTypeLookupId: jobTypeId ?? '',
      apiPayload: apiJob as Record<string, unknown>,
    };
    return this.jobsRepo.create({ data: insertData });
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
  }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiJob = await this.crunchworkService.updateJob({
      connectionId,
      jobId: params.id,
      body: params.body,
    });

    return this.jobsRepo.update({
      id: params.id,
      data: { apiPayload: apiJob as Record<string, unknown> },
    });
  }
}
