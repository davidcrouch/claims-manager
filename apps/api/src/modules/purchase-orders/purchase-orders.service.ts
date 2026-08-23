import { Injectable, Optional, BadRequestException, Logger, Inject } from '@nestjs/common';
import { PurchaseOrdersRepository } from '../../database/repositories';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';
import { RecordNumberService } from '../../common/record-number/record-number.service';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    private readonly recordNumberService: RecordNumberService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
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
    jobIds?: string[];
    status?: string;
    vendorId?: string;
    ownershipStatus?: string;
    captureMethod?: string;
    search?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.purchaseOrdersRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      jobIds: params.jobIds,
      status: params.status,
      vendorId: params.vendorId,
      ownershipStatus: params.ownershipStatus,
      captureMethod: params.captureMethod,
      search: params.search,
      sort: params.sort,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.purchaseOrdersRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.purchaseOrdersRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(`api:PurchaseOrdersService.create tenantId=${tenantId}`);
    const {
      createdByUserId: _c,
      updatedByUserId: _u,
      internalNumber: bodyInternalNumber,
      purchaseOrderNumber: bodyPurchaseOrderNumber,
      ...rest
    } = params.body;

    return this.db.transaction(async (tx) => {
      const internalNumber = await this.recordNumberService.resolve({
        tenantId,
        entity: 'purchase_order',
        explicit: bodyInternalNumber,
        tx,
      });
      const purchaseOrderNumber = this.recordNumberService.isBlank(bodyPurchaseOrderNumber)
        ? null
        : String(bodyPurchaseOrderNumber).trim();

      return this.purchaseOrdersRepo.create({
        data: {
          ...rest,
          tenantId,
          internalNumber,
          purchaseOrderNumber,
          createdByUserId: params.userId ?? null,
          updatedByUserId: params.userId ?? null,
        } as any,
        tx,
      });
    });
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    userId?: string;
  }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    if (typeof params.body.statusLookupId === 'string' && params.body.statusLookupId) {
      const updated = await this.purchaseOrdersRepo.update({
        id: params.id,
        data: {
          statusLookupId: params.body.statusLookupId,
          ...(params.userId ? { updatedByUserId: params.userId } : {}),
        },
      });
      if (this.outboundEvents && existing.jobId) {
        const status = (params.body.status as string) ?? '';
        if (status === 'Completed' || status === 'Complete') {
          this.outboundEvents.emitPurchaseOrderCompleted({
            purchaseOrderId: params.id,
            jobId: existing.jobId,
            tenantId: this.tenantContext.getTenantId(),
          }).catch(() => {});
        }
      }
      return updated;
    }

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiPo = await this.crunchworkService.updatePurchaseOrder({
      connectionId,
      purchaseOrderId: params.id,
      body: params.body,
    });

    return this.purchaseOrdersRepo.update({
      id: params.id,
      data: {
        purchaseOrderPayload: apiPo as Record<string, unknown>,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });
  }
}
