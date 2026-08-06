import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ProposalsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { LookupResolutionService } from '../domain/services/lookup-resolution.service';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger('ProposalsService');

  constructor(
    private readonly proposalsRepo: ProposalsRepository,
    private readonly tenantContext: TenantContext,
    private readonly lookupResolution: LookupResolutionService,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    rfqId?: string;
    status?: string;
    vendorId?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      rfqId: params.rfqId,
      status: params.status,
      vendorId: params.vendorId,
      sort: params.sort,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async findByRfq(params: { rfqId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findByRfq({ rfqId: params.rfqId, tenantId });
  }

  async findByVendor(params: { vendorId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.findByVendor({
      vendorId: params.vendorId,
      tenantId,
    });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.proposalsRepo.create({ data: { ...params.body, tenantId } as any });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.proposalsRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Proposal not found');
    }

    const data: Record<string, unknown> = { ...params.body };

    // Resolve status by name if provided as { status: { name } }
    const statusObj = params.body.status as { name?: string } | undefined;
    if (statusObj?.name && typeof statusObj.name === 'string') {
      const statusLookupId = await this.lookupResolution.resolve({
        tenantId,
        domain: 'proposal_status',
        externalReference: statusObj.name,
        name: statusObj.name,
        autoCreate: true,
      });
      if (statusLookupId) {
        data.statusLookupId = statusLookupId;
      }
      delete data.status;
    }

    return this.proposalsRepo.update({ id: params.id, data: data as any });
  }

  async accept(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.proposalsRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Proposal not found');
    }

    const statusLookupId = await this.lookupResolution.resolve({
      tenantId,
      domain: 'proposal_status',
      externalReference: 'Accepted',
      name: 'Accepted',
      autoCreate: true,
    });

    const updated = await this.proposalsRepo.update({
      id: params.id,
      data: { statusLookupId: statusLookupId ?? undefined },
    });

    this.logger.log(`ProposalsService.accept — proposal=${params.id} accepted`);
    return updated;
  }

  async decline(params: { id: string; reason?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.proposalsRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new BadRequestException('Proposal not found');
    }

    const statusLookupId = await this.lookupResolution.resolve({
      tenantId,
      domain: 'proposal_status',
      externalReference: 'Declined',
      name: 'Declined',
      autoCreate: true,
    });

    const customData = {
      ...((existing.customData as Record<string, unknown> | null) ?? {}),
      ...(params.reason ? { declineReason: params.reason } : {}),
    };

    const updated = await this.proposalsRepo.update({
      id: params.id,
      data: {
        statusLookupId: statusLookupId ?? undefined,
        customData,
      },
    });

    this.logger.log(`ProposalsService.decline — proposal=${params.id} declined`);
    return updated;
  }
}
