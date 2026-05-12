import { Injectable, Logger } from '@nestjs/common';
import { RfqsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class RfqsService {
  private readonly logger = new Logger('api:RfqsService');

  constructor(
    private readonly rfqsRepo: RfqsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    quoteId?: string;
    vendorId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`api:RfqsService.findAll tenantId=${tenantId}`);
    return this.rfqsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      quoteId: params.quoteId,
      vendorId: params.vendorId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`api:RfqsService.findOne id=${params.id} tenantId=${tenantId}`);
    return this.rfqsRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`api:RfqsService.findByJob jobId=${params.jobId} tenantId=${tenantId}`);
    return this.rfqsRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async findByQuote(params: { quoteId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`api:RfqsService.findByQuote quoteId=${params.quoteId} tenantId=${tenantId}`);
    return this.rfqsRepo.findByQuote({ quoteId: params.quoteId, tenantId });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(`api:RfqsService.create tenantId=${tenantId}`);
    return this.rfqsRepo.create({ data: { ...params.body, tenantId } as any });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    this.logger.log(`api:RfqsService.update id=${params.id}`);
    return this.rfqsRepo.update({ id: params.id, data: params.body as any });
  }
}
